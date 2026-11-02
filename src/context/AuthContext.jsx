import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { getMockDB } from '../services/mockDatabase';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize session
  useEffect(() => {
    async function loadSession() {
      try {
        const session = await authService.getCurrentSession();
        if (session) {
          setCurrentUser(session.user);
          setCurrentProfile(session.profile);
        }
        const db = getMockDB();
        setOrganization(db.organization);
      } catch (err) {
        console.error('Session load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, []);

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    setCurrentUser(res.user);
    setCurrentProfile(res.profile);
    return res;
  };

  const logout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setCurrentProfile(null);
  };

  const switchDemoRole = async (roleOrId) => {
    setLoading(true);
    try {
      const res = await authService.switchDemoAccount(roleOrId);
      setCurrentUser(res.user);
      setCurrentProfile(res.profile);
      return res;
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    const session = await authService.getCurrentSession();
    if (session) {
      setCurrentUser(session.user);
      setCurrentProfile({ ...session.profile });
    }
  };

  const value = {
    user: currentUser,
    profile: currentProfile,
    organization,
    role: currentProfile?.role || 'employee',
    isAdmin: currentProfile?.role === 'admin',
    loading,
    login,
    logout,
    switchDemoRole,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
