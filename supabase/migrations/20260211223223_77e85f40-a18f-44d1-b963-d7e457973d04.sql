
-- Table pour l'historique des changements de statut des ventes
CREATE TABLE public.vente_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vente_id UUID NOT NULL REFERENCES public.ventes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour requêtes rapides
CREATE INDEX idx_vente_status_history_vente ON public.vente_status_history(vente_id);
CREATE INDEX idx_vente_status_history_changed ON public.vente_status_history(changed_at DESC);

-- RLS
ALTER TABLE public.vente_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vente status history"
ON public.vente_status_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert status history"
ON public.vente_status_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Trigger pour logger automatiquement les changements de statut
CREATE OR REPLACE FUNCTION public.log_vente_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.vente_status_history (vente_id, user_id, old_status, new_status)
    VALUES (NEW.id, NEW.user_id, OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vente_status_change
AFTER UPDATE ON public.ventes
FOR EACH ROW
EXECUTE FUNCTION public.log_vente_status_change();

-- Activer realtime pour mise à jour instantanée
ALTER PUBLICATION supabase_realtime ADD TABLE public.vente_status_history;
