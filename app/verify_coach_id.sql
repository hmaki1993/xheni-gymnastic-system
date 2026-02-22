-- GET CORRECT COACH ID FOR mosa@xheni.com
-- This will show you the exact coach_id that should be used

SELECT 
    'CORRECT COACH ID' as info,
    c.id as coach_id,
    c.email,
    c.profile_id,
    c.full_name,
    p.id as profile_id_check,
    u.id as auth_user_id
FROM public.coaches c
JOIN public.profiles p ON c.profile_id = p.id
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'mosa@xheni.com';

-- Also check if there are any attendance records with wrong coach_id
SELECT 
    'INVALID ATTENDANCE RECORDS' as info,
    ca.*
FROM public.coach_attendance ca
WHERE ca.coach_id NOT IN (SELECT id FROM public.coaches);
