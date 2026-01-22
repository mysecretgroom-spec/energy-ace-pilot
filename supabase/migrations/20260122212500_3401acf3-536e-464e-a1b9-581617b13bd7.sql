-- Fix: Change the view to use SECURITY INVOKER (default) instead of SECURITY DEFINER
-- Drop and recreate the view without SECURITY DEFINER
DROP VIEW IF EXISTS google_tokens_secure;

-- Recreate with explicit SECURITY INVOKER (the safe default)
CREATE VIEW google_tokens_secure 
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  decrypt_token(access_token) as access_token,
  decrypt_token(refresh_token) as refresh_token,
  expires_at,
  scopes,
  created_at,
  updated_at
FROM google_tokens
WHERE auth.uid() = user_id;

-- Grant access to the view
GRANT SELECT ON google_tokens_secure TO authenticated;