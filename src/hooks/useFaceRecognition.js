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

  // Internal refs
  const isProcessingRef = useRef(false);
  const consecutiveMatchesRef = useRef(0);
  const enrolledDescriptorsRef = useRef([]);
  const attendanceSubmittedRef = useRef(false);
  const activeUserIdRef = useRef(targetUserId);

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
    activeUserIdRef.current = targetUserId;

    // Reset scanner state on user change
    consecutiveMatchesRef.current = 0;
    attendanceSubmittedRef.current = false;
    enrolledDescriptorsRef.current = [];
    setEnrolledCount(0);
    setDetectedBox(null);

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
        if (isCancelled) return;

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

        // Ready to scan
        if (modelsStatus === 'loaded') {
          setStatus('scanning');
          setFeedbackMessage('Position your face within the frame');
        }
      } catch (err) {
        if (isCancelled) return;
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
  }, [targetUserId, modelsStatus]);

  // 3. Main Recognition Loop
  useEffect(() => {
    // Cannot run recognition if camera is inactive, video is missing,
    // models are not loaded, or user has no loaded descriptors
    if (!isActive || !videoRef.current) {
      setDetectedBox(null);
      if (status !== 'models_error' && status !== 'unregistered') {
        setStatus('idle');
      }
      return;
    }

    if (modelsStatus === 'loading') {
      setStatus('loading_models');
      setFeedbackMessage('Loading neural recognition models...');
      return;
    }

    if (modelsStatus === 'error') {
      setStatus('models_error');
      setFeedbackMessage('Face recognition neural models are unavailable.');
      return;
    }

    if (descriptorsStatus === 'loading') {
      setStatus('loading_descriptors');
      setFeedbackMessage('Loading authorized biometric profile...');
      return;
    }

    if (descriptorsStatus === 'empty' || descriptorsStatus === 'idle') {
      setStatus('unregistered');
      setFeedbackMessage('No biometric profile found for this user. Recognition unavailable.');
      return;
    }

    if (descriptorsStatus === 'error') {
      setStatus('backend_error');
      setFeedbackMessage('Error accessing biometric registry.');
      return;
    }

    let intervalId;

    const runRecognitionCycle = async () => {
      // Guard against overlapping processing or closed video
      if (
        isProcessingRef.current ||
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
            // Keep status 'already_marked' if already completed today
            if (!attendanceSubmittedRef.current) {
              setStatus('scanning');
              setFeedbackMessage(detectionResult.message || 'Position your face within the frame');
            }
          }
          setDetectedBox(null);
          consecutiveMatchesRef.current = 0;
          return;
        }

        // Single face detected!
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

        // Strict Requirement: Fail closed if enrolled descriptors are missing or empty
        if (!Array.isArray(enrolled) || enrolled.length === 0) {
          setStatus('unregistered');
          setFeedbackMessage('No registered biometric descriptors available for this user.');
          consecutiveMatchesRef.current = 0;
          return;
        }

        const matchResult = matchUserFace(
          detectionResult.descriptor,
          enrolled,
          matchThreshold
        );

        // Reject if identity does not match
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
          setStatus('matched');
          setFeedbackMessage('Identity verified via facial biometrics.');

          // Step D: Trigger Attendance (with strict locking)
          if (
            autoMarkAttendance &&
            targetUserId &&
            !attendanceSubmittedRef.current
          ) {
            attendanceSubmittedRef.current = true; // Lock immediately to prevent race conditions

            try {
              const attResult = await attendanceService.markAttendance({
                userId: targetUserId,
                matchConfidence: matchResult.confidence,
                verificationMethod: 'Face Recognition',
              });

              const logItem = {
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                status: attResult.alreadyMarked ? 'Already Marked' : 'Marked',
                success: !attResult.alreadyMarked,
                confidence: matchResult.confidence,
              };
              setRecognitionLogs((prev) => [logItem, ...prev.slice(0, 9)]);

              if (attResult.alreadyMarked) {
                setStatus('already_marked');
                setFeedbackMessage('You have already marked your attendance today.');
              } else if (attResult.success) {
                setStatus('matched');
                setFeedbackMessage(attResult.message || 'Attendance marked successfully!');
                try {
                  confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
                } catch {}

                if (onAttendanceSuccess) {
                  onAttendanceSuccess(attResult.record);
                }
              } else {
                setStatus('backend_error');
                setFeedbackMessage(attResult.message || 'Attendance rejected by server.');
              }
            } catch (err) {
              console.error('Attendance API error:', err);
              setStatus('backend_error');
              setFeedbackMessage('Network or backend error recording attendance: ' + err.message);
              // Unlock on network failure so user may re-attempt if necessary
              attendanceSubmittedRef.current = false;
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
      clearInterval(intervalId);
    };
  }, [
    isActive,
    targetUserId,
    modelsStatus,
    descriptorsStatus,
    matchThreshold,
    autoMarkAttendance,
    onAttendanceSuccess,
    videoRef,
    status,
  ]);

  const resetScanner = useCallback(() => {
    consecutiveMatchesRef.current = 0;
    attendanceSubmittedRef.current = false;
    setDetectedBox(null);
    if (descriptorsStatus === 'loaded' && modelsStatus === 'loaded') {
      setStatus('scanning');
      setFeedbackMessage('Position your face within the frame');
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
