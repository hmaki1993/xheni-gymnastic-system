-- FIX ALL SETTINGS COLUMNS
-- This script aligns the database schema with the frontend expectations

-- 1. FIX GYM SETTINGS (Aliases)
-- The frontend sends these specific keys, so we need columns for them
ALTER TABLE public.gym_settings 
ADD COLUMN IF NOT EXISTS gym_address TEXT,
ADD COLUMN IF NOT EXISTS gym_phone TEXT,
ADD COLUMN IF NOT EXISTS academy_name TEXT;

-- Sync values from existing columns to new aliases
UPDATE public.gym_settings 
SET 
  gym_address = COALESCE(gym_address, address, 'Cairo, Egypt'),
  gym_phone = COALESCE(gym_phone, phone, '+20 123 456 7890'),
  academy_name = COALESCE(academy_name, gym_name, 'Xheni Academy');

-- 2. FIX USER SETTINGS (Missing Colors)
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS premium_badge_color TEXT,
ADD COLUMN IF NOT EXISTS brand_label_color TEXT;

-- 3. RELOAD SCHEMA
NOTIFY pgrst, 'reload config';

-- 4. VERIFY
SELECT 
  'gym_settings columns' as check_type,
  column_name 
FROM information_schema.columns 
WHERE table_name = 'gym_settings' 
AND column_name IN ('gym_address', 'gym_phone', 'academy_name');
