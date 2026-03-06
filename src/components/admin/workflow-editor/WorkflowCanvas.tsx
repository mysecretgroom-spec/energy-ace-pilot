import { useCallback, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  ReactFlowInstance,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import WorkflowNodeComponent from './WorkflowNode';
import { NodePalette } from './NodePalette';
import { NodeEditDialog } from './NodeEditDialog';
import { WorkflowAssistant, WorkflowAssistantTrigger } from './WorkflowAssistant';
import { WorkflowNode, WorkflowEdge, NodeType, EDGE_COLORS, AIWorkflow } from './types';

const nodeTypes = {
  workflowNode: WorkflowNodeComponent,
};

interface WorkflowCanvasProps {
  workflow: AIWorkflow;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (nodes: WorkflowNode[]) => void;
  onEdgesChange: (edges: WorkflowEdge[]) => void;
}

export function WorkflowCanvas({
  workflow,
  nodes: dbNodes,
  edges: dbEdges,
  onNodesChange,
  onEdgesChange,
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [editingNode, setEditingNode] = useState<WorkflowNode | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const handleEditNode = useCallback((id: string) => {
    const node = dbNodes.find((n) => n.id === id);
    if (node) {
      setEditingNode(node);
      setEditDialogOpen(true);
    }
  }, [dbNodes]);

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      const { error } = await supabase
        .from('ai_workflow_nodes')
        .delete()
        .eq('id', nodeId);

      if (error) {
        toast.error('Erreur lors de la suppression');
        return;
      }

      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      onNodesChange(dbNodes.filter((n) => n.id !== nodeId));
      toast.success('Nœud supprimé');
    },
    [dbNodes, onNodesChange]
  );

  // Convert DB nodes to ReactFlow nodes
  const convertToFlowNodes = useCallback((): Node[] => {
    return dbNodes.map((n) => ({
      id: n.id,
      type: 'workflowNode',
      position: { x: n.position_x, y: n.position_y },
      data: {
        label: n.label,
        type: n.type,
        config: n.config,
        onEdit: handleEditNode,
        onDelete: handleDeleteNode,
      },
    }));
  }, [dbNodes, handleEditNode, handleDeleteNode]);

  // Convert DB edges to ReactFlow edges
  const convertToFlowEdges = useCallback((): Edge[] => {
    return dbEdges.map((e) => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      sourceHandle: e.condition_type || undefined,
      animated: true,
      style: { stroke: EDGE_COLORS[e.condition_type || 'always'] },
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
  }, [dbEdges]);

  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(convertToFlowNodes());
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(convertToFlowEdges());

  // Sync when dbNodes/dbEdges change
  useEffect(() => {
    setNodes(convertToFlowNodes());
  }, [dbNodes, convertToFlowNodes, setNodes]);

  useEffect(() => {
    setEdges(convertToFlowEdges());
  }, [dbEdges, convertToFlowEdges, setEdges]);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const conditionType = connection.sourceHandle as 'success' | 'failure' | null;

      const { data, error } = await supabase
        .from('ai_workflow_edges')
        .insert({
          workflow_id: workflow.id,
          source_node_id: connection.source,
          target_node_id: connection.target,
          condition_type: conditionType || 'always',
        })
        .select()
        .single();

      if (error) {
        toast.error('Erreur lors de la connexion');
        return;
      }

      const newEdge: Edge = {
        id: data.id,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        animated: true,
        style: { stroke: EDGE_COLORS[conditionType || 'always'] },
        markerEnd: { type: MarkerType.ArrowClosed },
      };

      setEdges((eds) => addEdge(newEdge, eds));
      onEdgesChange([...dbEdges, data as unknown as WorkflowEdge]);
    },
    [workflow.id, dbEdges, onEdgesChange, setEdges]
  );

  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      const { error } = await supabase
        .from('ai_workflow_nodes')
        .update({
          position_x: node.position.x,
          position_y: node.position.y,
        })
        .eq('id', node.id);

      if (error) {
        toast.error('Erreur lors de la sauvegarde de la position');
      }
    },
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      if (!type || !reactFlowInstance || !reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const label =
        type === 'trigger'
          ? 'Nouveau déclencheur'
          : type === 'condition'
          ? 'Nouvelle condition'
          : type === 'fallback'
          ? 'Nouveau fallback'
          : 'Nouvelle action';

      const { data, error } = await supabase
        .from('ai_workflow_nodes')
        .insert({
          workflow_id: workflow.id,
          type,
          label,
          position_x: position.x,
          position_y: position.y,
          config: {},
        })
        .select()
        .single();

      if (error) {
        toast.error('Erreur lors de la création du nœud');
        return;
      }

      const newNode: Node = {
        id: data.id,
        type: 'workflowNode',
        position,
        data: {
          label: data.label,
          type: data.type,
          config: data.config,
          onEdit: handleEditNode,
          onDelete: handleDeleteNode,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      onNodesChange([...dbNodes, data as unknown as WorkflowNode]);
      toast.success('Nœud ajouté');
    },
    [reactFlowInstance, workflow.id, dbNodes, onNodesChange, handleEditNode, handleDeleteNode, setNodes]
  );

  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  // Handle workflow generated by AI assistant
  const handleApplyWorkflow = useCallback(async (generatedWorkflow: {
    nodes: { id: string; type: string; label: string; config?: Record<string, unknown> }[];
    edges: { source: string; target: string; condition_type?: string }[];
  }) => {
    try {
      // Clear existing nodes and edges
      for (const node of dbNodes) {
        await supabase.from('ai_workflow_nodes').delete().eq('id', node.id);
      }
      
      // Create a mapping from generated IDs to new DB IDs
      const idMapping: Record<string, string> = {};
      const newNodes: WorkflowNode[] = [];
      
      // Create nodes
      for (let i = 0; i < generatedWorkflow.nodes.length; i++) {
        const genNode = generatedWorkflow.nodes[i];
        const position = {
          x: 100 + (i % 3) * 250,
          y: 100 + Math.floor(i / 3) * 150,
        };
        
        const { data, error } = await supabase
          .from('ai_workflow_nodes')
          .insert({
            workflow_id: workflow.id,
            type: genNode.type,
            label: genNode.label,
            position_x: position.x,
            position_y: position.y,
            config: (genNode.config || {}) as Record<string, never>,
          })
          .select()
          .single();
        
        if (error) throw error;
        idMapping[genNode.id] = data.id;
        newNodes.push(data as unknown as WorkflowNode);
      }
      
      // Create edges
      const newEdges: WorkflowEdge[] = [];
      for (const genEdge of generatedWorkflow.edges) {
        const sourceId = idMapping[genEdge.source];
        const targetId = idMapping[genEdge.target];
        
        if (sourceId && targetId) {
          const { data, error } = await supabase
            .from('ai_workflow_edges')
            .insert({
              workflow_id: workflow.id,
              source_node_id: sourceId,
              target_node_id: targetId,
              condition_type: genEdge.condition_type || 'always',
            })
            .select()
            .single();
          
          if (error) throw error;
          newEdges.push(data as unknown as WorkflowEdge);
        }
      }
      
      onNodesChange(newNodes);
      onEdgesChange(newEdges);
      toast.success('Workflow généré par IA appliqué !');
    } catch (error) {
      console.error('Error applying workflow:', error);
      toast.error('Erreur lors de l\'application du workflow');
    }
  }, [workflow.id, dbNodes, onNodesChange, onEdgesChange]);

  const handleSaveNode = async (updatedNode: WorkflowNode) => {
    const { error } = await supabase
      .from('ai_workflow_nodes')
      .update({
        label: updatedNode.label,
        config: updatedNode.config as unknown as Record<string, never>,
      })
      .eq('id', updatedNode.id);

    if (error) {
      toast.error('Erreur lors de la sauvegarde');
      return;
    }

    onNodesChange(dbNodes.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
    setEditDialogOpen(false);
    // Silent save
  };

  return (
    <div className="flex h-[600px] gap-4">
      <NodePalette onDragStart={onDragStart} />

      <div ref={reactFlowWrapper} className="flex-1 rounded-xl border bg-muted/30">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChangeInternal}
          onEdgesChange={onEdgesChangeInternal}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onInit={setReactFlowInstance}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          className="rounded-xl"
        >
          <Controls className="!bg-background !border !shadow-md" />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-background" />
        </ReactFlow>
      </div>

      <NodeEditDialog
        node={editingNode}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSaveNode}
      />

      {/* AI Assistant */}
      {!assistantOpen && (
        <WorkflowAssistantTrigger onClick={() => setAssistantOpen(true)} />
      )}
      
      <WorkflowAssistant
        currentNodes={dbNodes.map(n => ({ id: n.id, type: n.type, label: n.label, config: n.config as Record<string, unknown> }))}
        currentEdges={dbEdges.map(e => ({ source: e.source_node_id, target: e.target_node_id, condition_type: e.condition_type || undefined }))}
        onApplyWorkflow={handleApplyWorkflow}
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
      />
    </div>
  );
}
