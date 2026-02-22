-- FIX INVALID UUID IN COACHES TABLE
-- The coach_id has an extra 'e' at the end making it 37 characters instead of 36

-- 1. Show the problematic record
SELECT 
    'BEFORE FIX' as status,
    id,
    email,
    full_name,
    length(id::text) as uuid_length,
    profile_id
FROM public.coaches
WHERE email = 'mosa@xheni.com';

-- 2. Fix the UUID by removing the extra 'e'
UPDATE public.coaches
SET id = 'd5a7a9bc-98c5-4820-b6b8-098d2d8bde49'::uuid
WHERE email = 'mosa@xheni.com'
AND id::text = 'd5a7a9bc-98c5-4820-b6b8-098d2d8bde49e';

-- 3. Verify the fix
SELECT 
    'AFTER FIX' as status,
    id,
    email,
    full_name,
    length(id::text) as uuid_length,
    profile_id
FROM public.coaches
WHERE email = 'mosa@xheni.com';

-- 4. Force cache refresh
DO $$ 
BEGIN 
    EXECUTE 'COMMENT ON TABLE public.coaches IS ''Fixed UUID: ' || NOW() || '''';
END $$;

NOTIFY pgrst, 'reload';

-- 5. Test coach check-in with the corrected UUID
INSERT INTO public.coach_attendance (coach_id, date, check_in_time, status)
VALUES ('d5a7a9bc-98c5-4820-b6b8-098d2d8bde49'::uuid, CURRENT_DATE, NOW(), 'present')
ON CONFLICT (coach_id, date) DO UPDATE
SET check_in_time = NOW(),
    status = 'present',
    check_out_time = NULL
RETURNING 
    'SUCCESS!' as result,
    id,
    coach_id,
    date,
    to_char(check_in_time, 'HH24:MI:SS') as check_in_time,
    status;
