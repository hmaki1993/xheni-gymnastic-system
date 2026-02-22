-- VERIFY ATTENDANCE STATUS AND DURATION LOGIC

SELECT 
    c.full_name,
    ca.check_in_time,
    ca.check_out_time,
    CASE 
        WHEN ca.check_in_time IS NOT NULL AND ca.check_out_time IS NULL THEN 'working'
        WHEN ca.check_out_time IS NOT NULL THEN 'done'
        ELSE 'away'
    END as status,
    extract(epoch from (NOW() - ca.check_in_time)) as seconds_elapsed,
    to_char(justify_interval(NOW() - ca.check_in_time), 'HH24"h "MI"m"') as formatted_worked
FROM public.coaches c
JOIN public.coach_attendance ca ON c.id = ca.coach_id
WHERE c.email = 'mosa@xheni.com'
AND ca.date = CURRENT_DATE;
