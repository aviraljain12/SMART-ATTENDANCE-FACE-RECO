import { useState, useEffect, useRef, useCallback } from 'react';
import {
  loadFaceRecognitionModels,
  detectFaceInVideo,
  matchUserFace,
  identifyUserInRegistry,
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
  organizationId = null,
  isKioskMode = false,
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
  const [identifiedUser, setIdentifiedUser] = useState(null);

  // Internal lifecycle & lock refs
  const isProcessingRef = useRef(false);
  const consecutiveMatchesRef = useRef(0);
  const enrolledDescriptorsRef = useRef([]);
  const kioskRegistryRef = useRef([]);
  const kioskIdentifiedUserRef = useRef(null);
  const kioskAttendanceLockMapRef = useRef(new Set()); // Prevents duplicate check-ins in kiosk mode
  const attendanceSubmittedRef = useRef(false); // In-flight or submitted lock for single user
  const hasCompletedAttendanceRef = useRef(false); // Locked permanently for single user
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

  // 2. Fetch Enrolled Descriptors (Target User mode OR Organization Kiosk mode)
  useEffect(() => {
    let isCancelled = false;

    // Invalidate any in-flight inference or API requests from previous user/mode
    sessionRef.current += 1;
    activeUserIdRef.current = targetUserId;

    // Reset scanner states safely
    consecutiveMatchesRef.current = 0;
    attendanceSubmittedRef.current = false;
    hasCompletedAttendanceRef.current = false;
    isProcessingRef.current = false;
    enrolledDescriptorsRef.current = [];
    kioskRegistryRef.current = [];
    kioskIdentifiedUserRef.current = null;
    setIdentifiedUser(null);
    setEnrolledCount(0);
    setDetectedBox(null);
    setRecognitionConfidence(0);
    setDetectionScore(0);

    // Kiosk Mode: Load organization-wide genuine biometric registry
    if (isKioskMode) {
      if (!organizationId) {
        setDescriptorsStatus('empty');
        setStatus('unregistered');
        setFeedbackMessage('Organization ID required for terminal identification.');
        return;
      }

      async function fetchKioskRegistry() {
        setDescriptorsStatus('loading');
        setDescriptorsError(null);
        try {
          const registry = await userService.getOrganizationBiometricRegistry(organizationId);
          if (isCancelled) return;

          if (!Array.isArray(registry) || registry.length === 0) {
            kioskRegistryRef.current = [];
            setEnrolledCount(0);
            setDescriptorsStatus('empty');
            setStatus('unregistered');
            setFeedbackMessage('No enrolled employees found in this organization.');
            return;
          }

          kioskRegistryRef.current = registry;
          setEnrolledCount(registry.length);
          setDescriptorsStatus('loaded');
          setDescriptorsError(null);
        } catch (err) {
          if (isCancelled) return;
          console.error('Failed to load organization registry:', err);
          kioskRegistryRef.current = [];
          setEnrolledCount(0);
          setDescriptorsStatus('error');
          setDescriptorsError(err.message);
          setStatus('backend_error');
          setFeedbackMessage('Error loading biometric registry: ' + err.message);
        }
      }

      fetchKioskRegistry();
      return () => {
        isCancelled = true;
      };
    }

    // Single-Employee Mode: Load target user's genuine descriptors
    if (!targetUserId) {
      setDescriptorsStatus('idle');
      setDescriptorsError(null);
      return;
    }

    async function fetchUserDescriptors() {
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
          setFeedbackMessage('Face Not Registered');
          return;
        }

        const validDescriptors = rawDescriptors.filter(isValidDescriptor);

        if (validDescriptors.length === 0) {
          enrolledDescriptorsRef.current = [];
          setEnrolledCount(0);
          setDescriptorsStatus('empty');
          setStatus('unregistered');
          setFeedbackMessage('Face Not Registered');
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
        setFeedbackMessage('Recognition unavailable: ' + msg);
      }
    }

    fetchUserDescriptors();

    return () => {
      isCancelled = true;
    };
  }, [targetUserId, organizationId, isKioskMode]);

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
      setFeedbackMessage('Recognition unavailable');
    } else if (descriptorsStatus === 'loading') {
      setStatus('loading_descriptors');
      setFeedbackMessage('Loading biometric registry...');
    } else if (descriptorsStatus === 'empty') {
      setStatus('unregistered');
      setFeedbackMessage('Face Not Registered');
    } else if (descriptorsStatus === 'error') {
      setStatus('backend_error');
      setFeedbackMessage('Recognition unavailable');
    }
  }, [isActive, modelsStatus, descriptorsStatus]);

  // 4. Main Recognition Loop
  useEffect(() => {
    const isReady =
      isActive &&
      Boolean(videoRef.current) &&
      modelsStatus === 'loaded' &&
      descriptorsStatus === 'loaded' &&
      (Boolean(targetUserId) || isKioskMode);

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
      // Guard against overlapping inference, cancelled session, or paused video
      if (
        isProcessingRef.current ||
        sessionRef.current !== currentSession ||
        (!isKioskMode && activeUserIdRef.current !== currentUserId) ||
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

        // Guard against stale in-flight results if user/mode changed during inference
        if (
          sessionRef.current !== currentSession ||
          (!isKioskMode && activeUserIdRef.current !== currentUserId) ||
          !videoRef.current
        ) {
          return;
        }

        // If models unexpectedly failed
        if (!detectionResult.modelsReady) {
          setStatus('models_error');
          setFeedbackMessage('Recognition unavailable');
          setDetectedBox(null);
          consecutiveMatchesRef.current = 0;
          return;
        }

        // If zero faces detected
        if (!detectionResult.detected) {
          if (detectionResult.multipleFaces) {
            setStatus('multiple_faces');
            setFeedbackMessage('Multiple Faces Detected');
          } else {
            if (!hasCompletedAttendanceRef.current) {
              setStatus('scanning');
              setFeedbackMessage('No Face Detected');
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
        if (!detectionResult.isFaceAligned) {
          setStatus('alignment_required');
          setFeedbackMessage('Please look directly at the camera (face forward).');
          consecutiveMatchesRef.current = 0;
          return;
        }

        // Step C: Biometric Vector Comparison
        if (isKioskMode) {
          // Organization-Scoped Multi-Candidate Identification Flow (Section 6)
          const registry = kioskRegistryRef.current;
          if (!Array.isArray(registry) || registry.length === 0) {
            setStatus('unregistered');
            setFeedbackMessage('No enrolled employees found in this organization.');
            consecutiveMatchesRef.current = 0;
            return;
          }

          const identResult = identifyUserInRegistry(
            detectionResult.descriptor,
            registry,
            matchThresholdRef.current
          );

          if (sessionRef.current !== currentSession) return;

          if (!identResult.identified) {
            consecutiveMatchesRef.current = 0;
            kioskIdentifiedUserRef.current = null;
            setIdentifiedUser(null);
            setStatus('rejected');
            setFeedbackMessage('Face Mismatch');
            return;
          }

          const matchedUser = identResult.user;
          setRecognitionConfidence(identResult.confidence);
          setIdentifiedUser(matchedUser);

          // Require 2 consecutive matching frames for the exact same identified employee
          if (kioskIdentifiedUserRef.current?.userId === matchedUser.userId) {
            consecutiveMatchesRef.current += 1;
          } else {
            kioskIdentifiedUserRef.current = matchedUser;
            consecutiveMatchesRef.current = 1;
          }

          if (consecutiveMatchesRef.current >= 2) {
            setStatus('matched');
            setFeedbackMessage(`Identity Verified: ${matchedUser.fullName}`);

            // Trigger attendance for identified employee
            if (
              autoMarkAttendanceRef.current &&
              !kioskAttendanceLockMapRef.current.has(matchedUser.userId)
            ) {
              kioskAttendanceLockMapRef.current.add(matchedUser.userId);

              try {
                const attResult = await attendanceService.markAttendance({
                  userId: matchedUser.userId,
                  matchConfidence: identResult.confidence,
                  verificationMethod: 'Face Recognition',
                });

                if (sessionRef.current !== currentSession) return;

                const logItem = {
                  id: Date.now(),
                  userName: matchedUser.fullName,
                  employeeId: matchedUser.employeeId,
                  timestamp: new Date().toLocaleTimeString(),
                  status: attResult.alreadyMarked ? 'Already Marked' : 'Marked',
                  success: !attResult.alreadyMarked,
                  confidence: identResult.confidence,
                };
                setRecognitionLogs((prev) => [logItem, ...prev.slice(0, 9)]);

                if (attResult.alreadyMarked) {
                  setStatus('already_marked');
                  setFeedbackMessage(`${matchedUser.fullName} has already marked attendance today.`);
                } else if (attResult.success) {
                  setStatus('matched');
                  setFeedbackMessage(attResult.message || `Attendance marked for ${matchedUser.fullName}`);
                  try {
                    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
                  } catch {}

                  if (onAttendanceSuccessRef.current) {
                    onAttendanceSuccessRef.current(attResult.record);
                  }
                } else {
                  kioskAttendanceLockMapRef.current.delete(matchedUser.userId);
                  setStatus('backend_error');
                  setFeedbackMessage('Attendance Not Marked: ' + (attResult.message || 'Server rejected'));
                }
              } catch (err) {
                if (sessionRef.current !== currentSession) return;
                console.error('Kiosk attendance error:', err);
                kioskAttendanceLockMapRef.current.delete(matchedUser.userId);
                setStatus('backend_error');
                setFeedbackMessage('Attendance Not Marked: ' + err.message);
              }
            }
          }
        } else {
          // Single-Employee Targeted Comparison Flow (Section 5)
          const enrolled = enrolledDescriptorsRef.current;

          if (!Array.isArray(enrolled) || enrolled.length === 0) {
            setStatus('unregistered');
            setFeedbackMessage('Face Not Registered');
            consecutiveMatchesRef.current = 0;
            return;
          }

          const matchResult = matchUserFace(
            detectionResult.descriptor,
            enrolled,
            matchThresholdRef.current
          );

          if (
            sessionRef.current !== currentSession ||
            activeUserIdRef.current !== currentUserId
          ) {
            return;
          }

          // Mismatch against authenticated user's enrolled template
          if (!matchResult.match) {
            consecutiveMatchesRef.current = 0;
            setRecognitionConfidence(matchResult.confidence);
            setStatus('rejected');
            setFeedbackMessage('Face Mismatch');
            return;
          }

          // Identity Match Verified
          setRecognitionConfidence(matchResult.confidence);
          consecutiveMatchesRef.current += 1;

          if (consecutiveMatchesRef.current >= 2) {
            if (!hasCompletedAttendanceRef.current) {
              setStatus('matched');
              setFeedbackMessage('Identity Verified');
            }

            // Step D: Trigger Attendance (with strict locking)
            if (
              autoMarkAttendanceRef.current &&
              currentUserId &&
              !attendanceSubmittedRef.current &&
              !hasCompletedAttendanceRef.current
            ) {
              attendanceSubmittedRef.current = true;

              try {
                const attResult = await attendanceService.markAttendance({
                  userId: currentUserId,
                  matchConfidence: matchResult.confidence,
                  verificationMethod: 'Face Recognition',
                });

                if (
                  sessionRef.current !== currentSession ||
                  activeUserIdRef.current !== currentUserId
                ) {
                  return;
                }

                const logItem = {
                  id: Date.now(),
                  userName: 'Verified User',
                  timestamp: new Date().toLocaleTimeString(),
                  status: attResult.alreadyMarked ? 'Already Marked' : 'Marked',
                  success: !attResult.alreadyMarked,
                  confidence: matchResult.confidence,
                };
                setRecognitionLogs((prev) => [logItem, ...prev.slice(0, 9)]);

                if (attResult.alreadyMarked) {
                  hasCompletedAttendanceRef.current = true;
                  attendanceSubmittedRef.current = true;
                  setStatus('already_marked');
                  setFeedbackMessage('You have already marked your attendance today.');
                } else if (attResult.success) {
                  hasCompletedAttendanceRef.current = true;
                  attendanceSubmittedRef.current = true;
                  setStatus('matched');
                  setFeedbackMessage(attResult.message || 'Identity Verified - Attendance marked successfully!');
                  try {
                    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
                  } catch {}

                  if (onAttendanceSuccessRef.current) {
                    onAttendanceSuccessRef.current(attResult.record);
                  }
                } else {
                  attendanceSubmittedRef.current = false;
                  setStatus('backend_error');
                  setFeedbackMessage('Attendance Not Marked: ' + (attResult.message || 'Server rejected'));
                }
              } catch (err) {
                if (
                  sessionRef.current !== currentSession ||
                  activeUserIdRef.current !== currentUserId
                ) {
                  return;
                }
                console.error('Attendance API error:', err);
                attendanceSubmittedRef.current = false;
                setStatus('backend_error');
                setFeedbackMessage('Attendance Not Marked: ' + err.message);
              }
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
  }, [isActive, modelsStatus, descriptorsStatus, targetUserId, organizationId, isKioskMode, videoRef]);

  // Reset Scanner
  const resetScanner = useCallback(() => {
    consecutiveMatchesRef.current = 0;
    setDetectedBox(null);
    setIdentifiedUser(null);
    kioskIdentifiedUserRef.current = null;

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
    identifiedUser,
    resetScanner,
  };
}
