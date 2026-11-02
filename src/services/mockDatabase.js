// Persistent Local Mock Database for Dual-Mode (MVP & Offline demo)
import { getTodayOrgDateString } from '../utils/dateUtils';

const STORAGE_KEY = 'faceattend_mock_db_v2';

const INITIAL_DATA = {
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
      has_face_registered: true,
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
      has_face_registered: true,
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
      has_face_registered: true,
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
      has_face_registered: true,
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
      has_face_registered: true,
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
  face_registrations: [
    {
      id: 'reg-01',
      user_id: 'usr-emp-01',
      organization_id: 'org-lexcorp-001',
      descriptors: [Array(128).fill(0).map((_, i) => Math.sin(i * 0.1))],
      model_version: 'vladmandic-face-api-ssd-128',
      is_active: true,
      consented_at: '2026-02-01T09:30:00Z',
      created_at: '2026-02-01T09:30:00Z',
    },
    {
      id: 'reg-02',
      user_id: 'usr-emp-02',
      organization_id: 'org-lexcorp-001',
      descriptors: [Array(128).fill(0).map((_, i) => Math.cos(i * 0.15))],
      model_version: 'vladmandic-face-api-ssd-128',
      is_active: true,
      consented_at: '2026-02-10T10:00:00Z',
      created_at: '2026-02-10T10:00:00Z',
    }
  ],
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
      metadata: { note: 'Organization LexCorp initialized with Asia/Kolkata timezone' },
      created_at: '2026-01-15T08:00:00Z',
    }
  ]
};

export function getMockDB() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATA));
    return INITIAL_DATA;
  }
  try {
    return JSON.parse(stored);
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATA));
    return INITIAL_DATA;
  }
}

export function saveMockDB(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}
