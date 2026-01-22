-- Extend document_type enum with new values
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'facture_frais';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'photo_chantier';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'contrat';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'plan';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'assurance';

-- Add new columns to documents table for scanner functionality
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS context_source TEXT DEFAULT 'client_docs',
ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS thumbnails_urls TEXT[],
ADD COLUMN IF NOT EXISTS extracted_text TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add document_id to frais table to link expenses with scanned documents
ALTER TABLE frais
ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_frais_document_id ON frais(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_context_source ON documents(context_source);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id);