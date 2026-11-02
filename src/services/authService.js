import { supabase, isSupabaseConfigured } from './supabase.js';
import { getMockDB, saveMockDB } from './mockDatabase.js';

const ACTIVE_USER_SESSION_KEY = 'faceattend_session_user';

let inMemorySessionUser = null;

function getSessionUser() {
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(ACTIVE_USER_SESSION_KEY);
    } catch {}
  }
  return inMemorySessionUser;
}

function setSessionUser(id) {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ACTIVE_USER_SESSION_KEY, id);
    } catch {}
  }
  inMemorySessionUser = id;
}

function clearSessionUser() {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(ACTIVE_USER_SESSION_KEY);
    } catch {}
  }
  inMemorySessionUser = null;
}

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
    const saved = getSessionUser();
    const db = getMockDB();
    if (saved) {
      const user = db.users.find((u) => u.id === saved);
      if (user) {
        return { user: { id: user.id, email: user.email }, profile: user };
      }
    }

    // Default to Sourav Roy (EMP-101) from PRD / Screenshot 4
    const defaultUser = db.users.find((u) => u.employee_id === 'EMP-101') || db.users[1];
    setSessionUser(defaultUser.id);
    return {
      user: { id: defaultUser.id, email: defaultUser.email },
      profile: defaultUser,
    };
  },

  async getCurrentUser() {
    return this.getCurrentSession();
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

    setSessionUser(user.id);
    return { user: { id: user.id, email: user.email }, profile: user };
  },

  async register({ fullName, email, password, employeeId, department = 'Engineering Department' }) {
    if (!fullName || !email || !employeeId) {
      throw new Error('Full Name, Email, and Employee ID are required.');
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: password || 'DefaultPass123!',
        options: {
          data: {
            full_name: fullName,
            employee_id: employeeId,
            department,
          },
        },
      });
      if (error) throw error;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
      return { user: data.user, profile };
    }

    const db = getMockDB();
    const existing = db.users.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() ||
        u.employee_id.toLowerCase() === employeeId.toLowerCase()
    );
    if (existing) {
      throw new Error('An account with this Email or Employee ID already exists.');
    }

    const newUser = {
      id: `usr-${Date.now()}`,
      organization_id: db.organization.id,
      full_name: fullName,
      email,
      employee_id: employeeId,
      role: 'employee',
      department,
      avatar_url: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150`,
      is_active: true,
      has_face_registered: false,
      created_at: new Date().toISOString(),
    };

    db.users.push(newUser);
    saveMockDB(db);

    setSessionUser(newUser.id);
    return { user: { id: newUser.id, email: newUser.email }, profile: newUser };
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
    setSessionUser(target.id);
    return { user: { id: target.id, email: target.email }, profile: target };
  },

  async logout() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    clearSessionUser();
  },
};
