import { useState, useEffect, useRef, useCallback } from 'react';
import {
  loadFaceRecognitionModels,
  detectFaceInVideo,
  matchUserFace,
  DEFAULT_MATCH_THRESHOLD,
  isValidDescriptor,
} from '../services/faceRecognitionService';
import { userService } from '../services/userService';
import { attendanceService } from '../services/attendanceService';
import confetti from 'canvas-confetti';

export function useFaceRecognition({
  videoRef,
  isActive,
  targetUserId = null,
  matchThreshold = DEFAULT_MATCH_THRESHOLD,
  autoMarkAttendance = true,
  onAttendanceSuccess = null,
}) {
  // Model state
  const [modelsStatus, setModelsStatus] = useState('loading'); // 'loading' | 'loaded' | 'error'
  const [modelsError, setModelsError] = useState(null);

  // Enrolled Descriptors state
  const [descriptorsStatus, setDescriptorsStatus] = useState('idle'); // 'idle' | 'loading' | 'loaded' | 'empty' | 'error'
  const [descriptorsError, setDescriptorsError] = useState(null);
  const [enrolledCount, setEnrolledCount] = useState(0);

  // Scanner & Recognition state
  const [status, setStatus] = useState('idle');
  // Possible statuses:
  // 'idle', 'loading_models', 'models_error', 'loading_descriptors', 'unregistered',
  // 'scanning', 'multiple_faces', 'alignment_required', 'rejected', 'matched',
  // 'already_marked', 'backend_error'

  const [feedbackMessage, setFeedbackMessage] = useState('Initializing biometric engine...');
  const [detectedBox, setDetectedBox] = useState(null);
  const [recognitionConfidence, setRecognitionConfidence] = useState(0);
  const [detectionScore, setDetectionScore] = useState(0);
  const [recognitionLogs, setRecognitionLogs] = useState([]);

  // Internal lifecycle & lock refs
  const isProcessingRef = useRef(false);
  const consecutiveMatchesRef = useRef(0);
  const enrolledDescriptorsRef = useRef([]);
  const attendanceSubmittedRef = useRef(false); // In-flight or submitted lock
  const hasCompletedAttendanceRef = useRef(false); // Locked permanently for this user (success / already_marked)
  const activeUserIdRef = useRef(targetUserId);
  const sessionRef = useRef(0); // Generation counter to invalidate stale async inferences

  // Latest props via refs to prevent recognition loop restarts
  const onAttendanceSuccessRef = useRef(onAttendanceSuccess);
  useEffect(() => {
    onAttendanceSuccessRef.current = onAttendanceSuccess;
  }, [onAttendanceSuccess]);

  const autoMarkAttendanceRef = useRef(autoMarkAttendance);
  useEffect(() => {
    autoMarkAttendanceRef.current = autoMarkAttendance;
  }, [autoMarkAttendance]);

  const matchThresholdRef = useRef(matchThreshold);
  useEffect(() => {
    matchThresholdRef.current = matchThreshold;
  }, [matchThreshold]);

  // 1. Load Local Neural Models on Mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      setModelsStatus('loading');
      const res = await loadFaceRecognitionModels();
      if (!mounted) return;

      if (res.success) {
        setModelsStatus('loaded');
        setModelsError(null);
      } else {
        setModelsStatus('error');
        setModelsError(res.error);
        setStatus('models_error');
        setFeedbackMessage('Failed to load neural models from /models. Recognition unavailable.');
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // 2. Fetch Enrolled Descriptors whenever targetUserId changes
  useEffect(() => {
    let isCancelled = false;

    // Invalidate any in-flight inference or API requests from previous user
    sessionRef.current += 1;
    activeUserIdRef.current = targetUserId;

    // Reset all scanner state safely for target user change
    consecutiveMatchesRef.current = 0;
    attendanceSubmittedRef.current = false;
    hasCompletedAttendanceRef.current = false;
    isProcessingRef.current = false;
    enrolledDescriptorsRef.current = [];
    setEnrolledCount(0);
    setDetectedBox(null);
    setRecognitionConfidence(0);
    setDetectionScore(0);

    if (!targetUserId) {
      setDescriptorsStatus('idle');
      setDescriptorsError(null);
      return;
    }

    async function fetchDescriptors() {
      setDescriptorsStatus('loading');
      setDescriptorsError(null);

      try {
        const rawDescriptors = await userService.getUserFaceDescriptors(targetUserId);
        if (isCancelled || activeUserIdRef.current !== targetUserId) return;

        if (!Array.isArray(rawDescriptors) || rawDescriptors.length === 0) {
          enrolledDescriptorsRef.current = [];
          setEnrolledCount(0);
          setDescriptorsStatus('empty');
          setStatus('unregistered');
          setFeedbackMessage('No registered facial profile. Please enroll your face first.');
          return;
        }

        // Validate each descriptor
        const validDescriptors = rawDescriptors.filter(isValidDescriptor);

        if (validDescriptors.length === 0) {
          enrolledDescriptorsRef.current = [];
          setEnrolledCount(0);
          setDescriptorsStatus('empty');
          setStatus('unregistered');
          setFeedbackMessage('Registered biometric vectors are invalid. Please re-enroll.');
          return;
        }

        enrolledDescriptorsRef.current = validDescriptors;
        setEnrolledCount(validDescriptors.length);
        setDescriptorsStatus('loaded');
        setDescriptorsError(null);
      } catch (err) {
        if (isCancelled || activeUserIdRef.current !== targetUserId) return;
        const msg = err?.message || 'Database error retrieving face descriptors';
        console.error('Failed to load user descriptors:', msg);
        enrolledDescriptorsRef.current = [];
        setEnrolledCount(0);
        setDescriptorsStatus('error');
        setDescriptorsError(msg);
        setStatus('backend_error');
        setFeedbackMessage('Unable to load biometric profile: ' + msg);
      }
    }

    fetchDescriptors();

    return () => {
      isCancelled = true;
    };
  }, [targetUserId]);

  // 3. Status Coordination Effect (independent of recognition loop)
  useEffect(() => {
    if (!isActive) {
      setDetectedBox(null);
      consecutiveMatchesRef.current = 0;
      setStatus((prev) => {
        if (prev === 'models_error' || prev === 'unregistered' || prev === 'backend_error') {
          return prev;
        }
        return 'idle';
      });
      setFeedbackMessage('Camera is off. Start camera to scan.');
      return;
    }

    if (modelsStatus === 'loading') {
      setStatus('loading_models');
      setFeedbackMessage('Loading neural recognition models...');
    } else if (modelsStatus === 'error') {
      setStatus('models_error');
      setFeedbackMessage('Face recognition neural models are unavailable.');
    } else if (descriptorsStatus === 'loading') {
      setStatus('loading_descriptors');
      setFeedbackMessage('Loading authorized biometric profile...');
    } else if (descriptorsStatus === 'empty' || descriptorsStatus === 'idle') {
      setStatus('unregistered');
      setFeedbackMessage('No biometric profile found for this user. Recognition unavailable.');
    } else if (descriptorsStatus === 'error') {
      setStatus('backend_error');
      setFeedbackMessage('Error accessing biometric registry.');
    }
  }, [isActive, modelsStatus, descriptorsStatus]);

  // 4. Main Recognition Loop
  // NOTE: Starts ONLY when camera, models, and descriptors are ready.
  // 'status' is NOT in the dependencies, preventing loop re-initialization on status changes.
  useEffect(() => {
    const isReady =
      isActive &&
      Boolean(videoRef.current) &&
      modelsStatus === 'loaded' &&
      descriptorsStatus === 'loaded' &&
      Boolean(targetUserId);

    if (!isReady) {
      return;
    }

    // Initialize scanner status if not already finished
    setStatus((prev) => {
      if (prev === 'matched' && hasCompletedAttendanceRef.current) return prev;
      if (prev === 'already_marked' && hasCompletedAttendanceRef.current) return prev;
      return 'scanning';
    });

    if (!hasCompletedAttendanceRef.current) {
      setFeedbackMessage('Position your face within the frame');
    }

    const currentSession = sessionRef.current;
    const currentUserId = targetUserId;
    let intervalId = null;

    const runRecognitionCycle = async () => {
      // Guard against overlapping inference, cancelled session, or non-playing video
      if (
        isProcessingRef.current ||
        sessionRef.current !== currentSession ||
        activeUserIdRef.current !== currentUserId ||
        !videoRef.current ||
        videoRef.current.paused ||
        videoRef.current.ended
      ) {
        return;
      }

      isProcessingRef.current = true;

      try {
        // Step A: Neural Face Detection & Feature Extraction
        const detectionResult = await detectFaceInVideo(videoRef.current);

        // Guard against stale in-flight results if user changed or scanner stopped during inference
        if (
          sessionRef.current !== currentSession ||
          activeUserIdRef.current !== currentUserId ||
          !videoRef.current
        ) {
          return;
        }

        // If models are unexpectedly not ready or detection failed
        if (!detectionResult.modelsReady) {
          setStatus('models_error');
          setFeedbackMessage(detectionResult.message || 'Models unavailable');
          setDetectedBox(null);
          consecutiveMatchesRef.current = 0;
          return;
        }

        // If zero faces detected
        if (!detectionResult.detected) {
          if (detectionResult.multipleFaces) {
            setStatus('multiple_faces');
            setFeedbackMessage(
              `Multiple faces (${detectionResult.count}) detected! Only 1 person permitted.`
            );
          } else {
            // Keep status 'already_marked' or 'matched' if already completed today
            if (!hasCompletedAttendanceRef.current) {
              setStatus('scanning');
              setFeedbackMessage(detectionResult.message || 'Position your face within the frame');
            }
          }
          setDetectedBox(null);
          consecutiveMatchesRef.current = 0;
          return;
        }

        // Single face detected
        setDetectedBox({
          ...detectionResult.box,
          videoWidth: detectionResult.videoWidth,
          videoHeight: detectionResult.videoHeight,
        });
        setDetectionScore(detectionResult.detectionScore || 0);

        // Step B: Face Alignment Validation
        // Requires looking directly at camera before evaluating biometric vector
        if (!detectionResult.isFaceAligned) {
          setStatus('alignment_required');
          setFeedbackMessage('Please look directly at the camera (face forward).');
          consecutiveMatchesRef.current = 0;
          return;
        }

        // Step C: Biometric Vector Comparison against Enrolled Descriptors
        const enrolled = enrolledDescriptorsRef.current;

        // Fail closed if enrolled descriptors are missing or empty
        if (!Array.isArray(enrolled) || enrolled.length === 0) {
          setStatus('unregistered');
          setFeedbackMessage('No registered biometric descriptors available for this user.');
          consecutiveMatchesRef.current = 0;
          return;
        }

        const matchResult = matchUserFace(
          detectionResult.descriptor,
          enrolled,
          matchThresholdRef.current
        );

        // Final cancellation check before state updates
        if (
          sessionRef.current !== currentSession ||
          activeUserIdRef.current !== currentUserId
        ) {
          return;
        }

        // Reject if identity does not match - reset consecutive matches count
        if (!matchResult.match) {
          consecutiveMatchesRef.current = 0;
          setRecognitionConfidence(matchResult.confidence);
          setStatus('rejected');
          setFeedbackMessage('Face not recognized. Biometric mismatch.');
          return;
        }

        // Identity Match Verified
        setRecognitionConfidence(matchResult.confidence);
        consecutiveMatchesRef.current += 1;

        // Require 2 consecutive matching frames to prevent camera noise triggers
        if (consecutiveMatchesRef.current >= 2) {
          if (!hasCompletedAttendanceRef.current) {
            setStatus('matched');
            setFeedbackMessage('Identity verified via facial biometrics.');
          }

          // Step D: Trigger Attendance (with strict locking)
          if (
            autoMarkAttendanceRef.current &&
            currentUserId &&
            !attendanceSubmittedRef.current &&
            !hasCompletedAttendanceRef.current
          ) {
            // Lock immediately to prevent duplicate concurrent API requests
            attendanceSubmittedRef.current = true;

            try {
              const attResult = await attendanceService.markAttendance({
                userId: currentUserId,
                matchConfidence: matchResult.confidence,
                verificationMethod: 'Face Recognition',
              });

              // Guard against state mutation if target user changed during network call
              if (
                sessionRef.current !== currentSession ||
                activeUserIdRef.current !== currentUserId
              ) {
                return;
              }

              const logItem = {
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                status: attResult.alreadyMarked ? 'Already Marked' : 'Marked',
                success: !attResult.alreadyMarked,
                confidence: matchResult.confidence,
              };
              setRecognitionLogs((prev) => [logItem, ...prev.slice(0, 9)]);

              if (attResult.alreadyMarked) {
                hasCompletedAttendanceRef.current = true;
                attendanceSubmittedRef.current = true; // Retain lock
                setStatus('already_marked');
                setFeedbackMessage('You have already marked your attendance today.');
              } else if (attResult.success) {
                hasCompletedAttendanceRef.current = true;
                attendanceSubmittedRef.current = true; // Retain lock
                setStatus('matched');
                setFeedbackMessage(attResult.message || 'Attendance marked successfully!');
                try {
                  confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
                } catch {}

                if (onAttendanceSuccessRef.current) {
                  onAttendanceSuccessRef.current(attResult.record);
                }
              } else {
                // Server rejected with failure - unlock for potential retry
                attendanceSubmittedRef.current = false;
                setStatus('backend_error');
                setFeedbackMessage(attResult.message || 'Attendance rejected by server.');
              }
            } catch (err) {
              if (
                sessionRef.current !== currentSession ||
                activeUserIdRef.current !== currentUserId
              ) {
                return;
              }
              console.error('Attendance API error:', err);
              // Unlock only on genuine network/backend error so user can re-attempt
              attendanceSubmittedRef.current = false;
              setStatus('backend_error');
              setFeedbackMessage('Network or backend error recording attendance: ' + err.message);
            }
          }
        }
      } catch (err) {
        console.error('Recognition loop cycle error:', err);
      } finally {
        isProcessingRef.current = false;
      }
    };

    intervalId = setInterval(runRecognitionCycle, 400);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isActive, modelsStatus, descriptorsStatus, targetUserId, videoRef]);

  // Reset Scanner
  // Note: If attendance was already successfully marked or already marked today,
  // scanner reset does NOT permit a second submission.
  const resetScanner = useCallback(() => {
    consecutiveMatchesRef.current = 0;
    setDetectedBox(null);

    if (!hasCompletedAttendanceRef.current) {
      attendanceSubmittedRef.current = false;
      if (descriptorsStatus === 'loaded' && modelsStatus === 'loaded') {
        setStatus('scanning');
        setFeedbackMessage('Position your face within the frame');
      }
    }
  }, [descriptorsStatus, modelsStatus]);

  return {
    modelsStatus,
    modelsError,
    descriptorsStatus,
    descriptorsError,
    enrolledCount,
    status,
    feedbackMessage,
    detectedBox,
    recognitionConfidence,
    detectionScore,
    recognitionLogs,
    resetScanner,
  };
}
