-- FORCE SCHEMA CACHE RELOAD
-- Sometimes NOTIFY pgrst, 'reload' is insufficient if the connection is pooled or unresponsive.
-- Changing table metadata (like adding a comment) forces a refresh.

COMMENT ON TABLE public.students IS 'Students table - Schema Refreshed (Forced Reload)';
COMMENT ON TABLE public.coaches IS 'Coaches table - Schema Refreshed (Forced Reload)';
COMMENT ON TABLE public.subscription_plans IS 'Subscription Plans table - Schema Refreshed (Forced Reload)';
COMMENT ON TABLE public.training_groups IS 'Training Groups table - Schema Refreshed (Forced Reload)';

-- Also try the standard reload notification again
NOTIFY pgrst, 'reload';
