import { supabase, isSupabaseConfigured } from './supabase';
import { getMockDB, saveMockDB } from './mockDatabase';

export const userService = {
  async getOrganizationUsers() {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, face_registrations(id, is_active, created_at)');
      if (error) throw error;
      return data || [];
    }

    const db = getMockDB();
    return db.users;
  },

  async getUserFaceDescriptors(userId) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('face_registrations')
        .select('descriptor')
        .eq('user_id', userId)
        .eq('is_active', true);
      if (error) throw error;
      return data?.map((d) => d.descriptor) || [];
    }

    const db = getMockDB();
    const reg = db.face_registrations.find((r) => r.user_id === userId && r.is_active);
    return reg?.descriptors || [];
  },

  async registerUserFace({ userId, descriptors, consentedAt }) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.functions.invoke('register-face', {
        body: { descriptors, biometricConsent: Boolean(consentedAt) },
      });
      if (error) throw error;
      return data;
    }

    const db = getMockDB();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');

    // Deactivate previous registrations
    db.face_registrations.forEach((r) => {
      if (r.user_id === userId) r.is_active = false;
    });

    const newReg = {
      id: `reg-${Date.now()}`,
      user_id: userId,
      organization_id: user.organization_id,
      descriptors,
      model_version: 'vladmandic-face-api-ssd-128',
      is_active: true,
      consented_at: consentedAt || new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    db.face_registrations.push(newReg);
    user.has_face_registered = true;

    // Audit log
    db.audit_logs.unshift({
      id: `log-${Date.now()}`,
      organization_id: user.organization_id,
      performed_by: userId,
      action: 'FACE_BIOMETRIC_REGISTERED',
      target_user_id: userId,
      metadata: { samplesCount: descriptors.length, consentedAt },
      created_at: new Date().toISOString(),
    });

    saveMockDB(db);
    return { success: true, registration: newReg };
  },

  /**
   * Withdraw biometric consent and delete stored descriptors (TC-14)
   */
  async withdrawBiometricConsent(userId) {
    const db = getMockDB();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');

    db.face_registrations = db.face_registrations.filter((r) => r.user_id !== userId);
    user.has_face_registered = false;

    db.audit_logs.unshift({
      id: `log-${Date.now()}`,
      organization_id: user.organization_id,
      performed_by: userId,
      action: 'BIOMETRIC_CONSENT_WITHDRAWN',
      target_user_id: userId,
      metadata: { deletedRegistrations: true },
      created_at: new Date().toISOString(),
    });

    saveMockDB(db);
    return { success: true, message: 'Biometric descriptors permanently purged.' };
  },

  async createUser({ fullName, email, employeeId, role = 'employee', department = 'General' }) {
    const db = getMockDB();
    const existing = db.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() || u.employee_id.toLowerCase() === employeeId.toLowerCase()
    );
    if (existing) {
      throw new Error('User with this email or Employee ID already exists.');
    }

    const newUser = {
      id: `usr-${Date.now()}`,
      organization_id: db.organization.id,
      full_name: fullName,
      email,
      employee_id: employeeId,
      role,
      department,
      avatar_url: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 50000)}?w=150`,
      is_active: true,
      has_face_registered: false,
      created_at: new Date().toISOString(),
    };

    db.users.push(newUser);
    saveMockDB(db);
    return newUser;
  },

  async toggleUserStatus(userId, isActive) {
    const db = getMockDB();
    const user = db.users.find((u) => u.id === userId);
    if (user) {
      user.is_active = isActive;
      saveMockDB(db);
    }
    return user;
  },

  async getAuditLogs() {
    const db = getMockDB();
    return db.audit_logs;
  }
};
