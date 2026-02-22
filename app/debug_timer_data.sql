-- CHECK TODAY'S ATTENDANCE DATA FOR COACHES

-- 1. Check current date in DB
SELECT CURRENT_DATE as db_today, NOW() as db_now, timezone('UTC', NOW()) as utc_now;

-- 2. Check attendance records for today (mosa@xheni.com)
SELECT 
    'ATTENDANCE RECORD' as info,
    sa.id,
    sa.coach_id,
    c.email,
    sa.date,
    sa.check_in_time,
    sa.check_out_time,
    sa.status
FROM public.coach_attendance sa
JOIN public.coaches c ON sa.coach_id = c.id
WHERE c.email = 'mosa@xheni.com'
AND sa.date = CURRENT_DATE;

-- 3. Check if there are any records with the malformed ID left
SELECT 
    'ORPHANED RECORDS' as info,
    sa.id,
    sa.coach_id,
    sa.date,
    sa.check_in_time
FROM public.coach_attendance sa
LEFT JOIN public.coaches c ON sa.coach_id = c.id
WHERE c.id IS NULL;
