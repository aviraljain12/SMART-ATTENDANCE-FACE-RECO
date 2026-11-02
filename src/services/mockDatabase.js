// Persistent Local Mock Database for Dual-Mode (MVP & Offline demo)
import { getTodayOrgDateString } from '../utils/dateUtils.js';

// Storage key bumped to v3 to automatically invalidate legacy synthetic registrations
const STORAGE_KEY = 'faceattend_mock_db_v3_clean';
const LEGACY_KEYS = ['faceattend_mock_db_v1', 'faceattend_mock_db_v2'];

export const INITIAL_DATA = {
  organization: {
    id: 'org-lexcorp-001',
    name: 'LexCorp Global',
    slug: 'lexcorp',
    timezone: 'Asia/Kolkata',
    is_active: true,
  },
  users: [
    {
      id: 'usr-admin-01',
      organization_id: 'org-lexcorp-001',
      full_name: 'Dr. Sarah Connor',
      email: 'admin@lexcorp.com',
      employee_id: 'ADM-001',
      role: 'admin',
      department: 'Leadership & Ops',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      is_active: true,
      has_face_registered: false,
      created_at: '2026-01-15T08:00:00Z',
    },
    {
      id: 'usr-emp-01',
      organization_id: 'org-lexcorp-001',
      full_name: 'Sourav Roy',
      email: 'sourav@lexcorp.com',
      employee_id: 'EMP-101',
      role: 'employee',
      department: 'Engineering Department',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      is_active: true,
      has_face_registered: false,
      created_at: '2026-02-01T09:00:00Z',
    },
    {
      id: 'usr-emp-02',
      organization_id: 'org-lexcorp-001',
      full_name: 'Damian Vance',
      email: 'damian@lexcorp.com',
      employee_id: 'EMP-102',
      role: 'employee',
      department: 'Engineering Department',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      is_active: true,
      has_face_registered: false,
      created_at: '2026-02-10T09:00:00Z',
    },
    {
      id: 'usr-emp-03',
      organization_id: 'org-lexcorp-001',
      full_name: 'Elena Rostova',
      email: 'elena@lexcorp.com',
      employee_id: 'EMP-103',
      role: 'employee',
      department: 'Design & UX',
      avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
      is_active: true,
      has_face_registered: false,
      created_at: '2026-03-01T09:00:00Z',
    },
    {
      id: 'usr-emp-04',
      organization_id: 'org-lexcorp-001',
      full_name: 'Sarah Jenkins',
      email: 'sarah.j@lexcorp.com',
      employee_id: 'EMP-104',
      role: 'employee',
      department: 'Product Management',
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      is_active: true,
      has_face_registered: false,
      created_at: '2026-03-12T09:00:00Z',
    },
    {
      id: 'usr-emp-05',
      organization_id: 'org-lexcorp-001',
      full_name: 'Alex Rivera',
      email: 'alex.r@lexcorp.com',
      employee_id: 'EMP-105',
      role: 'employee',
      department: 'Quality Assurance',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      is_active: true,
      has_face_registered: false,
      created_at: '2026-04-01T09:00:00Z',
    }
  ],
  // Empty biometric registry - strictly NO synthetic or pre-populated Math.sin/cos descriptors
  face_registrations: [],
  attendance: [
    {
      id: 'att-past-01',
      user_id: 'usr-emp-01',
      organization_id: 'org-lexcorp-001',
      attendance_date: '2026-11-01',
      check_in_time: '2026-11-01T09:12:00Z',
      status: 'Present',
      verification_method: 'Face Recognition',
      confidence_score: 0.98,
    },
    {
      id: 'att-past-02',
      user_id: 'usr-emp-01',
      organization_id: 'org-lexcorp-001',
      attendance_date: '2026-10-31',
      check_in_time: '2026-10-31T09:05:00Z',
      status: 'Present',
      verification_method: 'Face Recognition',
      confidence_score: 0.96,
    },
    {
      id: 'att-past-03',
      user_id: 'usr-emp-02',
      organization_id: 'org-lexcorp-001',
      attendance_date: '2026-11-01',
      check_in_time: '2026-11-01T09:20:00Z',
      status: 'Present',
      verification_method: 'Face Recognition',
      confidence_score: 0.95,
    },
    {
      id: 'att-past-04',
      user_id: 'usr-emp-03',
      organization_id: 'org-lexcorp-001',
      attendance_date: '2026-11-01',
      check_in_time: '2026-11-01T08:58:00Z',
      status: 'Present',
      verification_method: 'Face Recognition',
      confidence_score: 0.99,
    }
  ],
  audit_logs: [
    {
      id: 'log-01',
      organization_id: 'org-lexcorp-001',
      performed_by: 'usr-admin-01',
      action: 'ORGANIZATION_INITIALIZED',
      target_user_id: null,
      metadata: { note: 'Organization LexCorp initialized with zero synthetic face vectors.' },
      created_at: '2026-01-15T08:00:00Z',
    }
  ]
};

// Clean legacy localStorage items safely
function purgeLegacyStorage() {
  if (typeof localStorage === 'undefined') return;
  for (const legacyKey of LEGACY_KEYS) {
    try {
      localStorage.removeItem(legacyKey);
    } catch {}
  }
}

// In-memory fallback if localStorage is unavailable (e.g., in node tests)
let memoryStore = null;

export function getMockDB() {
  purgeLegacyStorage();

  let stored = null;
  if (typeof localStorage !== 'undefined') {
    stored = localStorage.getItem(STORAGE_KEY);
  } else {
    stored = memoryStore;
  }

  if (!stored) {
    const clone = JSON.parse(JSON.stringify(INITIAL_DATA));
    saveMockDB(clone);
    return clone;
  }

  try {
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
    // Sanitize any residual synthetic registrations
    if (Array.isArray(parsed.face_registrations)) {
      // Purge any legacy registrations using synthetic IDs or synthetic patterns
      parsed.face_registrations = parsed.face_registrations.filter((r) => {
        if (r.id === 'reg-01' || r.id === 'reg-02') return false;
        // Verify descriptors are not synthetic math patterns
        if (Array.isArray(r.descriptors)) {
          const isSynthetic = r.descriptors.some((d) => {
            if (!Array.isArray(d)) return false;
            // Check for Math.sin(i * 0.1) or Math.cos(i * 0.15)
            const sample = d.slice(0, 5);
            const isSin = sample.every((v, i) => Math.abs(v - Math.sin(i * 0.1)) < 0.0001);
            const isCos = sample.every((v, i) => Math.abs(v - Math.cos(i * 0.15)) < 0.0001);
            return isSin || isCos;
          });
          if (isSynthetic) return false;
        }
        return true;
      });

      // Synchronize has_face_registered flag on user profiles
      const registeredUserIds = new Set(
        parsed.face_registrations.filter((r) => r.is_active).map((r) => r.user_id)
      );
      parsed.users.forEach((u) => {
        u.has_face_registered = registeredUserIds.has(u.id);
      });
    }

    return parsed;
  } catch {
    const clone = JSON.parse(JSON.stringify(INITIAL_DATA));
    saveMockDB(clone);
    return clone;
  }
}

export function saveMockDB(db) {
  const serialized = JSON.stringify(db);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, serialized);
  } else {
    memoryStore = serialized;
  }
}

export function resetMockDatabase() {
  purgeLegacyStorage();
  const fresh = JSON.parse(JSON.stringify(INITIAL_DATA));
  saveMockDB(fresh);
  return fresh;
}
