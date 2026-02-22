-- FIX COACH LINKING FOR mosa@xheni.com
-- This script ensures the coach record is properly linked to the auth profile

-- Step 1: Check current state
SELECT 
    'BEFORE FIX - Auth User' as step,
    u.id as auth_id,
    u.email,
    p.id as profile_id,
    p.role
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'mosa@xheni.com';

SELECT 
    'BEFORE FIX - Coach Record' as step,
    c.id as coach_id,
    c.profile_id,
    c.email,
    c.full_name
FROM public.coaches c
WHERE c.email = 'mosa@xheni.com';

-- Step 2: Fix the profile_id linkage
UPDATE public.coaches c
SET profile_id = (
    SELECT p.id 
    FROM public.profiles p 
    JOIN auth.users u ON p.id = u.id
    WHERE u.email = 'mosa@xheni.com'
    LIMIT 1
)
WHERE c.email = 'mosa@xheni.com'
  AND c.profile_id IS NULL OR c.profile_id != (
    SELECT p.id 
    FROM public.profiles p 
    JOIN auth.users u ON p.id = u.id
    WHERE u.email = 'mosa@xheni.com'
    LIMIT 1
);

-- Step 3: Clean up any orphaned attendance records
DELETE FROM public.coach_attendance
WHERE coach_id NOT IN (SELECT id FROM public.coaches);

-- Step 4: Verify the fix
SELECT 
    'AFTER FIX - Complete Chain' as step,
    u.id as auth_id,
    u.email,
    p.id as profile_id,
    p.role,
    c.id as coach_id,
    c.full_name as coach_name
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.coaches c ON c.profile_id = p.id
WHERE u.email = 'mosa@xheni.com';

-- Step 5: Force cache refresh
DO $$ 
BEGIN 
    EXECUTE 'COMMENT ON TABLE public.coaches IS ''Fixed linking: ' || NOW() || '''';
    EXECUTE 'COMMENT ON TABLE public.coach_attendance IS ''Fixed linking: ' || NOW() || '''';
END $$;

NOTIFY pgrst, 'reload';
