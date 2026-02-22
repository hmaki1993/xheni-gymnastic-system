-- ================================================================
-- ACADEMY - COMPLETE DATABASE SETUP (MASTER SETUP)
-- Paste this ENTIRE file in Supabase SQL Editor and click Run
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- Run this ONCE for any new academy project to set up everything.
-- ================================================================

-- ----------------------------------------------------------------
-- 0a. EXTENSIONS (Required for password hashing)
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------
-- 0b. PROFILES TABLE (auth users mirror - must exist before coaches)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'coach',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users and admins can insert profiles" ON public.profiles;
CREATE POLICY "Users and admins can insert profiles" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

-- ----------------------------------------------------------------
-- 0c. CREATE NEW USER RPC (admin creates coach accounts server-side)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_new_user(
    email TEXT,
    password TEXT,
    user_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    new_user_id UUID;
BEGIN
    new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at,
        raw_user_meta_data, raw_app_meta_data,
        created_at, updated_at, role, aud, is_sso_user, is_anonymous
    ) VALUES (
        new_user_id,
        LOWER(TRIM(email)),
        extensions.crypt(password, extensions.gen_salt('bf')),
        NOW(),
        user_metadata,
        '{"provider":"email","providers":["email"]}'::jsonb,
        NOW(), NOW(), 'authenticated', 'authenticated', false, false
    );
    RETURN new_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_new_user TO authenticated;


-- ----------------------------------------------------------------
-- 1. GYM SETTINGS (Global academy settings)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gym_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    academy_name TEXT DEFAULT 'Xheni Academy',
    logo_url TEXT,
    gym_address TEXT,
    gym_phone TEXT,
    primary_color TEXT DEFAULT '#A30000',
    secondary_color TEXT DEFAULT '#0B120F',
    accent_color TEXT DEFAULT '#A30000',
    surface_color TEXT DEFAULT 'rgba(18, 46, 52, 0.7)',
    hover_color TEXT DEFAULT 'rgba(16, 185, 129, 0.8)',
    hover_border_color TEXT DEFAULT 'rgba(16, 185, 129, 0.3)',
    input_bg_color TEXT DEFAULT '#0f172a',
    search_icon_color TEXT,
    search_bg_color TEXT,
    search_border_color TEXT,
    search_text_color TEXT,
    font_family TEXT DEFAULT 'Cairo',
    font_scale DECIMAL(4,2) DEFAULT 1,
    border_radius TEXT DEFAULT 'rounded',
    glass_opacity DECIMAL(4,2) DEFAULT 0.1,
    clock_position TEXT DEFAULT 'dashboard',
    clock_integration BOOLEAN DEFAULT true,
    weather_integration BOOLEAN DEFAULT true,
    language TEXT DEFAULT 'en',
    premium_badge_color TEXT DEFAULT '#A30000',
    brand_label_color TEXT DEFAULT '#A30000',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add missing columns if table exists
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS surface_color TEXT DEFAULT 'rgba(18, 46, 52, 0.7)';
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS hover_color TEXT DEFAULT 'rgba(16, 185, 129, 0.8)';
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS hover_border_color TEXT DEFAULT 'rgba(16, 185, 129, 0.3)';
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS input_bg_color TEXT DEFAULT '#0f172a';
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS search_icon_color TEXT;
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS search_bg_color TEXT;
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS search_border_color TEXT;
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS search_text_color TEXT;
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS clock_position TEXT DEFAULT 'dashboard';
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS clock_integration BOOLEAN DEFAULT true;
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS weather_integration BOOLEAN DEFAULT true;
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS premium_badge_color TEXT;
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS brand_label_color TEXT;

ALTER TABLE public.gym_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_read_gym" ON public.gym_settings;
CREATE POLICY "allow_read_gym" ON public.gym_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "allow_auth_write_gym" ON public.gym_settings;
CREATE POLICY "allow_auth_write_gym" ON public.gym_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default row if empty
INSERT INTO public.gym_settings (academy_name) 
SELECT 'Xheni Academy' WHERE NOT EXISTS (SELECT 1 FROM public.gym_settings);

-- ----------------------------------------------------------------
-- 2. SUBSCRIPTION PLANS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    price DECIMAL(10,2) DEFAULT 0,
    duration_months INTEGER DEFAULT 1,
    sessions_limit INTEGER,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_read_plans" ON public.subscription_plans;
CREATE POLICY "allow_read_plans" ON public.subscription_plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "allow_auth_write_plans" ON public.subscription_plans;
CREATE POLICY "allow_auth_write_plans" ON public.subscription_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default plan if empty
INSERT INTO public.subscription_plans (name, price, duration_months, sessions_limit) 
SELECT 'Monthly Plan', 0, 1, NULL WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans);

