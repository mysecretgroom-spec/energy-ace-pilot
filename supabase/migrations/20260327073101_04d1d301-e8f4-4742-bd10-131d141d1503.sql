-- Ensure all auth users are in saas.users
INSERT INTO saas.users (user_id, email, first_name, last_name)
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'first_name',
  u.raw_user_meta_data->>'last_name'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM saas.users su WHERE su.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- Ensure all users have an access_state entry
INSERT INTO saas.access_state (user_id, trial_started_at, trial_ends_at, app_access)
SELECT 
  u.id,
  u.created_at,
  u.created_at + interval '10 days',
  'trial'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM saas.access_state a WHERE a.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;