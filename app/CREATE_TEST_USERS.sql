-- Create Test Admin User
-- Email: admin@xheni.com
-- Password: admin123
-- This SQL should be run in Supabase SQL Editor

-- Note: You cannot directly insert into auth.users via SQL for security reasons
-- Instead, use the Register page in the app or Supabase Dashboard

-- Instructions:
-- 1. Go to your app's Register page: http://localhost:5173/register
-- 2. Create an account with:
--    - Full Name: Admin User
--    - Email: admin@xheni.com
--    - Password: admin123
--    - Account Type: Admin
--
-- 3. Create another account for testing:
--    - Full Name: Coach User
--    - Email: coach@xheni.com
--    - Password: coach123
--    - Account Type: Coach

-- Alternatively, use Supabase Dashboard:
-- 1. Go to Authentication > Users
-- 2. Click "Add user"
-- 3. Enter email and password
-- 4. After creating, go to SQL Editor and run:

-- UPDATE auth.users 
-- SET raw_user_meta_data = jsonb_set(
--     raw_user_meta_data, 
--     '{role}', 
--     '"admin"'
-- )
-- WHERE email = 'admin@xheni.com';
