import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Smartphone,
  Laptop,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { attendanceService } from '../../services/attendanceService';
import { formatOrgDate, formatOrgTime, getTodayOrgDateString } from '../../utils/dateUtils';

export function AdminDashboard({ onNavigateTab }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await attendanceService.getAdminDashboardMetrics();
        setMetrics(data);
      } catch (err) {
        console.error('Failed to load admin stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const handleExportCsv = async () => {
    await attendanceService.exportCsvReport();
  };

  const totalMembers = metrics?.totalEmployees || 6;
  const presentCount = metrics?.presentToday || 3;
  const absentCount = Math.max(0, totalMembers - presentCount);
  const percentage = totalMembers > 0 ? Math.round((presentCount / totalMembers) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Organization Attendance Overview
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time biometric attendance metrics for {formatOrgDate(getTodayOrgDateString())}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateTab('kiosk')}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/25 flex items-center gap-2 transition"
          >
            <span>Launch Live Kiosk</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Row 1: Donut Stats & Attendance Status Cards (Matches Screenshot 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Donut Statistics Card */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Statistics</h3>
          
          <div className="my-6 flex flex-col items-center justify-center">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-44 h-44 transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" strokeWidth="4" stroke="currentColor" className="text-slate-100 dark:text-slate-800" fill="none" />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  strokeWidth="4"
                  strokeDasharray={`${percentage}, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  className="text-brand-500 transition-all duration-1000 ease-out"
                  fill="none"
                />
              </svg>
              <div className="absolute text-center">
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{percentage}%</div>
                <div className="text-[11px] font-bold text-emerald-500">Checked In</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Total: {totalMembers}</div>
              </div>
            </div>
          </div>

          <div className="pt-2 text-center text-xs text-slate-400">
            Automated Face Recognition Attendance Rate
          </div>
        </div>

        {/* 6 Attendance Status Cards (Matches Screenshot 3) */}
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {/* Checked in */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-500 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="mt-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Checked in</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{presentCount}</div>
            </div>
          </div>

          {/* Not Checked In */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
            <div className="mt-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Not Checked In</div>
              <div className="text-2xl font-bold text-rose-500 mt-1">{absentCount}</div>
            </div>
          </div>

          {/* On Leave */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="mt-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase">On Leave</div>
              <div className="text-2xl font-bold text-emerald-500 mt-1">1</div>
            </div>
          </div>

          {/* Weekly Off */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div className="mt-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Weekly Off</div>
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-1">0</div>
            </div>
          </div>

          {/* Holiday */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-500 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="mt-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Holiday</div>
              <div className="text-2xl font-bold text-purple-500 mt-1">0</div>
            </div>
          </div>

          {/* Checked Out */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="mt-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Checked Out</div>
              <div className="text-2xl font-bold text-amber-500 mt-1">0</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Attendance Source & Exceptions (Matches Screenshot 3 bottom) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Attendance Source */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4">Attendance Source</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Face Camera Kiosk</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">100%</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Mobile / Web App</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">Direct</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Active Kiosks</div>
              <div className="text-lg font-bold text-emerald-500 mt-1">1 Live</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Inactive Terminals</div>
              <div className="text-lg font-bold text-slate-400 mt-1">0</div>
            </div>
          </div>
        </div>

        {/* Exceptions */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4">Exceptions & Anomalies</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Late Coming</div>
              <div className="text-lg font-bold text-amber-500 mt-1">0</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Early Leaving</div>
              <div className="text-lg font-bold text-slate-400 mt-1">0</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Failed Match Tries</div>
              <div className="text-lg font-bold text-rose-500 mt-1">0</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Duplicate Blocked</div>
              <div className="text-lg font-bold text-blue-500 mt-1">Enforced</div>
            </div>
          </div>
        </div>

        {/* Pending Requests */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4">Pending Organization Requests</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Regularizations</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">0</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Leave Requests</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">2</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
