import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  TrendingUp,
  UserCheck,
  ArrowRight,
  ScanFace,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { attendanceService } from '../../services/attendanceService';
import { getTodayOrgDateString, formatOrgDate, formatOrgTime } from '../../utils/dateUtils';

export function EmployeeDashboard({ onNavigateToScanner }) {
  const { profile } = useAuth();
  const [todayRecord, setTodayRecord] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!profile) return;
      try {
        const today = await attendanceService.getTodayAttendance(profile.id);
        const records = await attendanceService.getEmployeeHistory(profile.id);
        setTodayRecord(today);
        setHistory(records);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profile]);

  const isPresentToday = Boolean(todayRecord);

  return (
    <div className="space-y-6">
      {/* Welcome Banner matching Screenshot 4 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Good afternoon, {profile?.full_name?.split(' ')[0] || 'User'}!
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            You have 2 leave request pending • Attendance automatically synced with Supabase Cloud
          </p>
        </div>

        {/* Quick Date pill */}
        <div className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs text-slate-600 dark:text-slate-300">
          <Calendar className="w-4 h-4 text-brand-500" />
          <span className="font-semibold">{formatOrgDate(getTodayOrgDateString())}</span>
        </div>
      </div>

      {/* Primary Row: Today's Status & Average Cards (Matches Screenshot 4) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Today's Attendance Card */}
        <div className="md:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-bold text-slate-900 dark:text-white">Today</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                isPresentToday
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              }`}>
                {isPresentToday ? 'Present' : 'Absent'}
              </span>
            </div>

            <div className="flex items-center gap-4 my-3">
              <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100 dark:text-slate-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={isPresentToday ? 'text-emerald-500' : 'text-amber-500'}
                    strokeDasharray={isPresentToday ? '100, 100' : '67, 100'}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute text-center">
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                    {isPresentToday ? '100%' : '67%'}
                  </div>
                  <div className="text-[9px] text-slate-400 font-medium">in office</div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                  {isPresentToday
                    ? `Marked via Face Recognition at ${formatOrgTime(todayRecord?.check_in_time)}`
                    : 'You have not marked yourself as present today!'}
                </p>
                {!isPresentToday && (
                  <p className="text-xs text-amber-500 font-medium mt-1">
                    Time left to check-in: 56m 44s
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4">
            {isPresentToday ? (
              <div className="w-full py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Attendance Logged For Today</span>
              </div>
            ) : (
              <button
                onClick={onNavigateToScanner}
                className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-brand-500/25 flex items-center justify-center space-x-2 transition-all transform active:scale-98"
              >
                <ScanFace className="w-4 h-4" />
                <span>Mark Present with Face</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 4 Average Metrics Cards (Matches Screenshot 4 center) */}
        <div className="md:col-span-7 grid grid-cols-2 gap-4">
          {/* Average Hours */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-500 flex items-center justify-center mb-2">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Average hours</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">7h 17mins</div>
            </div>
          </div>

          {/* Average Check-in */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-500 flex items-center justify-center mb-2">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Average check-in</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">10:33 AM</div>
            </div>
          </div>

          {/* On-Time Arrival */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 flex items-center justify-center mb-2">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">On-time arrival</div>
              <div className="text-xl font-bold text-emerald-500 mt-1">98.56 %</div>
            </div>
          </div>

          {/* Average Check-out */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-500 flex items-center justify-center mb-2">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Average check-out</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">19:12 PM</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: My Attendance Gauge & Team Table (Matches Screenshot 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Attendance Breakdown Card */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">My Attendance</h3>
            <span className="text-xs text-brand-500 font-semibold cursor-pointer hover:underline">View Stats</span>
          </div>

          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" strokeWidth="4" stroke="currentColor" className="text-slate-100 dark:text-slate-800" fill="none" />
                <circle cx="18" cy="18" r="14" strokeWidth="4" strokeDasharray="80, 100" strokeLinecap="round" stroke="currentColor" className="text-emerald-500" fill="none" />
                <circle cx="18" cy="18" r="14" strokeWidth="4" strokeDasharray="15, 100" strokeDashoffset="-80" strokeLinecap="round" stroke="currentColor" className="text-amber-500" fill="none" />
              </svg>
              <div className="absolute text-center">
                <div className="text-xl font-extrabold text-slate-900 dark:text-white">1,434</div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">/ 1500 Days</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mt-4 w-full px-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-500 dark:text-slate-400">1,031 on time</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span className="text-slate-500 dark:text-slate-400">191 remote</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-slate-500 dark:text-slate-400">212 late</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="text-slate-500 dark:text-slate-400">66 absent</span>
              </div>
            </div>

            <div className="mt-4 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Better than 91.3% employees this quarter!</span>
            </div>
          </div>
        </div>

        {/* Working History Table */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Working History</h3>
              <span className="text-xs text-slate-400 font-medium">Last 5 Days</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {/* Row 1 */}
              <div className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold">
                    {new Date().getDate()}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">Today</div>
                    <div className="text-[11px] text-slate-400">
                      {isPresentToday ? 'Face Recognition' : 'Pending Check-in'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {isPresentToday ? formatOrgTime(todayRecord?.check_in_time) : '--:--'}
                  </div>
                  <div className={`text-[10px] font-bold ${isPresentToday ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {isPresentToday ? 'Present' : 'Not marked'}
                  </div>
                </div>
              </div>

              {/* Sample History rows */}
              <div className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold">
                    01
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">Nov 01, 2026</div>
                    <div className="text-[11px] text-slate-400">Face Recognition</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-slate-700 dark:text-slate-300">09:12 AM</div>
                  <div className="text-[10px] font-bold text-emerald-500">Present (On Time)</div>
                </div>
              </div>

              <div className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold">
                    31
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">Oct 31, 2026</div>
                    <div className="text-[11px] text-slate-400">Face Recognition</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-slate-700 dark:text-slate-300">09:05 AM</div>
                  <div className="text-[10px] font-bold text-emerald-500">Present (On Time)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-right">
            <button
              onClick={() => onNavigateToScanner('history')}
              className="text-xs font-bold text-brand-500 hover:text-brand-600 inline-flex items-center gap-1"
            >
              <span>View Full Attendance Log</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
