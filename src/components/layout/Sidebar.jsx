import React from 'react';
import {
  LayoutDashboard,
  ScanFace,
  History,
  Users,
  FileBarChart,
  ShieldCheck,
  Settings,
  User,
  LogOut,
  Building2,
  Camera,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export function Sidebar({ currentTab, onSelectTab, isCollapsed }) {
  const { profile, isAdmin, logout } = useAuth();

  const employeeNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'scanner', label: 'Mark Attendance', icon: ScanFace, highlight: true },
    { id: 'history', label: 'Attendance History', icon: History },
    { id: 'profile', label: 'My Biometric Profile', icon: User },
  ];

  const adminNavItems = [
    { id: 'admin-dashboard', label: 'Admin Overview', icon: LayoutDashboard },
    { id: 'kiosk', label: 'Live Scanner Kiosk', icon: Camera, highlight: true },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'reports', label: 'Reports & Analytics', icon: FileBarChart },
    { id: 'audit', label: 'Audit Logs', icon: ShieldCheck },
    { id: 'settings', label: 'Organization Settings', icon: Settings },
  ];

  const navItems = isAdmin ? adminNavItems : employeeNavItems;

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 select-none transition-colors duration-200">
      {/* Brand Logo & Org */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/25">
          <ScanFace className="w-6 h-6" />
        </div>
        <div className="overflow-hidden">
          <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
            FaceAttend
          </h1>
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 truncate">
            {isAdmin ? 'Admin Console' : 'LexCorp Global'}
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Navigation
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                  : item.highlight
                  ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/40'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.highlight ? 'text-brand-500' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
              {item.highlight && !isActive && (
                <span className="ml-auto w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* User profile & logout footer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40">
        <div className="flex items-center space-x-3 mb-3">
          <img
            src={profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
            alt={profile?.full_name}
            className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
          />
          <div className="overflow-hidden flex-1">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {profile?.full_name}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {profile?.employee_id} • {profile?.role}
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
