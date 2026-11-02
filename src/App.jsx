import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { Login } from './pages/auth/Login';
import { EmployeeDashboard } from './pages/employee/Dashboard';
import { MarkAttendancePage } from './pages/employee/MarkAttendancePage';
import { AttendanceHistoryPage } from './pages/employee/AttendanceHistoryPage';
import { ProfilePage } from './pages/employee/ProfilePage';
import { AdminDashboard } from './pages/admin/Dashboard';
import { LiveKiosk } from './pages/admin/LiveKiosk';
import { UserManagement } from './pages/admin/UserManagement';
import { ReportsPage } from './pages/admin/ReportsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { SettingsPage } from './pages/admin/SettingsPage';

function MainApp() {
  const { user, profile, isAdmin, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState(isAdmin ? 'admin-dashboard' : 'dashboard');
  const [isDark, setIsDark] = useState(false);

  // Sync default tab on role switch
  useEffect(() => {
    if (isAdmin) {
      if (!['admin-dashboard', 'kiosk', 'users', 'reports', 'audit', 'settings'].includes(currentTab)) {
        setCurrentTab('admin-dashboard');
      }
    } else {
      if (!['dashboard', 'scanner', 'history', 'profile'].includes(currentTab)) {
        setCurrentTab('dashboard');
      }
    }
  }, [isAdmin]);

  // Apply dark class to body/html
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">Loading FaceAttend System...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={() => setCurrentTab(isAdmin ? 'admin-dashboard' : 'dashboard')} />;
  }

  return (
    <div className={`min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200`}>
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          isDark={isDark}
          onToggleDark={() => setIsDark(!isDark)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Employee Views */}
            {!isAdmin && (
              <>
                {currentTab === 'dashboard' && (
                  <EmployeeDashboard onNavigateToScanner={(tab) => setCurrentTab(tab || 'scanner')} />
                )}
                {currentTab === 'scanner' && (
                  <MarkAttendancePage
                    onBack={() => setCurrentTab('dashboard')}
                    onComplete={() => setCurrentTab('dashboard')}
                  />
                )}
                {currentTab === 'history' && <AttendanceHistoryPage />}
                {currentTab === 'profile' && <ProfilePage />}
              </>
            )}

            {/* Administrator Views */}
            {isAdmin && (
              <>
                {currentTab === 'admin-dashboard' && (
                  <AdminDashboard onNavigateTab={(tab) => setCurrentTab(tab)} />
                )}
                {currentTab === 'kiosk' && (
                  <LiveKiosk onBack={() => setCurrentTab('admin-dashboard')} />
                )}
                {currentTab === 'users' && <UserManagement />}
                {currentTab === 'reports' && <ReportsPage />}
                {currentTab === 'audit' && <AuditLogsPage />}
                {currentTab === 'settings' && <SettingsPage />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
