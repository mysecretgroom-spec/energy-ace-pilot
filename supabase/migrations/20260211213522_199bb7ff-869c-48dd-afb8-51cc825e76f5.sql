-- Add full-text search index on documents.extracted_text
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('french', coalesce(nom, '') || ' ' || coalesce(extracted_text, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_documents_search_vector ON public.documents USING gin(search_vector);

-- Add auto_analyze preference to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_analyze_docs boolean DEFAULT true;

-- Add AI-extracted fields to documents for structured data
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS ai_extracted_fields jsonb DEFAULT null;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS ai_classification_confidence real DEFAULT null;