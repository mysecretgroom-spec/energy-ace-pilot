export type NodeType = 'trigger' | 'action' | 'condition' | 'fallback';
export type EdgeCondition = 'success' | 'failure' | 'timeout' | 'always';

export interface WorkflowNode {
  id: string;
  workflow_id: string;
  type: NodeType;
  label: string;
  config: Record<string, unknown>;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface WorkflowEdge {
  id: string;
  workflow_id: string;
  source_node_id: string;
  target_node_id: string;
  condition_type: EdgeCondition | null;
  condition_config: Record<string, unknown>;
  created_at: string;
}

export interface AIWorkflow {
  id: string;
  code: string;
  nom: string;
  description: string | null;
  categorie: string;
  actif: boolean;
  config: Record<string, unknown>;
  prompt_personnalise: string | null;
  canaux: string[];
  ordre: number;
}

export const NODE_COLORS: Record<NodeType, { bg: string; border: string; icon: string }> = {
  trigger: { bg: 'bg-green-500/10', border: 'border-green-500', icon: 'text-green-500' },
  action: { bg: 'bg-blue-500/10', border: 'border-blue-500', icon: 'text-blue-500' },
  condition: { bg: 'bg-amber-500/10', border: 'border-amber-500', icon: 'text-amber-500' },
  fallback: { bg: 'bg-red-500/10', border: 'border-red-500', icon: 'text-red-500' },
};

export const EDGE_COLORS: Record<EdgeCondition, string> = {
  success: '#22c55e',
  failure: '#ef4444',
  timeout: '#f59e0b',
  always: '#6b7280',
};

export const NODE_TEMPLATES: { type: NodeType; label: string; description: string }[] = [
  { type: 'trigger', label: 'Déclencheur', description: 'Point de départ du workflow' },
  { type: 'action', label: 'Action', description: 'Exécute une opération' },
  { type: 'condition', label: 'Condition', description: 'Branchement if/else' },
  { type: 'fallback', label: 'Fallback', description: 'Action de secours' },
];
