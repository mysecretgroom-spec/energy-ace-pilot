import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Play, Zap, GitBranch, AlertTriangle, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NODE_COLORS, NodeType } from './types';
import { cn } from '@/lib/utils';

const nodeIcons: Record<NodeType, React.ElementType> = {
  trigger: Play,
  action: Zap,
  condition: GitBranch,
  fallback: AlertTriangle,
};

interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  type: NodeType;
  config: Record<string, unknown>;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function WorkflowNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  const nodeType = nodeData.type || 'action';
  const colors = NODE_COLORS[nodeType];
  const Icon = nodeIcons[nodeType];

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-xl border-2 min-w-[180px] shadow-lg transition-all',
        colors.bg,
        colors.border,
        selected && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      {/* Handles */}
      {nodeType !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
        />
      )}
      
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', colors.bg)}>
          <Icon className={cn('h-5 w-5', colors.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{nodeData.label}</p>
          <p className="text-xs text-muted-foreground capitalize">{nodeType}</p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onEdit?.(id);
            }}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onDelete?.(id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Source handles for different conditions */}
      {nodeType === 'condition' ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="success"
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-background !left-1/4"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="failure"
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-background !left-3/4"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-1">
            <span>✓ Oui</span>
            <span>✗ Non</span>
          </div>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
        />
      )}
    </div>
  );
}

export default memo(WorkflowNodeComponent);
