-- Add workflow nodes table for the visual editor
CREATE TABLE public.ai_workflow_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.ai_workflows(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('trigger', 'action', 'condition', 'fallback')),
  label TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  position_x NUMERIC NOT NULL DEFAULT 0,
  position_y NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add workflow edges (connections between nodes)
CREATE TABLE public.ai_workflow_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.ai_workflows(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES public.ai_workflow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.ai_workflow_nodes(id) ON DELETE CASCADE,
  condition_type TEXT CHECK (condition_type IN ('success', 'failure', 'timeout', 'always')),
  condition_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_node_id, target_node_id)
);

-- Enable RLS
ALTER TABLE public.ai_workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_workflow_edges ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (admin check done at app level)
CREATE POLICY "Authenticated users can read workflow nodes" ON public.ai_workflow_nodes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage workflow nodes" ON public.ai_workflow_nodes
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read workflow edges" ON public.ai_workflow_edges
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage workflow edges" ON public.ai_workflow_edges
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Indexes for performance
CREATE INDEX idx_workflow_nodes_workflow ON public.ai_workflow_nodes(workflow_id);
CREATE INDEX idx_workflow_edges_workflow ON public.ai_workflow_edges(workflow_id);
CREATE INDEX idx_workflow_edges_source ON public.ai_workflow_edges(source_node_id);
CREATE INDEX idx_workflow_edges_target ON public.ai_workflow_edges(target_node_id);