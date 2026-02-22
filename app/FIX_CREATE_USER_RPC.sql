-- ================================================================
-- FIX: Create missing functions and fix RLS policies
-- HOW TO USE:
--   1. Go to your Supabase Dashboard → SQL Editor
--   2. Copy and paste this ENTIRE file
--   3. Click "Run"
-- ================================================================

-- Enable pgcrypto for password hashing (gen_salt, crypt functions)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------
-- STEP 1: Create the missing create_new_user RPC function
-- This allows the admin to create new coach/staff accounts
-- without changing the current user session.
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
    -- Generate a new UUID for the user
    new_user_id := gen_random_uuid();

    -- Insert directly into Supabase auth.users table
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data,
        raw_app_meta_data,
        created_at,
        updated_at,
        role,
        aud,
        is_sso_user,
        is_anonymous
    )
    VALUES (
        new_user_id,
        LOWER(TRIM(email)),
        extensions.crypt(password, extensions.gen_salt('bf', 10)),
        NOW(),                      -- auto-confirm email (no email verification needed)
        user_metadata,
        '{"provider":"email","providers":["email"]}'::jsonb,
        NOW(),
        NOW(),
        'authenticated',
        'authenticated',
        false,
        false
    );

    -- ----------------------------------------------------------------
    -- CRITICAL: Insert into auth.identities
    -- This ensures the login (email provider) is linked to the user account
    -- ----------------------------------------------------------------
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    )
    VALUES (
        new_user_id,
        new_user_id,
        format('{"sub":"%s","email":"%s"}', new_user_id::text, LOWER(TRIM(email)))::jsonb,
        'email',
        NOW(),
        NOW(),
        NOW()
    );

    RETURN new_user_id;
END;
$$;

-- Grant execution rights to authenticated users (admins)
GRANT EXECUTE ON FUNCTION public.create_new_user TO authenticated;

-- ----------------------------------------------------------------
-- STEP 2: Fix profiles RLS to allow admin to insert any profile
-- Default policy only allows: auth.uid() = id (own profile only)
-- We need to allow admins to insert profiles for new staff members
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can insert any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users and admins can insert profiles" ON public.profiles;

CREATE POLICY "Users and admins can insert profiles" ON public.profiles
FOR INSERT WITH CHECK (
    -- Allow inserting own profile
    auth.uid() = id
    OR
    -- Allow admins and head coaches to insert any profile
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'head_coach')
    )
);

-- ----------------------------------------------------------------
-- STEP 3: Create the coaches table (it was missing from the schema!)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coaches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    specialty TEXT,
    role TEXT DEFAULT 'coach',
    pt_rate DECIMAL(10,2) DEFAULT 0,
    salary DECIMAL(10,2) DEFAULT 0,
    avatar_url TEXT,
    image_pos_x INTEGER DEFAULT 50,
    image_pos_y INTEGER DEFAULT 50,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id),
    UNIQUE(email)
);

-- Enable RLS on coaches table
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- STEP 4: Add RLS policy for coaches table
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.coaches;
CREATE POLICY "Enable all for authenticated" ON public.coaches
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ----------------------------------------------------------------
-- STEP 5: Create user_settings table (missing — needed for theme settings)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    primary_color TEXT,
    secondary_color TEXT,
    accent_color TEXT,
    font_family TEXT,
    font_scale DECIMAL(4,2),
    border_radius TEXT,
    glass_opacity DECIMAL(4,2),
    surface_color TEXT,
    search_icon_color TEXT,
    search_bg_color TEXT,
    search_border_color TEXT,
    search_text_color TEXT,
    hover_color TEXT,
    hover_border_color TEXT,
    input_bg_color TEXT,
    clock_position TEXT,
    clock_integration BOOLEAN DEFAULT FALSE,
    weather_integration BOOLEAN DEFAULT FALSE,
    language TEXT DEFAULT 'en',
    premium_badge_color TEXT,
    brand_label_color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_settings table
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- STEP 6: Add RLS policy for user_settings
-- Each user can only read/write their own settings
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users manage own settings" ON public.user_settings;
CREATE POLICY "Users manage own settings" ON public.user_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Also enable realtime for user_settings
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ----------------------------------------------------------------
-- STEP 7: Create delete_user_by_id RPC
-- This allows admins to completely delete a coach/staff member
-- including their Auth account, Profile, and Coach record.
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_user_by_id(UUID);

CREATE OR REPLACE FUNCTION public.delete_user_by_id(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- 1. Check if the current user is an admin or head_coach
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'head_coach')
    ) THEN
        RAISE EXCEPTION 'Only admins or head coaches can delete users';
    END IF;

    -- 2. Delete from auth.users (This will cascade to profiles and coaches if FKs are set)
    -- If not cascading, we manually cleanup
    DELETE FROM public.coaches WHERE profile_id = target_user_id;
    DELETE FROM public.profiles WHERE id = target_user_id;
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Grant execution rights to authenticated users (admins)
GRANT EXECUTE ON FUNCTION public.delete_user_by_id TO authenticated;

-- ----------------------------------------------------------------
-- DONE! All missing tables and functions are now in place.
-- The app can now:
--   ✅ Create new staff members (create_new_user RPC)
--   ✅ Delete staff members completely (delete_user_by_id RPC)
--   ✅ Save user theme settings (user_settings table)
--   ✅ Store coach records (coaches table)
-- ----------------------------------------------------------------
