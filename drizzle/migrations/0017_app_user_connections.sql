CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  reconnect_required boolean NOT NULL DEFAULT false,
  root_folder_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE ON public.drive_uploads TO service_role;
CREATE UNIQUE INDEX drive_uploads_doc_sent_idx ON public.drive_uploads (user_id, document_id) WHERE document_id IS NOT NULL AND status = 'sent';
CREATE UNIQUE INDEX drive_uploads_etude_sent_idx ON public.drive_uploads (user_id, etude_id) WHERE etude_id IS NOT NULL AND document_id IS NULL AND status = 'sent';