-- Performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_ventes_user_status ON public.ventes (user_id, status);
CREATE INDEX IF NOT EXISTS idx_ventes_user_date_signature ON public.ventes (user_id, date_signature DESC);
CREATE INDEX IF NOT EXISTS idx_rdv_user_date ON public.rdv (user_id, date_heure DESC);
CREATE INDEX IF NOT EXISTS idx_rdv_user_status ON public.rdv (user_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_user_created ON public.clients (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_client ON public.documents (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_frais_user_date ON public.frais (user_id, date_frais DESC);
CREATE INDEX IF NOT EXISTS idx_etudes_user_client ON public.etudes (user_id, client_id);
CREATE INDEX IF NOT EXISTS idx_bouquets_active_puissance ON public.bouquets (actif, puissance_kwc) WHERE actif = true;
CREATE INDEX IF NOT EXISTS idx_commissions_vente ON public.commissions (vente_id);
