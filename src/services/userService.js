import { supabase, isSupabaseConfigured } from './supabase.js';
import { getMockDB, saveMockDB } from './mockDatabase.js';
import { isValidDescriptor } from './faceRecognitionService.js';

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
    if (!userId) return [];

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('face_registrations')
        .select('descriptor')
        .eq('user_id', userId)
        .eq('is_active', true);
      if (error) throw error;
      return (data?.map((d) => d.descriptor) || []).filter(isValidDescriptor);
    }

    const db = getMockDB();
    const reg = db.face_registrations.find((r) => r.user_id === userId && r.is_active);
    if (!reg || !Array.isArray(reg.descriptors)) return [];
    return reg.descriptors.filter(isValidDescriptor);
  },

  /**
   * Organization-scoped biometric registry for Admin Kiosk.
   * Returns active employees with genuine enrolled descriptors belonging strictly to organizationId.
   */
  async getOrganizationBiometricRegistry(organizationId) {
    if (!organizationId) return [];

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('face_registrations')
        .select('id, user_id, descriptors, organization_id, profiles(id, full_name, employee_id, department, avatar_url, is_active)')
        .eq('organization_id', organizationId)
        .eq('is_active', true);
      if (error) throw error;

      return (data || [])
        .filter((r) => r.profiles && r.profiles.is_active)
        .map((r) => ({
          userId: r.user_id,
          fullName: r.profiles.full_name,
          employeeId: r.profiles.employee_id,
          department: r.profiles.department,
          avatarUrl: r.profiles.avatar_url,
          organizationId: r.organization_id,
          descriptors: (Array.isArray(r.descriptors) ? r.descriptors : [r.descriptors]).filter(isValidDescriptor),
        }))
        .filter((c) => c.descriptors.length > 0);
    }

    const db = getMockDB();
    // Scope strictly to active users in this organization
    const orgUsers = db.users.filter((u) => u.organization_id === organizationId && u.is_active);
    const userMap = new Map(orgUsers.map((u) => [u.id, u]));

    const orgRegs = db.face_registrations.filter(
      (r) => r.organization_id === organizationId && r.is_active && userMap.has(r.user_id)
    );

    return orgRegs
      .map((r) => {
        const u = userMap.get(r.user_id);
        const validDescriptors = (r.descriptors || []).filter(isValidDescriptor);
        return {
          userId: u.id,
          fullName: u.full_name,
          employeeId: u.employee_id,
          department: u.department,
          avatarUrl: u.avatar_url,
          organizationId: r.organization_id,
          descriptors: validDescriptors,
        };
      })
      .filter((c) => c.descriptors.length > 0);
  },

  async registerUserFace({ userId, descriptors, consentedAt }) {
    if (!userId) {
      throw new Error('User ID is required for biometric registration.');
    }
    if (!Array.isArray(descriptors) || descriptors.length === 0) {
      throw new Error('At least one live facial descriptor is required for enrollment.');
    }

    // Strict validation: every descriptor must be a genuine 128-d vector
    for (let i = 0; i < descriptors.length; i++) {
      if (!isValidDescriptor(descriptors[i])) {
        throw new Error(`Descriptor at index ${i} is not a valid 128-dimensional biometric embedding.`);
      }
    }

    if (!consentedAt) {
      throw new Error('Explicit biometric consent is required before saving facial templates.');
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.functions.invoke('register-face', {
        body: { descriptors, biometricConsent: true },
      });
      if (error) throw error;
      return data;
    }

    const db = getMockDB();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found in organization database.');

    // Deactivate previous registrations
    db.face_registrations.forEach((r) => {
      if (r.user_id === userId) r.is_active = false;
    });

    const newReg = {
      id: `reg-${Date.now()}`,
      user_id: userId,
      organization_id: user.organization_id,
      descriptors: descriptors.map((d) => Array.from(d)),
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
