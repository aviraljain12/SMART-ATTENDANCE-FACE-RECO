-- ====================================================================
-- Face Recognition With Attendance System - Supabase PostgreSQL Schema
-- Version 2.0 (November 2026)
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    timezone TEXT DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    is_active BOOLEAN DEFAULT TRUE
);

-- 3. User Profiles Table (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
    department TEXT DEFAULT 'General',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT unique_org_employee_id UNIQUE (organization_id, employee_id)
);

-- 4. Face Registrations Table
CREATE TABLE IF NOT EXISTS public.face_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    descriptor JSONB NOT NULL,
    model_version TEXT NOT NULL DEFAULT 'vladmandic-face-api-ssd-128',
    is_active BOOLEAN DEFAULT TRUE,
    consented_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 5. Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    attendance_date DATE NOT NULL,
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    status TEXT NOT NULL DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Late', 'Half-day')),
    verification_method TEXT NOT NULL DEFAULT 'Face Recognition',
    confidence_score NUMERIC(5, 4),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    -- Critical Constraint: exactly one attendance entry per user per local date
    CONSTRAINT unique_user_daily_attendance UNIQUE (user_id, attendance_date)
);

-- 6. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function: get current user organization
CREATE OR REPLACE FUNCTION public.get_current_user_org()
RETURNS UUID AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Users can read profiles in their organization"
ON public.profiles FOR SELECT
USING (organization_id = public.get_current_user_org());

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid() AND role = public.get_current_user_role()); -- Prevent self-privilege escalation

CREATE POLICY "Admins can insert and update profiles in their organization"
ON public.profiles FOR ALL
USING (
  public.get_current_user_role() = 'admin' AND 
  organization_id = public.get_current_user_org()
);

-- Face Registrations Policies
-- Users can only read and manage their OWN biometric descriptors
CREATE POLICY "Users can read own face descriptors"
ON public.face_registrations FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own face descriptors with consent"
ON public.face_registrations FOR INSERT
WITH CHECK (user_id = auth.uid() AND organization_id = public.get_current_user_org());

CREATE POLICY "Users can delete own face descriptors"
ON public.face_registrations FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage organization face registrations"
ON public.face_registrations FOR ALL
USING (
  public.get_current_user_role() = 'admin' AND 
  organization_id = public.get_current_user_org()
);

-- Attendance Policies
CREATE POLICY "Users can read own attendance"
ON public.attendance FOR SELECT
USING (
  user_id = auth.uid() OR 
  (public.get_current_user_role() = 'admin' AND organization_id = public.get_current_user_org())
);

CREATE POLICY "Users can insert own verified attendance"
ON public.attendance FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND 
  organization_id = public.get_current_user_org()
);

CREATE POLICY "Admins can manage organization attendance"
ON public.attendance FOR ALL
USING (
  public.get_current_user_role() = 'admin' AND 
  organization_id = public.get_current_user_org()
);

-- Audit Logs Policies
CREATE POLICY "Admins can read organization audit logs"
ON public.audit_logs FOR SELECT
USING (
  public.get_current_user_role() = 'admin' AND 
  organization_id = public.get_current_user_org()
);

CREATE POLICY "System can record audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (organization_id = public.get_current_user_org());
