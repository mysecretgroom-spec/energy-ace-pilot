-- Add all current users as admin in saas.admin_users
-- First, let's see the table structure and insert the main user
INSERT INTO saas.admin_users (user_id)
SELECT '5a4dbd65-5d57-4c29-ab17-fe339592039a'::uuid
WHERE NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = '5a4dbd65-5d57-4c29-ab17-fe339592039a');