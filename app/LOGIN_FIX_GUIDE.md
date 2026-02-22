# 🚀 Quick Start Guide - Login Issue Fix

## Problem
The app loads but login fails because no user accounts exist in the database yet.

## Solution: Create Test Accounts

### Option 1: Use the Register Page (Recommended) ✅

1. **Open the app** on your mobile/PC: `http://localhost:5173`
2. **Click "Sign Up"** (at the bottom of the login page)
3. **Create an Admin account:**
   - Full Name: `Admin User`
   - Email: `admin@xheni.com`
   - Password: `admin123`
   - Account Type: **Admin**
   - Click "Sign Up"

4. **You'll be automatically logged in!** 🎉

5. **(Optional) Create a Coach account:**
   - Logout first
   - Go to Register again
   - Full Name: `Coach User`
   - Email: `coach@xheni.com`
   - Password: `coach123`
   - Account Type: **Coach**

---

### Option 2: Use Supabase Dashboard (If Register doesn't work)

1. Go to: https://ycnteyzakmmeuqrcttmn.supabase.co
2. Navigate to **Authentication > Users**
3. Click **"Add user"**
4. Enter:
   - Email: `admin@xheni.com`
   - Password: `admin123`
   - Auto Confirm User: ✅ (check this!)
5. After creating the user, go to **SQL Editor** and run:
   ```sql
   UPDATE auth.users 
   SET raw_user_meta_data = jsonb_set(
       raw_user_meta_data, 
       '{role}', 
       '"admin"'
   )
   WHERE email = 'admin@xheni.com';
   ```

---

## After Creating Account

Now you can login with:
- **Email:** `admin@xheni.com`
- **Password:** `admin123`

---

## Still Having Issues?

If login still fails, check:
1. ✅ Is the dev server running? (`npm run dev`)
2. ✅ Is the Supabase URL correct in `.env`?
3. ✅ Check browser console for errors (F12)

Let me know and I'll help! 🚀
