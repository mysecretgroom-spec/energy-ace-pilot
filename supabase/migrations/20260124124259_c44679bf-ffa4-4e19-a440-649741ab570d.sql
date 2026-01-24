-- Drop the google_tokens_secure VIEW (security risk - exposes OAuth tokens)
DROP VIEW IF EXISTS public.google_tokens_secure;