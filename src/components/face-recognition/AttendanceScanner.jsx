import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaceCamera } from './FaceCamera';
import { useCamera } from '../../hooks/useCamera';
import { useFaceRecognition } from '../../hooks/useFaceRecognition';
import { Users, UserCheck, Calendar, Clock, CheckCircle2, History, Search } from 'lucide-react';
import { getCurrentLiveTime, getTodayOrgDateString, formatOrgDate } from '../../utils/dateUtils';
import { attendanceService } from '../../services/attendanceService';

export function AttendanceScanner({
  currentUser,
  organizationId,
  theme = 'dark', // 'dark' | 'light'
  onAttendanceSuccess,
  isKioskMode = false,
}) {
  const [currentTime, setCurrentTime] = useState(getCurrentLiveTime());
  const [stats, setStats] = useState({ total: 6, present: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All Departments');

  // Camera Hook
  const {
    videoRef,
    isActive,
    permissionState,
    devices,
    selectedDeviceId,
    error,
    startCamera,
    stopCamera,
    switchDevice,
  } = useCamera();

  // Prop ref to prevent identity shifts from restarting hooks
  const onAttendanceSuccessPropRef = useRef(onAttendanceSuccess);
  useEffect(() => {
    onAttendanceSuccessPropRef.current = onAttendanceSuccess;
  }, [onAttendanceSuccess]);

  const refreshStats = useCallback(async () => {
    try {
      const data = await attendanceService.getAdminDashboardMetrics();
      setStats({
        total: data?.totalEmployees || 6,
        present: data?.presentToday || 0,
      });
    } catch (err) {
      console.warn('Could not refresh stats:', err);
    }
  }, []);

  const handleAttendanceSuccess = useCallback((record) => {
    if (onAttendanceSuccessPropRef.current) {
      try {
        onAttendanceSuccessPropRef.current(record);
      } catch (err) {
        console.error('onAttendanceSuccess callback error:', err);
      }
    }
    refreshStats();
  }, [refreshStats]);

  const effectiveOrgId = organizationId || currentUser?.organization_id;

  // Face Recognition Hook (Supports Targeted Employee Mode & Organization Kiosk Mode)
  const {
    status,
    feedbackMessage,
    detectedBox,
    recognitionLogs,
    identifiedUser,
    resetScanner,
  } = useFaceRecognition({
    videoRef,
    isActive,
    targetUserId: isKioskMode ? null : currentUser?.id,
    organizationId: effectiveOrgId,
    isKioskMode,
    autoMarkAttendance: true,
    onAttendanceSuccess: handleAttendanceSuccess,
  });

  const handleToggleCamera = useCallback(
    (start) => {
      if (start) {
        startCamera(selectedDeviceId);
      } else {
        stopCamera();
      }
    },
    [startCamera, stopCamera, selectedDeviceId]
  );

  // Keep live clock ticking every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentLiveTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const isDark = theme === 'dark';

  // Filter real recognition logs
  const filteredLogs = recognitionLogs.filter((log) => {
    if (selectedDept !== 'All Departments' && log.department && log.department !== selectedDept) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = log.userName?.toLowerCase().includes(q);
      const matchId = log.employeeId?.toLowerCase().includes(q);
      if (!matchName && !matchId) return false;
    }
    return true;
  });

  const displayUserName = isKioskMode
    ? (identifiedUser ? identifiedUser.fullName : 'Face Scanner')
    : (currentUser?.full_name || 'Employee');

  return (
    <div className={`space-y-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
      {/* Top Metric Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Employees */}
        <div className={`p-4 rounded-2xl border flex items-center space-x-3.5 transition-all ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
        }`}>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight">{stats.total}</div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Members</div>
          </div>
        </div>

        {/* Present Today */}
        <div className={`p-4 rounded-2xl border flex items-center space-x-3.5 transition-all ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
        }`}>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-500">{stats.present}</div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Present Today</div>
          </div>
        </div>

        {/* Current Date */}
        <div className={`p-4 rounded-2xl border flex items-center space-x-3.5 transition-all ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
        }`}>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm sm:text-base font-bold tracking-tight truncate">
              {formatOrgDate(getTodayOrgDateString())}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Current Date</div>
          </div>
        </div>

        {/* Current Time */}
        <div className={`p-4 rounded-2xl border flex items-center space-x-3.5 transition-all ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
        }`}>
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm sm:text-base font-mono font-bold tracking-tight text-pink-500">
              {currentTime}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Live Time</div>
          </div>
        </div>
      </div>

      {/* Main Scanner Section (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Camera */}
        <div className="lg:col-span-8">
          <FaceCamera
            videoRef={videoRef}
            isActive={isActive}
            permissionState={permissionState}
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            onSwitchDevice={switchDevice}
            onToggleCamera={handleToggleCamera}
            error={error}
            detectedBox={detectedBox}
            status={status}
            feedbackMessage={feedbackMessage}
            userName={displayUserName}
            theme={theme}
          />
        </div>

        {/* Right Column: Genuine Recognitions & Department Filter */}
        <div className={`lg:col-span-4 rounded-2xl border p-4 sm:p-5 flex flex-col h-full min-h-[460px] ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
        }`}>
          {/* Department Selector */}
          <div className="mb-4">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Department
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className={`w-full text-xs rounded-xl px-3 py-2 border font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <option value="All Departments">All Departments</option>
              <option value="Engineering Department">Engineering Department</option>
              <option value="Design & UX">Design & UX</option>
              <option value="Product Management">Product Management</option>
              <option value="Operations">Operations</option>
            </select>
          </div>

          {/* Search bar */}
          <div className="relative mb-4">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search verified name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          {/* Recent Recognitions Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-brand-500" />
              Verified Recognitions
            </span>
            <span className="text-[11px] font-mono text-emerald-400">Live</span>
          </div>

          {/* Recognitions List: Shows ONLY actual verified check-in events */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 mt-2 space-y-1 max-h-[300px]">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <p>No verified attendance recognitions recorded yet today.</p>
                <p className="text-[10px] text-slate-500 mt-1">Arriving employees will appear here upon genuine face verification.</p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-brand-400">{log.userName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {log.status} {log.employeeId ? `• ${log.employeeId}` : ''}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">{log.timestamp}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
