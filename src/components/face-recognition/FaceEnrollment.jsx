import React, { useState, useRef, useEffect } from 'react';
import { Camera, Check, Shield, AlertTriangle, ArrowRight, RefreshCw, Lock, Sparkles, AlertCircle } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { detectFaceInVideo, loadFaceRecognitionModels, isValidDescriptor } from '../../services/faceRecognitionService';
import { userService } from '../../services/userService';

const STEPS = [
  { id: 1, title: 'Frontal Pose', prompt: 'Look directly into the camera' },
  { id: 2, title: 'Slight Left', prompt: 'Gently angle your head slightly to the left' },
  { id: 3, title: 'Slight Right', prompt: 'Gently angle your head slightly to the right' },
];

export function FaceEnrollment({ user, onComplete, onCancel }) {
  const { videoRef, isActive, error: cameraError, startCamera, stopCamera } = useCamera();

  const [currentStep, setCurrentStep] = useState(0); // 0 = Consent, 1..3 = Samples, 4 = Complete
  const [hasConsented, setHasConsented] = useState(false);
  const [samples, setSamples] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [feedback, setFeedback] = useState('Position your face clearly');
  const [isSaving, setIsSaving] = useState(false);

  // Live detection & alignment indicators
  const [liveDetection, setLiveDetection] = useState({
    modelsReady: false,
    faceDetected: false,
    isAligned: false,
    multipleFaces: false,
  });

  const inCapturePhase = currentStep >= 1 && currentStep <= 3;

  // Preload face recognition neural models on mount
  useEffect(() => {
    loadFaceRecognitionModels().then((res) => {
      setLiveDetection((prev) => ({ ...prev, modelsReady: res?.success ?? false }));
    });
  }, []);

  // Manage camera lifecycle strictly based on inCapturePhase boolean:
  // Starts once when entering capture phase (Step 1), stays alive throughout all 3 poses,
  // and cleanly stops when leaving capture phase (Step 4 completion, cancel, or unmount).
  // Notice: isActive and currentStep are intentionally NOT in this dependency array to eliminate restart loops!
  useEffect(() => {
    if (inCapturePhase) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [inCapturePhase, startCamera, stopCamera]);

  // Guaranteed unmount cleanup
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Real-time alignment and detection check while camera is active
  useEffect(() => {
    if (!inCapturePhase || !isActive) return;

    let isCancelled = false;
    let timerId = null;

    const checkFrame = async () => {
      if (isCancelled) return;
      if (!videoRef.current || videoRef.current.readyState < 2) {
        timerId = setTimeout(checkFrame, 300);
        return;
      }

      try {
        const result = await detectFaceInVideo(videoRef.current);
        if (!isCancelled) {
          setLiveDetection({
            modelsReady: !!result.modelsReady,
            faceDetected: !!result.detected,
            isAligned: !!result.isFaceAligned,
            multipleFaces: !!result.multipleFaces,
          });
        }
      } catch (err) {
        // Non-blocking frame analysis
      }

      if (!isCancelled) {
        timerId = setTimeout(checkFrame, 350);
      }
    };

    timerId = setTimeout(checkFrame, 250);

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [inCapturePhase, isActive, videoRef]);

  // Handle capturing an individual sample frame
  const handleCaptureSample = async () => {
    if (!videoRef.current || isCapturing) return;
    if (!hasConsented) {
      setFeedback('Biometric consent is mandatory prior to facial vector capture.');
      return;
    }

    setIsCapturing(true);
    setFeedback('Analyzing facial landmarks and extracting 128-d biometric embedding...');

    try {
      const result = await detectFaceInVideo(videoRef.current);

      if (!result.modelsReady) {
        setFeedback(result.message || 'Neural models are not loaded. Enrollment unavailable.');
        setIsCapturing(false);
        return;
      }

      if (!result.detected) {
        setFeedback(result.message || 'Face not detected. Position your face in view and retry.');
        setIsCapturing(false);
        return;
      }

      if (result.multipleFaces) {
        setFeedback('Multiple faces detected! Ensure you are alone in frame.');
        setIsCapturing(false);
        return;
      }

      // Check alignment for step 1 (frontal pose)
      if (currentStep === 1 && !result.isFaceAligned) {
        setFeedback('Please look directly forward at the camera for the frontal sample.');
        setIsCapturing(false);
        return;
      }

      if (!isValidDescriptor(result.descriptor)) {
        setFeedback('Captured descriptor is invalid. Please reposition and retry.');
        setIsCapturing(false);
        return;
      }

      // Valid genuine live biometric sample captured
      const newSamples = [...samples, result.descriptor];
      setSamples(newSamples);

      if (currentStep < 3) {
        const nextStepIndex = currentStep; // 1 -> index 1 (Slight Left)
        setCurrentStep(currentStep + 1);
        setFeedback(STEPS[nextStepIndex] ? STEPS[nextStepIndex].prompt : 'Reposition face');
      } else {
        // All 3 live samples captured - validate every descriptor before persistence
        const allValid = newSamples.length === 3 && newSamples.every(isValidDescriptor);
        if (!allValid) {
          throw new Error('One or more captured biometric samples failed integrity validation.');
        }

        setIsSaving(true);
        setFeedback('Securing and indexing verified biometric vectors...');

        const saveRes = await userService.registerUserFace({
          userId: user.id,
          descriptors: newSamples,
          consentedAt: new Date().toISOString(),
        });

        if (!saveRes || !saveRes.success) {
          throw new Error(saveRes?.message || 'Biometric storage failed. Please retry.');
        }

        setIsSaving(false);
        stopCamera();
        setCurrentStep(4);
      }
    } catch (err) {
      console.error('Enrollment error:', err);
      setFeedback('Capture error: ' + (err.message || 'Unknown error'));
    } finally {
      setIsCapturing(false);
    }
  };

  // Derive visual alignment state
  const isFaceReady =
    liveDetection.faceDetected &&
    !liveDetection.multipleFaces &&
    (currentStep > 1 || liveDetection.isAligned);

  // Compute live prompt
  let currentPrompt = feedback;
  if (!isCapturing && !isSaving) {
    if (!liveDetection.modelsReady) {
      currentPrompt = 'Loading neural models...';
    } else if (liveDetection.multipleFaces) {
      currentPrompt = 'Multiple faces detected! Please ensure you are alone in frame.';
    } else if (!liveDetection.faceDetected) {
      currentPrompt = 'Looking for face... Please position your face inside the oval.';
    } else if (currentStep === 1) {
      currentPrompt = liveDetection.isAligned
        ? 'Face aligned and ready! Click "Capture Sample 01".'
        : 'Please look directly forward at the camera.';
    } else if (currentStep === 2) {
      currentPrompt = 'Face detected. Gently angle head slightly left and click capture.';
    } else if (currentStep === 3) {
      currentPrompt = 'Face detected. Gently angle head slightly right and click capture.';
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-500" />
            Biometric Face Enrollment
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Register your facial descriptors for browser-based automated attendance.
          </p>
        </div>
        <span className="px-3 py-1 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 rounded-full text-xs font-semibold">
          Step {Math.min(currentStep, 3)} of 3
        </span>
      </div>

      {/* Step 0: Mandatory Biometric Consent (PRD Section 4.1 & 10.1) */}
      {currentStep === 0 && (
        <div className="py-6 space-y-6">
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Biometric Data Privacy & Consent Policy
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                  In compliance with organization privacy standards, only a 128-dimensional mathematical
                  descriptor (feature vector) will be saved. Your raw camera photographs are never uploaded
                  or stored on external servers. You can withdraw consent and delete your biometric vector at any
                  time from your Profile page.
                </p>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none group p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
            <input
              type="checkbox"
              checked={hasConsented}
              onChange={(e) => setHasConsented(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-brand-600 focus:ring-brand-500 dark:bg-slate-800"
            />
            <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              I explicitly consent to the collection and cryptographic processing of my facial biometric vector
              strictly for organizational attendance verification.
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              disabled={!hasConsented}
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-lg shadow-brand-500/25 transition"
            >
              <span>Continue to Camera</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 1 to 3: Multi-Sample Face Capture */}
      {currentStep >= 1 && currentStep <= 3 && (
        <div className="py-6 space-y-6">
          {cameraError && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Progress Indicators */}
          <div className="grid grid-cols-3 gap-2">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`p-3 rounded-xl border text-center transition ${
                  currentStep === step.id
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30'
                    : samples.length >= step.id
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Sample 0{step.id}
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">
                  {step.title}
                </div>
              </div>
            ))}
          </div>

          {/* Camera Frame Preview */}
          <div className="relative aspect-[4/3] rounded-2xl bg-black overflow-hidden border border-slate-800 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />

            {/* Dynamic Guide Oval */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`w-48 h-56 rounded-full border-2 transition-all duration-300 ${
                  liveDetection.multipleFaces
                    ? 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                    : isFaceReady
                    ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)]'
                    : 'border-dashed border-cyan-400/80 animate-pulse'
                }`}
              />
            </div>

            {/* Live Status Pill */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700 text-[11px] font-semibold text-white">
              <div
                className={`w-2 h-2 rounded-full ${
                  liveDetection.multipleFaces
                    ? 'bg-rose-500 animate-ping'
                    : isFaceReady
                    ? 'bg-emerald-400'
                    : liveDetection.faceDetected
                    ? 'bg-amber-400'
                    : 'bg-cyan-400 animate-pulse'
                }`}
              />
              <span>
                {liveDetection.multipleFaces
                  ? 'Multiple Faces'
                  : isFaceReady
                  ? 'Face Aligned'
                  : liveDetection.faceDetected
                  ? 'Face Detected'
                  : 'Detecting...'}
              </span>
            </div>

            {/* Instruction tag */}
            <div className="absolute bottom-3 left-4 right-4 bg-slate-900/85 backdrop-blur-md p-2.5 rounded-xl text-center text-xs text-white border border-slate-700">
              {currentPrompt}
            </div>
          </div>

          {/* Capture Trigger Button */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setSamples([]);
                setCurrentStep(1);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Samples
            </button>

            <button
              type="button"
              disabled={isCapturing || isSaving}
              onClick={handleCaptureSample}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-lg transition"
            >
              <Camera className="w-4 h-4" />
              <span>{isCapturing ? 'Analyzing...' : `Capture Sample 0${currentStep}`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Completed Confirmation */}
      {currentStep === 4 && (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Check className="w-8 h-8" />
          </div>
          <h4 className="text-xl font-bold text-slate-900 dark:text-white">Face Enrolled Successfully!</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Your biometric descriptors have been securely indexed. You can now use instant facial recognition to mark daily attendance.
          </p>
          <div className="pt-4">
            <button
              type="button"
              onClick={onComplete}
              className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold shadow-lg transition"
            >
              Proceed to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
