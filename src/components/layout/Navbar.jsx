import React from 'react';
import { Sun, Moon, Search, Bell, Shield, User, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getCurrentLiveTime } from '../../utils/dateUtils';

export function Navbar({ isDark, onToggleDark, onOpenMobileMenu }) {
  const { profile, isAdmin, switchDemoRole } = useAuth();
  const [liveTime, setLiveTime] = React.useState(getCurrentLiveTime());

  React.useEffect(() => {
    const timer = setInterval(() => setLiveTime(getCurrentLiveTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors duration-200">
      {/* Left Search / Breadcrumb */}
      <div className="flex items-center space-x-4 flex-1 max-w-md">
        <div className="relative w-full hidden sm:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search records, members, logs..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Quick Demo Switcher Pill (PRD MVP feature for instant role evaluation) */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <span className="hidden md:inline px-2 text-slate-400 font-medium">Demo Role:</span>
          <button
            onClick={() => switchDemoRole('employee')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              !isAdmin ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Employee
          </button>
          <button
            onClick={() => switchDemoRole('admin')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              isAdmin ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Admin
          </button>
        </div>

        {/* Live Clock Pill */}
        <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{liveTime} (IST)</span>
        </div>

        {/* Theme Toggle (Screenshot 2 Cyber vs Screenshot 3/4 Clean) */}
        <button
          onClick={onToggleDark}
          title={isDark ? 'Switch to Light Theme' : 'Switch to Cyber Dark Theme'}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* User Role Badge */}
        <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-700">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            isAdmin ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300'
          }`}>
            {profile?.role || 'Employee'}
          </span>
        </div>
      </div>
    </header>
  );
}
