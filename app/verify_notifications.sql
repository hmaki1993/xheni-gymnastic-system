-- ============================================================================
-- VERIFY NOTIFICATIONS SYSTEM
-- ============================================================================

DO $$
DECLARE
    pub_exists BOOLEAN;
    table_in_pub BOOLEAN;
BEGIN
    -- 1. Check if 'supabase_realtime' publication exists
    SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') INTO pub_exists;
    
    IF pub_exists THEN
        RAISE NOTICE '✅ Publication "supabase_realtime" exists.';
        
        -- 2. Check if 'notifications' table is in the publication
        SELECT EXISTS (
            SELECT 1 
            FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'notifications'
        ) INTO table_in_pub;
        
        IF table_in_pub THEN
            RAISE NOTICE '✅ Table "notifications" is IN the publication.';
        ELSE
            RAISE NOTICE '❌ Table "notifications" is NOT in the publication. Attempting to add...';
            EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
            RAISE NOTICE '✅ Added "notifications" to publication.';
        END IF;
    ELSE
        RAISE NOTICE '❌ Publication "supabase_realtime" does NOT exist. This is unusual for Supabase.';
    END IF;

    -- 3. Insert a TEST Global Notification (Visible to ALL users)
    INSERT INTO public.notifications (title, message, type, user_id, is_read)
    VALUES (
        'System Test 🔔', 
        'If you see this, Realtime notifications are working perfectly! 🚀', 
        'info', 
        NULL, -- NULL means Global (all users)
        FALSE
    );
    
    RAISE NOTICE '✅ Inserted test notification. Check your app header!';
    
END $$;
