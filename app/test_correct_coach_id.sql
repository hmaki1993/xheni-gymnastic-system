-- TEST COACH CHECK-IN WITH CORRECT ID
-- Use the actual coach_id from the database

-- 1. Verify the correct coach_id for mosa
SELECT 
    'CORRECT COACH ID' as info,
    c.id as coach_id,
    c.email,
    c.full_name,
    c.profile_id
FROM public.coaches c
WHERE c.email = 'mosa@xheni.com';

-- 2. Delete any old/invalid attendance records
DELETE FROM public.coach_attendance
WHERE coach_id NOT IN (SELECT id FROM public.coaches);

-- 3. Try to insert with the CORRECT coach_id
INSERT INTO public.coach_attendance (coach_id, date, check_in_time, status)
VALUES ('d5a7a9bc-98c5-4820-b6b8-098d2d8bde49', CURRENT_DATE, NOW(), 'present')
ON CONFLICT (coach_id, date) DO UPDATE
SET check_in_time = NOW(),
    status = 'present',
    check_out_time = NULL
RETURNING 
    'SUCCESS!' as result,
    id,
    coach_id,
    date,
    check_in_time,
    status;
