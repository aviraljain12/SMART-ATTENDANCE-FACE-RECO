import React, { useState } from 'react';
import { AttendanceScanner } from '../../components/face-recognition/AttendanceScanner';
import { useAuth } from '../../hooks/useAuth';
import { FaceEnrollment } from '../../components/face-recognition/FaceEnrollment';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export function MarkAttendancePage({ onBack, onComplete }) {
  const { profile, refreshProfile } = useAuth();
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Biometric Attendance Check-In
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Position your face in front of the camera to verify your identity and mark attendance.
            </p>
          </div>
        </div>
      </div>

      {/* Unenrolled Notice Alert if user hasn't enrolled face */}
      {!profile?.has_face_registered && !showEnrollModal && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Face Biometrics Not Yet Enrolled
              </div>
              <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                You need to register your facial descriptors before marking attendance.
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowEnrollModal(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
          >
            Enroll Face Now
          </button>
        </div>
      )}

      {showEnrollModal ? (
        <FaceEnrollment
          user={profile}
          onComplete={async () => {
            setShowEnrollModal(false);
            await refreshProfile();
          }}
          onCancel={() => setShowEnrollModal(false)}
        />
      ) : (
        <div className="bg-slate-950 rounded-3xl p-4 sm:p-6 shadow-2xl border border-slate-800">
          <AttendanceScanner
            currentUser={profile}
            theme="dark"
            onAttendanceSuccess={onComplete}
          />
        </div>
      )}
    </div>
  );
}
