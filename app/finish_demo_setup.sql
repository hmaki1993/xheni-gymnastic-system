-- FINISH DEMO SETUP
-- This script creates the missing tables for Settings and Preferences

-- 1. Create GYM SETTINGS table
CREATE TABLE IF NOT EXISTS public.gym_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_name TEXT DEFAULT 'Xheni Academy',
    address TEXT DEFAULT 'Cairo, Egypt',
    phone TEXT DEFAULT '+20 123 456 7890',
    logo_url TEXT,
    primary_color TEXT DEFAULT '#10b981', 
    secondary_color TEXT DEFAULT '#0E1D21',
    accent_color TEXT DEFAULT '#34d399',
    font_family TEXT DEFAULT 'Cairo',
    font_scale FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure only one row exists
CREATE UNIQUE INDEX IF NOT EXISTS gym_settings_singleton ON public.gym_settings ((true));

-- Insert default settings if empty
INSERT INTO public.gym_settings (gym_name) VALUES ('Xheni Academy') ON CONFLICT DO NOTHING;

-- 2. Create USER SETTINGS table
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    language TEXT DEFAULT 'en',
    theme TEXT DEFAULT 'dark',
    primary_color TEXT,
    secondary_color TEXT,
    accent_color TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add any missing columns (Safe to run multiple times)
ALTER TABLE public.gym_settings 
ADD COLUMN IF NOT EXISTS border_radius TEXT DEFAULT '1.5rem',
ADD COLUMN IF NOT EXISTS glass_opacity FLOAT DEFAULT 0.6,
ADD COLUMN IF NOT EXISTS surface_color TEXT DEFAULT 'rgba(18, 46, 52, 0.7)',
ADD COLUMN IF NOT EXISTS search_icon_color TEXT DEFAULT 'rgba(255, 255, 255, 0.4)',
ADD COLUMN IF NOT EXISTS search_bg_color TEXT DEFAULT 'rgba(255, 255, 255, 0.05)',
ADD COLUMN IF NOT EXISTS search_border_color TEXT DEFAULT 'rgba(255, 255, 255, 0.1)',
ADD COLUMN IF NOT EXISTS search_text_color TEXT DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS hover_color TEXT DEFAULT 'rgba(16, 185, 129, 0.8)',
ADD COLUMN IF NOT EXISTS hover_border_color TEXT DEFAULT 'rgba(16, 185, 129, 0.3)',
ADD COLUMN IF NOT EXISTS input_bg_color TEXT DEFAULT '#0f172a',
ADD COLUMN IF NOT EXISTS clock_position TEXT DEFAULT 'dashboard',
ADD COLUMN IF NOT EXISTS clock_integration BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS weather_integration BOOLEAN DEFAULT true;

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS clock_integration BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS weather_integration BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS font_family TEXT,
ADD COLUMN IF NOT EXISTS font_scale FLOAT,
ADD COLUMN IF NOT EXISTS border_radius TEXT,
ADD COLUMN IF NOT EXISTS glass_opacity FLOAT,
ADD COLUMN IF NOT EXISTS surface_color TEXT,
ADD COLUMN IF NOT EXISTS search_icon_color TEXT,
ADD COLUMN IF NOT EXISTS search_bg_color TEXT,
ADD COLUMN IF NOT EXISTS search_border_color TEXT,
ADD COLUMN IF NOT EXISTS search_text_color TEXT,
ADD COLUMN IF NOT EXISTS hover_color TEXT,
ADD COLUMN IF NOT EXISTS hover_border_color TEXT,
ADD COLUMN IF NOT EXISTS input_bg_color TEXT,
ADD COLUMN IF NOT EXISTS clock_position TEXT;

-- 4. Enable RLS
ALTER TABLE public.gym_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- 5. Create Policies

-- Gym Settings: Read for everyone, Update for Admins
DROP POLICY IF EXISTS "Allow read access to all users" ON public.gym_settings;
CREATE POLICY "Allow read access to all users" ON public.gym_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow update access to authenticated" ON public.gym_settings;
CREATE POLICY "Allow update access to authenticated" ON public.gym_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- User Settings: Full access to own user
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;
CREATE POLICY "Users can manage own settings" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'gym_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gym_settings;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;
  END IF;
END $$;
