import React, { useState, useRef, useEffect } from 'react';
import { Camera, Check, Shield, AlertTriangle, ArrowRight, RefreshCw, Lock } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { detectFaceInVideo, loadFaceRecognitionModels } from '../../services/faceRecognitionService';
import { userService } from '../../services/userService';

const STEPS = [
  { id: 1, title: 'Frontal Pose', prompt: 'Look directly into the camera' },
  { id: 2, title: 'Slight Left', prompt: 'Gently angle your head slightly to the left' },
  { id: 3, title: 'Slight Right', prompt: 'Gently angle your head slightly to the right' },
];

export function FaceEnrollment({ user, onComplete, onCancel }) {
  const { videoRef, isActive, error, startCamera, stopCamera } = useCamera();

  const [currentStep, setCurrentStep] = useState(0); // 0 = Consent, 1..3 = Samples, 4 = Complete
  const [hasConsented, setHasConsented] = useState(false);
  const [samples, setSamples] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [feedback, setFeedback] = useState('Position your face clearly');
  const [isSaving, setIsSaving] = useState(false);

  // Preload models
  useEffect(() => {
    loadFaceRecognitionModels();
  }, []);

  // Start camera when entering capture phase
  useEffect(() => {
    if (currentStep >= 1 && currentStep <= 3 && !isActive) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [currentStep, isActive, startCamera, stopCamera]);

  const handleCaptureSample = async () => {
    if (!videoRef.current || isCapturing) return;
    setIsCapturing(true);
    setFeedback('Analyzing facial landmarks...');

    try {
      const result = await detectFaceInVideo(videoRef.current);

      if (!result.modelsReady) {
        setFeedback(result.message || 'Neural models are not loaded. Enrollment unavailable.');
        setIsCapturing(false);
        return;
      }

      if (!result.detected) {
        setFeedback(result.message || 'Face not detected. Look directly at the lens.');
        setIsCapturing(false);
        return;
      }

      if (result.multipleFaces) {
        setFeedback('Multiple faces detected. Ensure you are alone in frame.');
        setIsCapturing(false);
        return;
      }

      // Valid sample captured
      const newSamples = [...samples, result.descriptor];
      setSamples(newSamples);

      if (currentStep < 3) {
        setCurrentStep(currentStep + 1);
        setFeedback(STEPS[currentStep].prompt);
      } else {
        // All 3 samples captured, save to DB!
        setIsSaving(true);
        setFeedback('Encrypting and securing biometric descriptors...');
        await userService.registerUserFace({
          userId: user.id,
          descriptors: newSamples,
          consentedAt: new Date().toISOString(),
        });
        setIsSaving(false);
        setCurrentStep(4);
        stopCamera();
        if (onComplete) onComplete();
      }
    } catch (err) {
      setFeedback('Capture error: ' + err.message);
    } finally {
      setIsCapturing(false);
    }
  };

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
          {/* Progress Indicators */}
          <div className="grid grid-cols-3 gap-2">
            {STEPS.map((step, idx) => (
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
            {/* Guide circle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-56 rounded-full border-2 border-dashed border-cyan-400 animate-pulse" />
            </div>

            {/* Instruction tag */}
            <div className="absolute bottom-3 left-4 right-4 bg-slate-900/80 backdrop-blur-md p-2.5 rounded-xl text-center text-xs text-white border border-slate-700">
              {feedback}
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
