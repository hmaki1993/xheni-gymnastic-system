    -- MEGA FIX: RESOLVE UUID MISMATCH AND FOREIGN KEY ERRORS
    -- Run this ONCE to fix mosa's account forever

    DO $$ 
    BEGIN
        -- 1. Drop the bad constraint if it exists
        ALTER TABLE IF EXISTS public.coach_attendance 
        DROP CONSTRAINT IF EXISTS coach_attendance_coach_id_fkey;

        -- 2. Clean up malformed ID in coaches table
        -- Correct ID should be 36 chars: d5a7a9bc-98c5-4820-b6b8-098d2d8bde49
        UPDATE public.coaches
        SET id = 'd5a7a9bc-98c5-4820-b6b8-098d2d8bde49'::uuid
        WHERE email = 'mosa@xheni.com';

        -- 3. Fix any existing attendance records to match
        UPDATE public.coach_attendance
        SET coach_id = 'd5a7a9bc-98c5-4820-b6b8-098d2d8bde49'::uuid
        WHERE coach_id::text LIKE 'd5a7a9bc-98c5-4820%';

        -- 4. Recreate the correct constraint pointing to COACHES (not profiles)
        ALTER TABLE public.coach_attendance
        ADD CONSTRAINT coach_attendance_coach_id_fkey
        FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE CASCADE;

        -- 5. Refresh PostgREST cache
        PERFORM (SELECT 1 FROM pg_notify('pgrst', 'reload'));

        RAISE NOTICE 'Fix applied successfully';
    END $$;

    -- 6. Verify and Test Insert
    INSERT INTO public.coach_attendance (coach_id, date, check_in_time, status)
    VALUES ('d5a7a9bc-98c5-4820-b6b8-098d2d8bde49'::uuid, CURRENT_DATE, NOW(), 'present')
    ON CONFLICT (coach_id, date) DO UPDATE
    SET check_in_time = NOW(),
        status = 'present',
        check_out_time = NULL
    RETURNING 
        '✅ SUCCESSFUL CHECK-IN' as status,
        coach_id,
        to_char(check_in_time, 'HH24:MI:SS') as time;
