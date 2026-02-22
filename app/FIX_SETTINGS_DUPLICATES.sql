-- ----------------------------------------------------------------
-- FIX_SETTINGS_DUPLICATES.sql
-- Resolves PGRST116 (Multiple rows) and 409 (Conflict) errors
-- ----------------------------------------------------------------

-- 1. CLEAN UP public.gym_settings (Global Defaults)
-- Ensure only the most recently updated row remains
DELETE FROM public.gym_settings
WHERE id NOT IN (
    SELECT id FROM public.gym_settings
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1
);

-- Add singleton constraint to prevent future duplicates
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'gym_settings_singleton'
    ) THEN
        ALTER TABLE public.gym_settings ADD CONSTRAINT gym_settings_singleton UNIQUE (id);
        -- More effective for singleton: a unique index on a constant value
        CREATE UNIQUE INDEX IF NOT EXISTS gym_settings_singleton_idx ON public.gym_settings ((true));
    END IF;
END $$;


-- 2. CLEAN UP public.user_settings (User Personal Settings)
-- Keep only the newest row per user
DELETE FROM public.user_settings a
USING public.user_settings b
WHERE a.id < b.id
AND a.user_id = b.user_id;

-- Ensure strict UNIQUE constraint on user_id
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_user_id_key'
    ) THEN
        -- Delete any remaining duplicates just in case before adding constraint
        ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_key;
        ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- 3. ENSURE RLS DOES NOT BLOCK UPDATES
-- (Standard check)
ALTER TABLE public.gym_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_auth_all" ON public.gym_settings;
CREATE POLICY "allow_auth_all" ON public.gym_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_settings" ON public.user_settings;
CREATE POLICY "users_own_settings" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
