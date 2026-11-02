import React from 'react';
import { Camera, CameraOff, Video, AlertCircle, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function FaceCamera({
  videoRef,
  isActive,
  permissionState,
  devices,
  selectedDeviceId,
  onSwitchDevice,
  onToggleCamera,
  error,
  detectedBox,
  status, // idle, scanning, matched, already_marked, rejected, multiple_faces
  feedbackMessage,
  userName = 'Employee',
  theme = 'dark', // 'dark' (Screenshot 2) or 'light' (Screenshot 1)
}) {
  const isDark = theme === 'dark';

  return (
    <div className={`relative rounded-2xl overflow-hidden border transition-all ${
      isDark ? 'bg-cyber-dark border-cyber-border text-white shadow-2xl' : 'bg-slate-900 border-slate-700 text-white shadow-xl'
    }`}>
      {/* Top Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
            isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400'
          }`}>
            <span className={`w-2 h-2 rounded-full mr-1.5 ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            {isActive ? 'Live Stream' : 'Camera Off'}
          </span>
          <span className="text-xs text-slate-400 hidden sm:inline">Browser Biometrics</span>
        </div>

        {/* Live Status indicator */}
        {isActive && (
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="text-xs font-mono font-medium tracking-wider text-rose-400 uppercase">REC</span>
          </div>
        )}
      </div>

      {/* Main Video Viewport */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${
            isActive ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Permission Denied / Error State */}
        {error && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 backdrop-blur-sm">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-3 animate-bounce" />
            <h4 className="text-lg font-bold text-white mb-1">Camera Access Issue</h4>
            <p className="text-sm text-slate-300 max-w-sm mb-4">{error}</p>
            <button
              onClick={() => onToggleCamera(true)}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold transition"
            >
              Grant Permission & Retry
            </button>
          </div>
        )}

        {/* Inactive Camera State */}
        {!isActive && !error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-slate-900/90">
            <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-4 text-slate-400">
              <CameraOff className="w-8 h-8" />
            </div>
            <h4 className="text-base font-semibold text-white mb-1">Camera Stream Inactive</h4>
            <p className="text-sm text-slate-400 max-w-xs mb-4">
              Activate your camera to enable automatic biometric facial identification.
            </p>
            <button
              onClick={() => onToggleCamera(true)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-xl shadow-lg transition-transform active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>Start Camera</span>
            </button>
          </div>
        )}

        {/* Biometric Scanning Overlay Elements */}
        {isActive && (
          <>
            {/* Ambient Laser Scan Line */}
            <div className="laser-line pointer-events-none" />

            {/* Scanning Guide / Center Frame */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-72 sm:w-80 sm:h-88 border-2 border-dashed border-cyan-400/40 rounded-3xl relative">
                {/* Corner Accents */}
                <span className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg" />
                <span className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-cyan-400 rounded-tr-lg" />
                <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-cyan-400 rounded-bl-lg" />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-cyan-400 rounded-br-lg" />
              </div>
            </div>

            {/* Dynamic Detected Face Bounding Box */}
            <AnimatePresence>
              {detectedBox && (() => {
                const vw = detectedBox.videoWidth || 640;
                const vh = detectedBox.videoHeight || 480;
                // Mirrored coordinate because video is transformed with scale-x-[-1]
                const leftPercent = Math.max(5, Math.min(85, ((vw - (detectedBox.x + detectedBox.width)) / vw) * 100));
                const topPercent = Math.max(5, Math.min(85, (detectedBox.y / vh) * 100));
                const widthPercent = Math.max(15, Math.min(80, (detectedBox.width / vw) * 100));
                const heightPercent = Math.max(20, Math.min(85, (detectedBox.height / vh) * 100));

                return (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    style={{
                      position: 'absolute',
                      left: `${leftPercent}%`,
                      top: `${topPercent}%`,
                      width: `${widthPercent}%`,
                      height: `${heightPercent}%`,
                    }}
                    className={`pointer-events-none rounded-2xl border-2 transition-all duration-150 ${
                      status === 'matched'
                        ? 'border-emerald-400 shadow-[0_0_35px_rgba(52,211,153,0.7)]'
                        : status === 'already_marked'
                        ? 'border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.6)]'
                        : status === 'multiple_faces' || status === 'rejected'
                        ? 'border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.6)]'
                        : 'border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.6)]'
                    }`}
                  >
                    {/* Corner Reticle Accents for Biometric aesthetic */}
                    <span className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white rounded-tl" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white rounded-tr" />
                    <span className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white rounded-bl" />
                    <span className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white rounded-br" />

                    {/* Name Tag above box */}
                    <div
                      className={`absolute -top-7 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded text-xs font-mono font-bold whitespace-nowrap shadow-md ${
                        status === 'matched'
                          ? 'bg-emerald-500 text-black'
                          : status === 'already_marked'
                          ? 'bg-amber-400 text-black'
                          : status === 'multiple_faces' || status === 'rejected'
                          ? 'bg-rose-500 text-white'
                          : status === 'unregistered' || status === 'alignment_required'
                          ? 'bg-amber-400 text-black'
                          : 'bg-cyan-500 text-black'
                      }`}
                    >
                      {status === 'already_marked'
                        ? `${userName} - Already Marked`
                        : status === 'matched'
                        ? `${userName} - Verified ✓`
                        : status === 'unregistered'
                        ? 'Face Not Registered'
                        : status === 'alignment_required'
                        ? 'Face Forward'
                        : status === 'rejected'
                        ? 'Face Mismatch'
                        : status === 'multiple_faces'
                        ? 'Multiple Faces'
                        : userName}
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Bottom Feedback Notification Bar */}
            <div className="absolute bottom-3 left-3 right-3 z-20">
              <div
                className={`p-3 rounded-xl backdrop-blur-md border text-xs sm:text-sm font-medium flex items-center justify-between transition-all ${
                  status === 'matched'
                    ? 'bg-emerald-950/85 border-emerald-500/50 text-emerald-200'
                    : status === 'already_marked'
                    ? 'bg-amber-950/85 border-amber-500/50 text-amber-200'
                    : status === 'multiple_faces' || status === 'rejected' || status === 'models_error' || status === 'backend_error'
                    ? 'bg-rose-950/85 border-rose-500/50 text-rose-200'
                    : status === 'unregistered' || status === 'alignment_required'
                    ? 'bg-amber-950/85 border-amber-500/50 text-amber-200'
                    : 'bg-slate-900/80 border-slate-700/80 text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {status === 'matched' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : status === 'models_error' || status === 'backend_error' || status === 'multiple_faces' ? (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : status === 'loading_models' || status === 'loading_descriptors' ? (
                    <RefreshCw className="w-4 h-4 text-brand-400 animate-spin shrink-0" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                  <span>{feedbackMessage}</span>
                </div>
                {status === 'scanning' && (
                  <span className="text-[11px] font-mono text-cyan-400 animate-pulse">Scanning...</span>
                )}
                {(status === 'loading_models' || status === 'loading_descriptors') && (
                  <span className="text-[11px] font-mono text-brand-400 animate-pulse">Loading...</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Camera Controls Footer (Matches Screenshot 2 footer) */}
      <div className={`p-4 flex flex-wrap items-center justify-between gap-3 border-t ${
        isDark ? 'bg-slate-950/80 border-cyber-border' : 'bg-slate-900 border-slate-800'
      }`}>
        {/* Device Selector Dropdown */}
        <div className="flex items-center space-x-2 flex-1 min-w-[200px]">
          <Video className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedDeviceId}
            onChange={(e) => onSwitchDevice(e.target.value)}
            disabled={!isActive || devices.length === 0}
            className="w-full max-w-xs text-xs bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {devices.length === 0 && <option value="">Integrated Camera (Default)</option>}
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </div>

        {/* Start / Stop Toggle Button */}
        <button
          onClick={() => onToggleCamera(!isActive)}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            isActive
              ? 'bg-rose-900/40 hover:bg-rose-900/70 text-rose-300 border border-rose-700/50'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
          }`}
        >
          {isActive ? 'Stop Camera' : 'Start Camera'}
        </button>
      </div>
    </div>
  );
}
