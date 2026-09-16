
CREATE TABLE IF NOT EXISTS public.email_frais_filtres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terme text NOT NULL,
  champ text NOT NULL DEFAULT 'sujet' CHECK (champ IN ('sujet','contenu','tout')),
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_frais_filtres TO authenticated;
GRANT ALL ON public.email_frais_filtres TO service_role;
ALTER TABLE public.email_frais_filtres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own receipt email filters"
  ON public.email_frais_filtres FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS email_frais_filtres_unique_terme
  ON public.email_frais_filtres (user_id, champ, lower(terme));

CREATE TABLE IF NOT EXISTS public.gmail_frais_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_message_id text NOT NULL,
  attachment_key text NOT NULL DEFAULT '',
  frais_id uuid REFERENCES public.frais(id) ON DELETE SET NULL,
  statut text NOT NULL DEFAULT 'importe' CHECK (statut IN ('importe','ignore','erreur')),
  sujet text,
  expediteur text,
  erreur text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_frais_imports TO authenticated;
GRANT ALL ON public.gmail_frais_imports TO service_role;
ALTER TABLE public.gmail_frais_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own receipt email imports"
  ON public.gmail_frais_imports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS gmail_frais_imports_unique_msg
  ON public.gmail_frais_imports (user_id, gmail_message_id, attachment_key);

CREATE TRIGGER update_email_frais_filtres_updated_at
  BEFORE UPDATE ON public.email_frais_filtres
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS gmail_frais_sync_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gmail_frais_sync_interval_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS gmail_frais_last_auto_sync timestamptz;
