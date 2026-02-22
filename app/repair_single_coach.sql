-- SURGICAL REPAIR FOR ONE COACH (TEST)
-- This script resets ONE account to guaranteed working state.
-- Please replace 'test@coach.com' with an actual legacy coach email.

DO $$
DECLARE
    target_email text := 'mosa@xheni.com'; -- <--- CHANGE THIS
    target_pw text := '123456';
    target_id uuid;
    coach_name text;
    coach_role text;
BEGIN
    -- 1. Get coach info
    SELECT full_name, role INTO coach_name, coach_role 
    FROM public.coaches WHERE LOWER(email) = LOWER(target_email);

    IF coach_name IS NULL THEN
        RAISE EXCEPTION 'Coach with email % not found in public.coaches', target_email;
    END IF;

    -- 2. Cleanup ANY existing auth/profile data for this email (Total Reset)
    -- First, unlink coach to avoid cascade delete if we delete profile
    UPDATE public.coaches SET profile_id = NULL WHERE LOWER(email) = LOWER(target_email);
    
    -- Delete existing profile if any
    DELETE FROM public.profiles WHERE LOWER(email) = LOWER(target_email);

    -- Delete auth user (this usually triggers profile deletion anyway, but we do it manually to be safe)
    DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = LOWER(target_email));
    DELETE FROM auth.users WHERE email = LOWER(target_email);

    -- 3. Create fresh ID
    target_id := gen_random_uuid();

    -- 4. Insert into auth.users with EVERY field explicitly set
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        aud,
        role,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        is_sso_user,
        created_at,
        updated_at,
        last_sign_in_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    ) VALUES (
        target_id,
        '00000000-0000-0000-0000-000000000000',
        LOWER(target_email),
        crypt(target_pw, gen_salt('bf', 10)),
        now(),
        'authenticated',
        'authenticated',
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        jsonb_build_object('full_name', coach_name, 'role', LOWER(coach_role)),
        false,
        false,
        now(),
        now(),
        NULL,
        '',
        '',
        '',
        ''
    );

    -- 5. Insert into auth.identities (Matches working structure)
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id, -- Some projects use Email here, some use UUID. We'll use UUID as seen in your screenshot.
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        target_id,
        format('{"sub": "%s", "email": "%s"}', target_id::text, LOWER(target_email))::jsonb,
        'email',
        target_id::text,
        NULL,
        now(),
        now()
    );

    -- 6. Link to public.profiles and public.coaches
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (target_id, LOWER(target_email), coach_name, LOWER(coach_role)::user_role)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role;

    UPDATE public.coaches 
    SET profile_id = target_id,
        email = LOWER(target_email)
    WHERE id IN (SELECT id FROM public.coaches WHERE LOWER(email) = LOWER(target_email));

    RAISE NOTICE 'SUCCESS: Account for % rebuilt. ID: %', target_email, target_id;
END $$;

NOTIFY pgrst, 'reload';
