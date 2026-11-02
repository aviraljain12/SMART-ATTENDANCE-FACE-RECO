import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { FaceEnrollment } from '../../components/face-recognition/FaceEnrollment';
import { ShieldCheck, ShieldAlert, Trash2, RefreshCw, CheckCircle2, User, Mail, Building, IdCard } from 'lucide-react';

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState('');

  const handleWithdrawConsent = async () => {
    if (!window.confirm('Are you sure you want to withdraw biometric consent and delete your stored face descriptors? You will not be able to mark attendance until you re-enroll.')) {
      return;
    }
    try {
      await userService.withdrawBiometricConsent(profile.id);
      await refreshProfile();
      setDeleteNotice('Biometric vectors successfully deleted and consent withdrawn.');
      setTimeout(() => setDeleteNotice(''), 4000);
    } catch (err) {
      alert('Error withdrawing consent: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Personal Profile & Biometric Security
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review your organizational identity, privacy consent, and enrolled facial descriptors.
        </p>
      </div>

      {deleteNotice && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-600 dark:text-rose-400">
          {deleteNotice}
        </div>
      )}

      {/* Member Identity Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-6">
        <img
          src={profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
          alt={profile?.full_name}
          className="w-24 h-24 rounded-full object-cover border-4 border-slate-100 dark:border-slate-800 shadow-md shrink-0"
        />
        <div className="space-y-2 text-center sm:text-left flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{profile?.full_name}</h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-300 w-fit mx-auto sm:mx-0">
              {profile?.role}
            </span>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Employee ID: <span className="font-bold text-slate-700 dark:text-slate-300">{profile?.employee_id}</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {profile?.department} • LexCorp Global Organization
          </div>
        </div>
      </div>

      {/* Biometric Status Section (PRD Section 10.1 Biometric Data Protection & TC-14) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-500" />
              Facial Biometric Status
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Encrypted 128-dimensional facial representation stored in Supabase database.
            </p>
          </div>

          {profile?.has_face_registered ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              Biometrics Enrolled ✓
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              Not Enrolled
            </span>
          )}
        </div>

        {isEnrolling ? (
          <FaceEnrollment
            user={profile}
            onComplete={async () => {
              setIsEnrolling(false);
              await refreshProfile();
            }}
            onCancel={() => setIsEnrolling(false)}
          />
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <p>
                <strong>Privacy Guarantee:</strong> Only mathematical descriptors are preserved. Raw camera
                imagery is analyzed in-browser and immediately discarded from memory after vector extraction.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => setIsEnrolling(true)}
                className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/25 flex items-center gap-2 transition"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{profile?.has_face_registered ? 'Re-Enroll Face Samples' : 'Enroll Biometrics Now'}</span>
              </button>

              {profile?.has_face_registered && (
                <button
                  onClick={handleWithdrawConsent}
                  className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-900/60 flex items-center gap-2 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Withdraw Consent & Delete Descriptors (TC-14)</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
