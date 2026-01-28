-- Table pour les documents en attente d'attribution
CREATE TABLE public.pending_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  source TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp', 'web_chat', 'email'
  
  -- Analyse IA
  ai_detected_client_name TEXT,
  ai_detected_client_id UUID REFERENCES public.clients(id),
  ai_detected_document_type TEXT,
  ai_confidence INTEGER DEFAULT 0, -- 0-100
  ai_analysis_summary TEXT,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'auto_assigned', 'manually_assigned', 'rejected')),
  assigned_client_id UUID REFERENCES public.clients(id),
  assigned_document_type TEXT,
  assigned_by UUID, -- NULL = auto, sinon = admin user_id
  assigned_at TIMESTAMPTZ,
  
  -- Notifications
  admin_notified_at TIMESTAMPTZ,
  auto_assign_after TIMESTAMPTZ, -- Date limite avant auto-attribution
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  final_document_id UUID REFERENCES public.documents(id)
);

-- Index pour performance
CREATE INDEX idx_pending_documents_status ON public.pending_documents(status);
CREATE INDEX idx_pending_documents_user_id ON public.pending_documents(user_id);
CREATE INDEX idx_pending_documents_auto_assign ON public.pending_documents(auto_assign_after) WHERE status = 'pending';

-- RLS - Visible uniquement par les admins et le propriétaire
ALTER TABLE public.pending_documents ENABLE ROW LEVEL SECURITY;

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all pending documents" 
ON public.pending_documents 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM saas.admin_users 
    WHERE user_id = auth.uid()
  )
);

-- Les admins peuvent modifier
CREATE POLICY "Admins can update pending documents" 
ON public.pending_documents 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM saas.admin_users 
    WHERE user_id = auth.uid()
  )
);

-- Le propriétaire peut voir ses documents en attente
CREATE POLICY "Users can view their own pending documents" 
ON public.pending_documents 
FOR SELECT 
USING (auth.uid() = user_id);

-- Insert depuis les edge functions (service role)
CREATE POLICY "Service role can insert pending documents" 
ON public.pending_documents 
FOR INSERT 
WITH CHECK (true);

-- Créer le bucket pour les documents en attente
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pending-documents', 'pending-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS pour le bucket - lecture admin uniquement
CREATE POLICY "Admins can read pending documents storage" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'pending-documents' AND
  EXISTS (
    SELECT 1 FROM saas.admin_users 
    WHERE user_id = auth.uid()
  )
);

-- Upload depuis edge functions
CREATE POLICY "Service can upload to pending documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'pending-documents');

-- Admins peuvent supprimer
CREATE POLICY "Admins can delete pending documents storage" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'pending-documents' AND
  EXISTS (
    SELECT 1 FROM saas.admin_users 
    WHERE user_id = auth.uid()
  )
);