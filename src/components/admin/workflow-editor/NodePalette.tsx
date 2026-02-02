import { Play, Zap, GitBranch, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NODE_COLORS, NODE_TEMPLATES, NodeType } from './types';
import { cn } from '@/lib/utils';

const nodeIcons: Record<NodeType, React.ElementType> = {
  trigger: Play,
  action: Zap,
  condition: GitBranch,
  fallback: AlertTriangle,
};

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: NodeType) => void;
}

export function NodePalette({ onDragStart }: NodePaletteProps) {
  return (
    <Card className="w-64 shrink-0">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm">Éléments</CardTitle>
      </CardHeader>
      <CardContent className="p-2 space-y-2">
        {NODE_TEMPLATES.map((template) => {
          const Icon = nodeIcons[template.type];
          const colors = NODE_COLORS[template.type];
          
          return (
            <div
              key={template.type}
              draggable
              onDragStart={(e) => onDragStart(e, template.type)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all hover:shadow-md',
                colors.bg,
                colors.border
              )}
            >
              <div className={cn('p-1.5 rounded', colors.bg)}>
                <Icon className={cn('h-4 w-4', colors.icon)} />
              </div>
              <div>
                <p className="font-medium text-sm">{template.label}</p>
                <p className="text-xs text-muted-foreground">{template.description}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
