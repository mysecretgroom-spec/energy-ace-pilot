-- Table pour enregistrer toutes les actions de l'agent WhatsApp avec possibilité d'annulation
CREATE TABLE public.whatsapp_agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  message_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- 'create_rdv', 'update_rdv', 'cancel_rdv', 'update_vente', 'create_frais', etc.
  target_table TEXT NOT NULL, -- 'rdv', 'ventes', 'frais', 'clients'
  target_id UUID NOT NULL, -- ID de l'enregistrement modifié
  action_data JSONB NOT NULL DEFAULT '{}', -- Données de l'action (nouveau statut, nouvelle date, etc.)
  previous_data JSONB, -- Snapshot des données AVANT l'action (pour annulation)
  description TEXT NOT NULL, -- Description lisible de l'action
  is_undone BOOLEAN DEFAULT FALSE,
  undone_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour performance
CREATE INDEX idx_whatsapp_agent_actions_user_id ON public.whatsapp_agent_actions(user_id);
CREATE INDEX idx_whatsapp_agent_actions_created_at ON public.whatsapp_agent_actions(created_at DESC);
CREATE INDEX idx_whatsapp_agent_actions_target ON public.whatsapp_agent_actions(target_table, target_id);

-- Enable RLS
ALTER TABLE public.whatsapp_agent_actions ENABLE ROW LEVEL SECURITY;

-- Politique: chaque utilisateur ne voit QUE ses propres actions
CREATE POLICY "Users can view their own agent actions"
ON public.whatsapp_agent_actions
FOR SELECT
USING (auth.uid() = user_id);

-- Politique: seul le système (service_role) peut insérer
CREATE POLICY "Service role can insert agent actions"
ON public.whatsapp_agent_actions
FOR INSERT
WITH CHECK (true);

-- Politique: utilisateur peut marquer ses actions comme annulées
CREATE POLICY "Users can update their own agent actions"
ON public.whatsapp_agent_actions
FOR UPDATE
USING (auth.uid() = user_id);

-- Fonction pour annuler une action de l'agent
CREATE OR REPLACE FUNCTION public.undo_agent_action(p_action_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action RECORD;
  v_result JSONB;
BEGIN
  -- Récupérer l'action
  SELECT * INTO v_action FROM public.whatsapp_agent_actions 
  WHERE id = p_action_id AND user_id = auth.uid();
  
  IF v_action IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Action non trouvée');
  END IF;
  
  IF v_action.is_undone THEN
    RETURN jsonb_build_object('success', false, 'error', 'Action déjà annulée');
  END IF;
  
  IF v_action.previous_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible d''annuler: pas de données précédentes');
  END IF;
  
  -- Restaurer les données selon la table cible
  CASE v_action.target_table
    WHEN 'rdv' THEN
      UPDATE public.rdv 
      SET 
        status = COALESCE((v_action.previous_data->>'status')::rdv_status, status),
        date_heure = COALESCE((v_action.previous_data->>'date_heure')::timestamptz, date_heure),
        updated_at = now()
      WHERE id = v_action.target_id AND user_id = auth.uid();
      
    WHEN 'ventes' THEN
      UPDATE public.ventes
      SET 
        status = COALESCE((v_action.previous_data->>'status')::vente_status, status),
        updated_at = now()
      WHERE id = v_action.target_id AND user_id = auth.uid();
      
    WHEN 'frais' THEN
      -- Pour les frais créés, on les supprime
      IF v_action.action_type = 'create_frais' THEN
        DELETE FROM public.frais WHERE id = v_action.target_id AND user_id = auth.uid();
      END IF;
      
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Table non supportée pour annulation');
  END CASE;
  
  -- Marquer l'action comme annulée
  UPDATE public.whatsapp_agent_actions
  SET is_undone = true, undone_at = now()
  WHERE id = p_action_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Action annulée avec succès');
END;
$$;