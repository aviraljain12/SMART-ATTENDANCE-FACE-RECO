import React, { useState } from 'react';
import { AttendanceScanner } from '../../components/face-recognition/AttendanceScanner';
import { useAuth } from '../../hooks/useAuth';
import { Camera, Sun, Moon, ArrowLeft } from 'lucide-react';

export function LiveKiosk({ onBack }) {
  const { profile } = useAuth();
  const [kioskTheme, setKioskTheme] = useState('dark');

  return (
    <div className={`rounded-3xl p-6 sm:p-8 border transition-all ${
      kioskTheme === 'dark'
        ? 'bg-cyber-dark border-cyber-border text-white shadow-2xl'
        : 'bg-white border-slate-200 text-slate-900 shadow-xl'
    }`}>
      {/* Kiosk Control Header */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Live Attendance Terminal
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ACTIVE SCANNER
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated high-speed camera identification for arriving employees and students.
            </p>
          </div>
        </div>

        {/* Theme Toggler for Kiosk (Switch between Screenshot 1 and Screenshot 2) */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">Theme:</span>
          <button
            onClick={() => setKioskTheme(kioskTheme === 'dark' ? 'light' : 'dark')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition ${
              kioskTheme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-cyan-400'
                : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}
          >
            {kioskTheme === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            <span>{kioskTheme === 'dark' ? 'Cyber Mode' : 'Clean Mode'}</span>
          </button>
        </div>
      </div>

      {/* Main Scanner Widget - Organization Kiosk Identification */}
      <AttendanceScanner
        organizationId={profile?.organization_id}
        theme={kioskTheme}
        isKioskMode={true}
      />
    </div>
  );
}
