CREATE TABLE public.agent_step_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  run_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  step TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_step_logs_user_created ON public.agent_step_logs(user_id, created_at DESC);
CREATE INDEX idx_agent_step_logs_run ON public.agent_step_logs(run_id);
GRANT SELECT ON public.agent_step_logs TO authenticated;
GRANT ALL ON public.agent_step_logs TO service_role;
ALTER TABLE public.agent_step_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own agent logs" ON public.agent_step_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.agent_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  nom TEXT NOT NULL,
  description TEXT,
  triggers TEXT[] NOT NULL DEFAULT '{}',
  intents TEXT[] NOT NULL DEFAULT '{}',
  procedure TEXT NOT NULL,
  exemples JSONB NOT NULL DEFAULT '[]'::jsonb,
  priorite INTEGER NOT NULL DEFAULT 100,
  actif BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_skills_user ON public.agent_skills(user_id) WHERE actif;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_skills TO authenticated;
GRANT ALL ON public.agent_skills TO service_role;
ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own and global skills" ON public.agent_skills FOR SELECT TO authenticated USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Manage own skills" ON public.agent_skills FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_agent_skills_updated_at BEFORE UPDATE ON public.agent_skills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.agent_session_memory (
  user_id UUID NOT NULL PRIMARY KEY,
  resume TEXT NOT NULL DEFAULT '',
  sujets_ouverts JSONB NOT NULL DEFAULT '[]'::jsonb,
  derniere_intent TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agent_session_memory TO authenticated;
GRANT ALL ON public.agent_session_memory TO service_role;
ALTER TABLE public.agent_session_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own session memory" ON public.agent_session_memory FOR SELECT TO authenticated USING (auth.uid() = user_id);

INSERT INTO public.agent_skills (user_id, nom, description, triggers, intents, procedure, priorite, source) VALUES
(NULL, 'Import de facture', 'Traiter une photo/PDF de facture ou ticket', ARRAY['facture','ticket','note de frais','reçu'], ARRAY['import_facture'], E'1. Lire montant TTC, date, fournisseur, catégorie.\n2. Si un champ est illisible ou douteux, le demander explicitement au lieu de deviner.\n3. Jamais de date future: si la date lue dépasse aujourd''hui, corriger à aujourd''hui et le signaler.\n4. Récapituler montant + date + fournisseur + catégorie et faire valider avant enregistrement.\n5. Si doublon probable, le dire et proposer d''enregistrer quand même.', 10, 'system'),
(NULL, 'Prise de rendez-vous', 'Créer un RDV terrain complet', ARRAY['rdv','rendez-vous','je vois','planifie'], ARRAY['create_rdv'], E'1. Exiger nom client + date + heure + adresse. La régie est obligatoire.\n2. Déduire la date des expressions ("demain", "jeudi prochain") mais confirmer la date calculée si elle a été inférée.\n3. Vérifier les conflits d''horaire dans le planning du jour et prévenir.\n4. Récapituler en une ligne claire, puis créer.', 10, 'system'),
(NULL, 'Suite de rendez-vous', 'Qualifier un RDV terminé (positif, R2, négatif)', ARRAY['signé','positif','négatif','r2','pas intéressé'], ARRAY['mark_signe','update_vente_pipeline'], E'1. Identifier le client concerné (dernier RDV du jour par défaut, mais confirmer si ambigu).\n2. Positif/signé: demander montant, produit et date de CQ si absents.\n3. R2: proposer directement la date du second rendez-vous.\n4. Toujours confirmer avant d''écrire une vente.', 20, 'system'),
(NULL, 'Question de paramétrage', 'Répondre sur prix, gammes, aides, commissions', ARRAY['prix','commission','aide','gamme','surcoût','financement'], ARRAY['conversation'], E'1. Répondre uniquement à partir du paramétrage injecté (régies, bouquets, aides, règles de commission).\n2. Donner le chiffre exact et sa source (régie / gamme / bouquet).\n3. Si l''info n''est pas dans le paramétrage, le dire clairement et proposer de la configurer.\n4. Ne jamais inventer un prix ou un taux.', 30, 'system');