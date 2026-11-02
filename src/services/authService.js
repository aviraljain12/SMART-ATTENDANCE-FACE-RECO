import { supabase, isSupabaseConfigured } from './supabase.js';
import { getMockDB, saveMockDB } from './mockDatabase.js';

const ACTIVE_USER_SESSION_KEY = 'faceattend_session_user';

export const authService = {
  async getCurrentSession() {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      return {
        user: session.user,
        profile: profile || null,
      };
    }

    // Dual-mode mock session
    const saved = localStorage.getItem(ACTIVE_USER_SESSION_KEY);
    const db = getMockDB();
    if (saved) {
      const user = db.users.find((u) => u.id === saved);
      if (user) {
        return { user: { id: user.id, email: user.email }, profile: user };
      }
    }

    // Default to Sourav Roy (EMP-101) from PRD / Screenshot 4
    const defaultUser = db.users.find((u) => u.employee_id === 'EMP-101') || db.users[1];
    localStorage.setItem(ACTIVE_USER_SESSION_KEY, defaultUser.id);
    return {
      user: { id: defaultUser.id, email: defaultUser.email },
      profile: defaultUser,
    };
  },

  async login(email, password) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
      return { user: data.user, profile };
    }

    // Mock login verification
    const db = getMockDB();
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error('User not found. Use one of the preconfigured demo accounts or register.');
    }
    if (!user.is_active) {
      throw new Error('This account is inactive. Please contact the administrator.');
    }

    localStorage.setItem(ACTIVE_USER_SESSION_KEY, user.id);
    return { user: { id: user.id, email: user.email }, profile: user };
  },

  async switchDemoAccount(roleOrEmployeeId) {
    const db = getMockDB();
    let target = null;
    if (roleOrEmployeeId === 'admin') {
      target = db.users.find((u) => u.role === 'admin');
    } else if (roleOrEmployeeId === 'employee') {
      target = db.users.find((u) => u.role === 'employee');
    } else {
      target = db.users.find((u) => u.employee_id === roleOrEmployeeId || u.id === roleOrEmployeeId);
    }

    if (!target) target = db.users[0];
    localStorage.setItem(ACTIVE_USER_SESSION_KEY, target.id);
    return { user: { id: target.id, email: target.email }, profile: target };
  },

  async logout() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(ACTIVE_USER_SESSION_KEY);
  },
};
