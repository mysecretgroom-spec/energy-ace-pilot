-- Add retape columns to clients table
ALTER TABLE public.clients 
ADD COLUMN is_retape boolean DEFAULT false,
ADD COLUMN retape_original_id uuid REFERENCES public.clients(id);

-- Create index for filtering retape clients
CREATE INDEX idx_clients_is_retape ON public.clients(is_retape);

-- Add comment
COMMENT ON COLUMN public.clients.is_retape IS 'Indique si ce client est un doublon créé en mode retape HEJJA';
COMMENT ON COLUMN public.clients.retape_original_id IS 'Référence au client original dont ce retape est une copie';