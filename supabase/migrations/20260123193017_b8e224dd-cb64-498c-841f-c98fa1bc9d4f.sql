-- Create background jobs queue table
CREATE TABLE public.background_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_type TEXT NOT NULL, -- 'document_analysis', 'receipt_ocr', 'bouquet_extraction'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  payload JSONB NOT NULL DEFAULT '{}', -- Input data for the job
  result JSONB, -- Output data from the job
  error_message TEXT,
  priority INTEGER DEFAULT 0, -- Higher = more priority
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view their own jobs"
ON public.background_jobs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own jobs
CREATE POLICY "Users can create their own jobs"
ON public.background_jobs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own jobs (for cancellation)
CREATE POLICY "Users can update their own jobs"
ON public.background_jobs
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for efficient job processing
CREATE INDEX idx_background_jobs_pending ON public.background_jobs(status, priority DESC, created_at ASC)
WHERE status = 'pending';

CREATE INDEX idx_background_jobs_user ON public.background_jobs(user_id, created_at DESC);

-- Enable realtime for job status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.background_jobs;

-- Auto-update updated_at
CREATE TRIGGER update_background_jobs_updated_at
BEFORE UPDATE ON public.background_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();