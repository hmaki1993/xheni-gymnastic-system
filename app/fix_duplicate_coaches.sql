-- FIX DUPLICATE COACH RECORDS FOR mosa@xheni.com
-- This removes duplicate coach records and keeps only the most recent one

-- Step 1: Check for duplicates
SELECT 
    'DUPLICATE CHECK' as step,
    c.id,
    c.email,
    c.profile_id,
    c.full_name,
    c.created_at
FROM public.coaches c
WHERE c.email = 'mosa@xheni.com'
ORDER BY c.created_at DESC;

-- Step 2: Delete older duplicate records, keep the newest one
DELETE FROM public.coaches
WHERE id IN (
    SELECT id 
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
        FROM public.coaches
        WHERE email = 'mosa@xheni.com'
    ) t
    WHERE rn > 1
);

-- Step 3: Now fix the profile_id for the remaining record
UPDATE public.coaches c
SET profile_id = (
    SELECT p.id 
    FROM public.profiles p 
    JOIN auth.users u ON p.id = u.id
    WHERE u.email = 'mosa@xheni.com'
    LIMIT 1
)
WHERE c.email = 'mosa@xheni.com';

-- Step 4: Clean up orphaned attendance records
DELETE FROM public.coach_attendance
WHERE coach_id NOT IN (SELECT id FROM public.coaches);

-- Step 5: Verify the fix
SELECT 
    'FINAL STATE' as step,
    u.id as auth_id,
    u.email,
    p.id as profile_id,
    p.role,
    c.id as coach_id,
    c.profile_id as coach_profile_link,
    c.full_name
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.coaches c ON c.profile_id = p.id
WHERE u.email = 'mosa@xheni.com';

-- Step 6: Force cache refresh
DO $$ 
BEGIN 
    EXECUTE 'COMMENT ON TABLE public.coaches IS ''Cleaned duplicates: ' || NOW() || '''';
    EXECUTE 'COMMENT ON TABLE public.coach_attendance IS ''Cleaned duplicates: ' || NOW() || '''';
END $$;

NOTIFY pgrst, 'reload';
