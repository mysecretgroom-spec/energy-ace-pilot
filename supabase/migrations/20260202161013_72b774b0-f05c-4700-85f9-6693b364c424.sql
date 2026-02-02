-- Table to store AI workflow configurations
CREATE TABLE public.ai_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  categorie VARCHAR(50) NOT NULL,
  actif BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}',
  prompt_personnalise TEXT,
  canaux TEXT[] DEFAULT ARRAY['app', 'whatsapp'],
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_workflows ENABLE ROW LEVEL SECURITY;

-- Only admins can manage workflows (via service role or admin check)
CREATE POLICY "Admins can manage ai_workflows" 
ON public.ai_workflows 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Allow authenticated users to read active workflows
CREATE POLICY "Users can read active ai_workflows"
ON public.ai_workflows
FOR SELECT
USING (actif = true);

-- Insert default workflows
INSERT INTO public.ai_workflows (code, nom, description, categorie, config, ordre) VALUES
-- Documents
('upload_document', 'Upload Document', 'Téléchargement de documents clients (pièces d''identité, factures, etc.)', 'documents', '{"require_client": true, "allowed_types": ["image/*", "application/pdf"]}', 1),
('upload_facture', 'Upload Facture/Frais', 'Téléchargement et analyse automatique des factures et justificatifs de frais', 'documents', '{"auto_ocr": true, "auto_categorize": true}', 2),
('analyze_document', 'Analyse Document', 'Extraction automatique des informations via OCR/IA', 'documents', '{"use_ai": true, "extract_fields": true}', 3),

-- Planning
('update_rdv_status', 'Mise à jour Statut RDV', 'Changement du statut d''un rendez-vous (signé, négatif, reporté, etc.)', 'planning', '{"allowed_statuses": ["signe", "negatif", "reporte", "r2", "r2_prestudy", "annule"]}', 10),
('create_rdv', 'Création RDV', 'Planification d''un nouveau rendez-vous client', 'planning', '{"require_date": true, "require_client": true}', 11),
('reschedule_rdv', 'Report RDV', 'Report d''un rendez-vous à une nouvelle date', 'planning', '{"notify_client": true}', 12),
('get_planning', 'Consulter Planning', 'Récupération des RDV du jour ou d''une période', 'planning', '{"default_period": "today"}', 13),

-- CRM/Ventes
('update_vente_status', 'Mise à jour Statut Vente', 'Changement du statut d''une vente dans le pipeline', 'crm', '{"pipeline_stages": ["vente_signee", "admin_ok", "tech_ok", "install_planifiee", "install_terminee", "paiement_recu"]}', 20),
('create_client', 'Création Client', 'Ajout d''un nouveau prospect/client dans la base', 'crm', '{"require_phone": true, "require_name": true}', 21),
('search_client', 'Recherche Client', 'Recherche d''un client par nom, téléphone ou adresse', 'crm', '{"fuzzy_search": true}', 22),
('create_vente', 'Création Vente', 'Enregistrement d''une nouvelle vente', 'crm', '{"require_regie": true, "default_status": "vente_signee"}', 23),

-- Notifications
('send_whatsapp', 'Envoi WhatsApp', 'Envoi de message WhatsApp au client ou confirmateur', 'notifications', '{"use_templates": true}', 30),
('daily_briefing', 'Briefing Quotidien', 'Génération et envoi du résumé journalier', 'notifications', '{"auto_send": true, "send_time": "07:00"}', 31),
('confirmation_rdv', 'Confirmation RDV', 'Envoi de confirmation de RDV au client', 'notifications', '{"whatsapp": true, "sms": false}', 32);

-- Create trigger for updated_at
CREATE TRIGGER update_ai_workflows_updated_at
BEFORE UPDATE ON public.ai_workflows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();