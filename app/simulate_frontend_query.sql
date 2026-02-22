-- SIMULATE FRONTEND QUERY FROM useData.ts

-- 1. Check Date Formats
SELECT 
    CURRENT_DATE as db_date,
    to_char(CURRENT_DATE, 'YYYY-MM-DD') as db_date_str,
    NOW() as db_now;

-- 2. Check coaches data seen by frontend
SELECT 
    id, 
    full_name, 
    email, 
    profile_id
FROM public.coaches
WHERE email = 'mosa@xheni.com';

-- 3. Check attendance data seen by frontend
-- Note: frontend uses: where date = 'YYYY-MM-DD'
SELECT 
    coach_id, 
    date, 
    check_in_time, 
    check_out_time
FROM public.coach_attendance
WHERE date = CURRENT_DATE;

-- 4. Verify ID matching (the key join)
SELECT 
    c.full_name,
    ca.date,
    ca.check_in_time,
    (NOW() - ca.check_in_time) as raw_duration,
    extract(epoch from (NOW() - ca.check_in_time)) as duration_seconds
FROM public.coaches c
JOIN public.coach_attendance ca ON c.id = ca.coach_id
WHERE c.email = 'mosa@xheni.com'
AND ca.date = CURRENT_DATE;