-- ----------------------------------------------------------------
-- 3. TRAINING GROUPS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
    schedule JSONB DEFAULT '[]'::jsonb,
    schedule_key TEXT,
    capacity INTEGER DEFAULT 20,
    level TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.training_groups ADD COLUMN IF NOT EXISTS schedule_key TEXT;
ALTER TABLE public.training_groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.training_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_read_groups" ON public.training_groups;
CREATE POLICY "allow_all_read_groups" ON public.training_groups FOR SELECT USING (true);
DROP POLICY IF EXISTS "allow_auth_write_groups" ON public.training_groups;
CREATE POLICY "allow_auth_write_groups" ON public.training_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 4. STUDENTS (core table)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    father_name TEXT,
    mother_name TEXT,
    email TEXT,
    address TEXT,
    birth_date DATE,
    age INTEGER,
    gender TEXT DEFAULT 'male',
    training_type TEXT,
    contact_number TEXT,
    parent_contact TEXT,
    notes TEXT,
    photo_url TEXT,
    status TEXT DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    training_days TEXT[] DEFAULT '{}',
    training_schedule JSONB DEFAULT '[]',
    subscription_expiry DATE,
    subscription_start DATE,
    subscription_plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
    sessions_remaining INTEGER,
    coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
    training_group_id UUID REFERENCES public.training_groups(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if table already exists
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS father_name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS mother_name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS training_type TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS contact_number TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_contact TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS training_schedule JSONB DEFAULT '[]';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS subscription_expiry DATE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS subscription_start DATE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS sessions_remaining INTEGER;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS training_group_id UUID;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS coach_id UUID;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS subscription_plan_id UUID;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Fix coach_id FK: drop ALL old constraints, add correct one to coaches
DO $$ BEGIN
    ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_coach_id_fkey;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.students DROP CONSTRAINT IF EXISTS fk_students_coach;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.students ADD CONSTRAINT students_coach_id_fkey
    FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Fix subscription_plan_id FK
DO $$ BEGIN
    ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_subscription_plan_id_fkey;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.students DROP CONSTRAINT IF EXISTS fk_students_plan;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.students ADD CONSTRAINT students_subscription_plan_id_fkey
    FOREIGN KEY (subscription_plan_id) REFERENCES public.subscription_plans(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Fix training_group_id FK
DO $$ BEGIN
    ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_training_group_id_fkey;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.students DROP CONSTRAINT IF EXISTS fk_students_group;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.students ADD CONSTRAINT students_training_group_id_fkey
    FOREIGN KEY (training_group_id) REFERENCES public.training_groups(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Force schema cache reload NOW (so relationships are visible immediately)
NOTIFY pgrst, 'reload';

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_read_students" ON public.students;
CREATE POLICY "allow_all_read_students" ON public.students FOR SELECT USING (true);
DROP POLICY IF EXISTS "allow_auth_write_students" ON public.students;
CREATE POLICY "allow_auth_write_students" ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_students_coach_id ON public.students(coach_id);
CREATE INDEX IF NOT EXISTS idx_students_plan_id ON public.students(subscription_plan_id);
CREATE INDEX IF NOT EXISTS idx_students_group_id ON public.students(training_group_id);

-- ----------------------------------------------------------------
-- 5. STUDENT TRAINING SCHEDULE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_training_schedule (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.student_training_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_student_schedule" ON public.student_training_schedule;
CREATE POLICY "allow_all_student_schedule" ON public.student_training_schedule FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 6. PAYMENTS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) DEFAULT 0,
    payment_date DATE DEFAULT CURRENT_DATE,
    payment_method TEXT DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_auth_payments" ON public.payments;
CREATE POLICY "allow_auth_payments" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 7. TRAINING SESSIONS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id UUID REFERENCES public.coaches(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'Group Training',
    day_of_week TEXT,
    start_time TEXT,
    end_time TEXT,
    capacity INTEGER DEFAULT 20,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_auth_sessions" ON public.training_sessions;
CREATE POLICY "allow_auth_sessions" ON public.training_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 8. COACH ATTENDANCE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id UUID REFERENCES public.coaches(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    pt_sessions_count INTEGER DEFAULT 0,
    note TEXT,
    status TEXT DEFAULT 'present',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Safely add missing columns and UNIQUE constraint
ALTER TABLE public.coach_attendance ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.coach_attendance ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'present';
ALTER TABLE public.coach_attendance ADD COLUMN IF NOT EXISTS pt_sessions_count INTEGER DEFAULT 0;

-- Force coach_id FK to point to coaches table (NOT profiles)
DO $$ BEGIN
    ALTER TABLE public.coach_attendance DROP CONSTRAINT IF EXISTS coach_attendance_coach_id_fkey;
    ALTER TABLE public.coach_attendance DROP CONSTRAINT IF EXISTS fk_coach_attendance_coach;
    ALTER TABLE public.coach_attendance ADD CONSTRAINT coach_attendance_coach_id_fkey 
    FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Add UNIQUE constraint to support .upsert() from frontend
-- First, clean up any existing duplicates to ensure the constraint can be applied
DO $$ 
BEGIN
    DELETE FROM public.coach_attendance a
    USING (
      SELECT coach_id, date, MAX(created_at) as latest
      FROM public.coach_attendance
      GROUP BY coach_id, date
      HAVING COUNT(*) > 1
    ) b
    WHERE a.coach_id = b.coach_id 
      AND a.date = b.date 
      AND (a.created_at < b.latest OR (a.created_at = b.latest AND a.id < (SELECT MIN(id) FROM public.coach_attendance WHERE coach_id = b.coach_id AND date = b.date AND created_at = b.latest)));

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'coach_attendance_coach_id_date_key'
    ) THEN
        ALTER TABLE public.coach_attendance ADD CONSTRAINT coach_attendance_coach_id_date_key UNIQUE (coach_id, date);
    END IF;
EXCEPTION WHEN OTHERS THEN 
    -- If cleanup fails or constraint fails, we log it but don't stop the script
    RAISE NOTICE 'Could not apply unique constraint to coach_attendance, duplicates might still exist.';
END $$;

ALTER TABLE public.coach_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_read_attendance" ON public.coach_attendance;
CREATE POLICY "allow_all_read_attendance" ON public.coach_attendance FOR SELECT USING (true);
DROP POLICY IF EXISTS "allow_auth_write_attendance" ON public.coach_attendance;
CREATE POLICY "allow_auth_write_attendance" ON public.coach_attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 9. PT SUBSCRIPTIONS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pt_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
    student_name TEXT,
    student_phone TEXT,
    sessions_total INTEGER DEFAULT 0,
    sessions_remaining INTEGER DEFAULT 0,
    start_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE,
    total_price DECIMAL(10,2) DEFAULT 0,
    price_per_session DECIMAL(10,2) DEFAULT 0,
    coach_share DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add missing columns
ALTER TABLE public.pt_subscriptions ADD COLUMN IF NOT EXISTS student_phone TEXT;
ALTER TABLE public.pt_subscriptions ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE public.pt_subscriptions ADD COLUMN IF NOT EXISTS price_per_session DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.pt_subscriptions ADD COLUMN IF NOT EXISTS coach_share DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.pt_subscriptions ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE public.pt_subscriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Fix coach_id FK (Ensures it points to coaches table, not profiles)
DO $$ BEGIN
    ALTER TABLE public.pt_subscriptions DROP CONSTRAINT IF EXISTS pt_subscriptions_coach_id_fkey;
    ALTER TABLE public.pt_subscriptions ADD CONSTRAINT pt_subscriptions_coach_id_fkey 
    FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE public.pt_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_read_pt" ON public.pt_subscriptions;
CREATE POLICY "allow_all_read_pt" ON public.pt_subscriptions FOR SELECT USING (true);
DROP POLICY IF EXISTS "allow_auth_write_pt" ON public.pt_subscriptions;
CREATE POLICY "allow_auth_write_pt" ON public.pt_subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 10. PT SESSIONS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pt_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES public.pt_subscriptions(id) ON DELETE SET NULL,
    student_name TEXT,
    date DATE DEFAULT CURRENT_DATE,
    sessions_count INTEGER DEFAULT 1,
    coach_share DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add missing columns
ALTER TABLE public.pt_sessions ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.pt_subscriptions(id) ON DELETE SET NULL;
ALTER TABLE public.pt_sessions ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE public.pt_sessions ADD COLUMN IF NOT EXISTS coach_share DECIMAL(10,2) DEFAULT 0;

-- Fix coach_id FK
DO $$ BEGIN
    ALTER TABLE public.pt_sessions DROP CONSTRAINT IF EXISTS pt_sessions_coach_id_fkey;
    ALTER TABLE public.pt_sessions ADD CONSTRAINT pt_sessions_coach_id_fkey 
    FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE public.pt_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_auth_pt_sessions" ON public.pt_sessions;
CREATE POLICY "allow_auth_pt_sessions" ON public.pt_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ----------------------------------------------------------------
-- 12. NOTIFICATIONS (fix FK constraint that blocks coach saves)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    related_coach_id UUID, -- no FK constraint, stores coaches.id
    title TEXT,
    message TEXT,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop old FK constraint that references profiles (now coaches have their own table)
DO $$ BEGIN
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_related_coach_id_fkey;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Add missing columns safely
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_coach_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_student_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_role TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_notifications" ON public.notifications;
CREATE POLICY "users_own_notifications" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Also allow reading notifications about self
DROP POLICY IF EXISTS "allow_read_all_notifications" ON public.notifications;
CREATE POLICY "allow_read_all_notifications" ON public.notifications FOR SELECT TO authenticated USING (true);

-- ----------------------------------------------------------------
-- 13. EXPENSES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    amount DECIMAL(10,2) DEFAULT 0,
    category TEXT,
    expense_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_auth_expenses" ON public.expenses;
CREATE POLICY "allow_auth_expenses" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 14. USER SETTINGS (stores per-user app preferences / theme)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_settings" ON public.user_settings;
CREATE POLICY "users_own_settings" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 15. REFUNDS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) DEFAULT 0,
    reason TEXT,
    refund_date DATE DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_auth_refunds" ON public.refunds;
CREATE POLICY "allow_auth_refunds" ON public.refunds FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 16. VOICE BROADCASTS (Walkie Talkie feature)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voice_broadcasts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    audio_url TEXT NOT NULL,
    target_users UUID[] DEFAULT NULL, -- NULL = broadcast to all
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.voice_broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_auth_voice" ON public.voice_broadcasts;
CREATE POLICY "allow_auth_voice" ON public.voice_broadcasts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime on voice_broadcasts (safe to run multiple times)
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_broadcasts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create walkie-talkie storage bucket (public so audio can be fetched)
INSERT INTO storage.buckets (id, name, public)
VALUES ('walkie-talkie', 'walkie-talkie', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: anyone authenticated can upload/download
DROP POLICY IF EXISTS "walkie_auth_access" ON storage.objects;
CREATE POLICY "walkie_auth_access" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'walkie-talkie') WITH CHECK (bucket_id = 'walkie-talkie');

-- ----------------------------------------------------------------
-- 17. STUDENT ATTENDANCE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'present', 'absent', 'completed')),
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    session_deducted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add missing columns
ALTER TABLE public.student_attendance ADD COLUMN IF NOT EXISTS coach_id UUID;
ALTER TABLE public.student_attendance ADD COLUMN IF NOT EXISTS session_deducted BOOLEAN DEFAULT false;

-- Force coach_id FK to point to coaches table (NOT profiles)
DO $$ BEGIN
    ALTER TABLE public.student_attendance DROP CONSTRAINT IF EXISTS student_attendance_coach_id_fkey;
    ALTER TABLE public.student_attendance DROP CONSTRAINT IF EXISTS fk_student_attendance_coach;
    ALTER TABLE public.student_attendance ADD CONSTRAINT student_attendance_coach_id_fkey 
    FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_auth_student_attendance" ON public.student_attendance;
CREATE POLICY "allow_auth_student_attendance" ON public.student_attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_student_attendance_student_date ON public.student_attendance(student_id, date);

-- ----------------------------------------------------------------
-- 18. DEFINED SKILLS (for assessments)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.defined_skills (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    max_score INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.defined_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_auth_defined_skills" ON public.defined_skills;
CREATE POLICY "allow_auth_defined_skills" ON public.defined_skills FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 19. SKILL ASSESSMENTS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.skill_assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    skills JSONB DEFAULT '[]'::jsonb,
    total_score DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'present',
    evaluation_status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add evaluation_status
ALTER TABLE public.skill_assessments ADD COLUMN IF NOT EXISTS evaluation_status TEXT DEFAULT 'completed';

ALTER TABLE public.skill_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_auth_skill_assessments" ON public.skill_assessments;
CREATE POLICY "allow_auth_skill_assessments" ON public.skill_assessments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 20. MONTHLY REPORTS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.monthly_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL, -- Format: YYYY-MM
    attendance_count INTEGER DEFAULT 0,
    absence_count INTEGER DEFAULT 0,
    technical_evaluation TEXT,
    behavior_evaluation TEXT,
    coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
    is_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_auth_monthly_reports" ON public.monthly_reports;
CREATE POLICY "allow_auth_monthly_reports" ON public.monthly_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- RELOAD SCHEMA CACHE
-- ----------------------------------------------------------------
NOTIFY pgrst, 'reload';


-- ================================================================
-- DONE! All tables created/updated.
-- ================================================================
