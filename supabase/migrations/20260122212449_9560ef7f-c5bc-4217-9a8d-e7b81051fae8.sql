-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a function to encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_token(token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF token IS NULL THEN
    RETURN NULL;
  END IF;
  -- Use pgp_sym_encrypt with a server-side key from vault or config
  RETURN encode(pgp_sym_encrypt(token, current_setting('app.encryption_key', true)), 'base64');
EXCEPTION
  WHEN OTHERS THEN
    -- If encryption fails (e.g., key not set), return original token
    RETURN token;
END;
$$;

-- Create a function to decrypt sensitive data
CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  END IF;
  -- Try to decrypt, return original if it fails (for backward compatibility)
  BEGIN
    RETURN pgp_sym_decrypt(decode(encrypted_token, 'base64'), current_setting('app.encryption_key', true));
  EXCEPTION
    WHEN OTHERS THEN
      -- Return original value if decryption fails (unencrypted legacy data)
      RETURN encrypted_token;
  END;
END;
$$;

-- Add a view that automatically decrypts tokens for authorized users
CREATE OR REPLACE VIEW google_tokens_secure AS
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

-- Create a trigger to automatically encrypt tokens on insert/update
CREATE OR REPLACE FUNCTION encrypt_google_tokens_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only encrypt if encryption key is available
  IF current_setting('app.encryption_key', true) IS NOT NULL AND current_setting('app.encryption_key', true) != '' THEN
    NEW.access_token := encrypt_token(NEW.access_token);
    IF NEW.refresh_token IS NOT NULL THEN
      NEW.refresh_token := encrypt_token(NEW.refresh_token);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply the trigger
DROP TRIGGER IF EXISTS encrypt_tokens_before_insert ON google_tokens;
CREATE TRIGGER encrypt_tokens_before_insert
  BEFORE INSERT ON google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_google_tokens_trigger();

DROP TRIGGER IF EXISTS encrypt_tokens_before_update ON google_tokens;
CREATE TRIGGER encrypt_tokens_before_update
  BEFORE UPDATE ON google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_google_tokens_trigger();