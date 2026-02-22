-- LIST ALL COACHES AND FIND MOSA

-- 1. List all coaches
SELECT 
    'ALL COACHES' as info,
    c.id,
    c.email,
    c.full_name,
    c.profile_id
FROM public.coaches c
ORDER BY c.email;

-- 2. Find coach by profile_id (mosa's profile_id from earlier)
SELECT 
    'MOSA BY PROFILE_ID' as info,
    c.id,
    c.email,
    c.full_name,
    c.profile_id
FROM public.coaches c
WHERE c.profile_id = '793a3126-f45b-4f4b-9b3a-22b4173db8f2';

-- 3. Find coach by email
SELECT 
    'MOSA BY EMAIL' as info,
    c.id,
    c.email,
    c.full_name,
    c.profile_id
FROM public.coaches c
WHERE c.email = 'mosa@xheni.com';

-- 4. Check if the ID we're looking for exists anywhere
SELECT 
    'SEARCHING FOR ID' as info,
    c.*
FROM public.coaches c
WHERE c.id::text LIKE '%d5a7a8bc%';
