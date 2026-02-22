-- FINAL COMPREHENSIVE FIX - ALL PROBLEMS IN ONE SCRIPT
-- This will fix the UUID issue and enable check-in

-- Step 1: Drop the problematic foreign key temporarily
ALTER TABLE public.coach_attendance DROP CONSTRAINT IF EXISTS coach_attendance_coach_id_fkey;

-- Step 2: Update the invalid UUID in coaches table
UPDATE public.coaches
SET id = 'd5a7a9bc-98c5-4820-b6b8-098d2d8bde49'::uuid
WHERE email = 'mosa@xheni.com';

-- Step 3: Update any existing attendance records with the old UUID
UPDATE public.coach_attendance
SET coach_id = 'd5a7a9bc-98c5-4820-b6b8-098d2d8bde49'::uuid
WHERE coach_id::text LIKE 'd5a7a9bc-98c5-4820-b6b8-098d2d8bde49%';

-- Step 4: Recreate the foreign key constraint pointing to coaches
ALTER TABLE public.coach_attendance
ADD CONSTRAINT coach_attendance_coach_id_fkey
FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE CASCADE;

-- Step 5: Force cache refresh
NOTIFY pgrst, 'reload';

-- Step 6: Test check-in
INSERT INTO public.coach_attendance (coach_id, date, check_in_time, status)
VALUES ('d5a7a9bc-98c5-4820-b6b8-098d2d8bde49'::uuid, CURRENT_DATE, NOW(), 'present')
ON CONFLICT (coach_id, date) DO UPDATE
SET check_in_time = NOW(),
    status = 'present',
    check_out_time = NULL
RETURNING 
    '✅ SUCCESS!' as result,
    coach_id,
    to_char(check_in_time, 'HH24:MI:SS') as check_in_time,
    status;
