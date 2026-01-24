-- Add column to store WebAuthn credential ID for biometric authentication
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS webauthn_credential_id TEXT;