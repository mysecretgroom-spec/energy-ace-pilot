CREATE TABLE public.google_oauth_connections (
  user_id uuid PRIMARY KEY,
  access_token_ciphertext text NOT NULL,
  refresh_token_ciphertext text NOT NULL,
  expires_at timestamptz NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  email text,
  root_folder_id text,
  reconnect_required boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.google_oauth_connections TO service_role;
ALTER TABLE public.google_oauth_connections ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.google_oauth_states (
  state_hash text PRIMARY KEY,
  user_id uuid NOT NULL,
  verifier_ciphertext text NOT NULL,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL
);
GRANT ALL ON public.google_oauth_states TO service_role;
ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;