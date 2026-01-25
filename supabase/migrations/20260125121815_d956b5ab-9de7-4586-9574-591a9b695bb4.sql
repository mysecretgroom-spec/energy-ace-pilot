-- Create table to store MFA verification sessions (backend-persisted for 6 hours)
CREATE TABLE public.mfa_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '6 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX idx_mfa_sessions_user_expires ON public.mfa_sessions (user_id, expires_at);

-- Enable RLS
ALTER TABLE public.mfa_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own MFA sessions
CREATE POLICY "Users can view their own MFA sessions"
ON public.mfa_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own MFA sessions"
ON public.mfa_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own MFA sessions"
ON public.mfa_sessions
FOR DELETE
USING (auth.uid() = user_id);

-- Function to check if user has valid MFA session (called from client)
CREATE OR REPLACE FUNCTION public.check_mfa_session_valid()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.mfa_sessions 
    WHERE user_id = auth.uid() 
    AND expires_at > now()
  );
END;
$$;

-- Function to store MFA verification (renews or creates session)
CREATE OR REPLACE FUNCTION public.store_mfa_verification()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Delete any existing sessions for this user
  DELETE FROM public.mfa_sessions WHERE user_id = auth.uid();
  
  -- Create new session with 6-hour validity
  INSERT INTO public.mfa_sessions (user_id, verified_at, expires_at)
  VALUES (auth.uid(), now(), now() + interval '6 hours')
  RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$;

-- Function to clear MFA session (on logout)
CREATE OR REPLACE FUNCTION public.clear_mfa_session()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.mfa_sessions WHERE user_id = auth.uid();
END;
$$;

-- Cleanup job: remove expired sessions (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_mfa_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.mfa_sessions WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;