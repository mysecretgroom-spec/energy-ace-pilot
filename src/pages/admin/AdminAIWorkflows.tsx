import { useState, useEffect } from "react";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText,
  Calendar,
  TrendingUp,
  Bell,
  Settings,
  Smartphone,
  MessageSquare,
  Save,
  RotateCcw,
  Pencil,
  Check,
  X,
  Workflow,
  ArrowLeft,
} from "lucide-react";
import { WorkflowCanvas, AIWorkflow, WorkflowNode, WorkflowEdge } from "@/components/admin/workflow-editor";

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  documents: { label: "Documents", icon: FileText, color: "bg-blue-500" },
  planning: { label: "Planning", icon: Calendar, color: "bg-green-500" },
  crm: { label: "CRM / Ventes", icon: TrendingUp, color: "bg-purple-500" },
  notifications: { label: "Notifications", icon: Bell, color: "bg-amber-500" },
};

const channelIcons: Record<string, React.ElementType> = {
  app: Smartphone,
  whatsapp: MessageSquare,
};

export default function AdminAIWorkflows() {
  const [workflows, setWorkflows] = useState<AIWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<AIWorkflow | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [editedConfig, setEditedConfig] = useState("");
  
  // Visual editor state
  const [editorWorkflow, setEditorWorkflow] = useState<AIWorkflow | null>(null);
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([]);
  const [workflowEdges, setWorkflowEdges] = useState<WorkflowEdge[]>([]);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_workflows")
      .select("*")
      .order("ordre", { ascending: true });

    if (error) {
      toast.error("Erreur lors du chargement des workflows");
      console.error(error);
    } else {
      setWorkflows((data || []) as AIWorkflow[]);
    }
    setLoading(false);
  };

  const fetchWorkflowDetails = async (workflow: AIWorkflow) => {
    const [nodesRes, edgesRes] = await Promise.all([
      supabase.from("ai_workflow_nodes").select("*").eq("workflow_id", workflow.id),
      supabase.from("ai_workflow_edges").select("*").eq("workflow_id", workflow.id),
    ]);

    if (nodesRes.error || edgesRes.error) {
      toast.error("Erreur lors du chargement du workflow");
      return;
    }

    setWorkflowNodes((nodesRes.data || []) as WorkflowNode[]);
    setWorkflowEdges((edgesRes.data || []) as WorkflowEdge[]);
    setEditorWorkflow(workflow);
  };

  const toggleWorkflow = async (workflow: AIWorkflow) => {
    const newValue = !workflow.actif;
    
    const { error } = await supabase
      .from("ai_workflows")
      .update({ actif: newValue })
      .eq("id", workflow.id);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      setWorkflows(prev =>
        prev.map(w => w.id === workflow.id ? { ...w, actif: newValue } : w)
      );
      toast.success(`Workflow ${newValue ? "activé" : "désactivé"}`);
    }
  };

  const toggleChannel = async (workflow: AIWorkflow, channel: string) => {
    const newChannels = workflow.canaux.includes(channel)
      ? workflow.canaux.filter(c => c !== channel)
      : [...workflow.canaux, channel];

    const { error } = await supabase
      .from("ai_workflows")
      .update({ canaux: newChannels })
      .eq("id", workflow.id);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      setWorkflows(prev =>
        prev.map(w => w.id === workflow.id ? { ...w, canaux: newChannels } : w)
      );
    }
  };

  const openEditDialog = (workflow: AIWorkflow) => {
    setSelectedWorkflow(workflow);
    setEditedPrompt(workflow.prompt_personnalise || "");
    setEditedConfig(JSON.stringify(workflow.config, null, 2));
    setEditDialogOpen(true);
  };

  const saveWorkflowChanges = async () => {
    if (!selectedWorkflow) return;
    setSaving(true);

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(editedConfig);
    } catch {
      toast.error("Configuration JSON invalide");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("ai_workflows")
      .update({
        prompt_personnalise: editedPrompt || null,
        config: parsedConfig as unknown as Record<string, never>,
      })
      .eq("id", selectedWorkflow.id);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      setWorkflows(prev =>
        prev.map(w =>
          w.id === selectedWorkflow.id
            ? { ...w, prompt_personnalise: editedPrompt || null, config: parsedConfig }
            : w
        )
      );
      toast.success("Workflow mis à jour");
      setEditDialogOpen(false);
    }
    setSaving(false);
  };

  const groupedWorkflows = workflows.reduce((acc, workflow) => {
    if (!acc[workflow.categorie]) {
      acc[workflow.categorie] = [];
    }
    acc[workflow.categorie].push(workflow);
    return acc;
  }, {} as Record<string, AIWorkflow[]>);

  const categories = Object.keys(categoryConfig);

  // If viewing a specific workflow in the visual editor
  if (editorWorkflow) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditorWorkflow(null)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Workflow className="h-6 w-6" />
                {editorWorkflow.nom}
              </h1>
              <p className="text-muted-foreground mt-1">
                Éditeur visuel de workflow - Glissez-déposez les éléments pour construire le flux
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant={editorWorkflow.actif ? "default" : "secondary"}>
                {editorWorkflow.actif ? "Actif" : "Inactif"}
              </Badge>
              <Button variant="outline" onClick={() => openEditDialog(editorWorkflow)}>
                <Settings className="h-4 w-4 mr-2" />
                Paramètres
              </Button>
            </div>
          </div>

          <WorkflowCanvas
            workflow={editorWorkflow}
            nodes={workflowNodes}
            edges={workflowEdges}
            onNodesChange={setWorkflowNodes}
            onEdgesChange={setWorkflowEdges}
          />
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5" />
                Paramètres : {selectedWorkflow?.nom}
              </DialogTitle>
              <DialogDescription>
                Personnalisez le comportement et les instructions de ce workflow
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="prompt" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="prompt">Prompt IA</TabsTrigger>
                <TabsTrigger value="config">Configuration</TabsTrigger>
              </TabsList>

              <TabsContent value="prompt" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Instructions personnalisées</Label>
                  <Textarea
                    value={editedPrompt}
                    onChange={e => setEditedPrompt(e.target.value)}
                    placeholder="Ajoutez des instructions spécifiques pour ce workflow..."
                    className="min-h-[200px] font-mono text-sm"
                  />
                </div>
              </TabsContent>

              <TabsContent value="config" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Configuration JSON</Label>
                  <Textarea
                    value={editedConfig}
                    onChange={e => setEditedConfig(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button onClick={saveWorkflowChanges} disabled={saving}>
                {saving ? <RotateCcw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Sauvegarder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflows IA</h1>
          <p className="text-muted-foreground mt-1">
            Gérez les actions disponibles pour les agents IA (App et WhatsApp)
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map(cat => {
              const config = categoryConfig[cat];
              const catWorkflows = groupedWorkflows[cat] || [];
              const Icon = config.icon;
              const activeCount = catWorkflows.filter(w => w.actif).length;

              return (
                <Card key={cat}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.color} text-white`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{config.label}</CardTitle>
                        <CardDescription>
                          {activeCount}/{catWorkflows.length} workflows actifs
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {catWorkflows.map(workflow => (
                      <div
                        key={workflow.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{workflow.nom}</span>
                            {workflow.prompt_personnalise && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                Personnalisé
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            {["app", "whatsapp"].map(channel => {
                              const ChannelIcon = channelIcons[channel];
                              const isActive = workflow.canaux.includes(channel);
                              return (
                                <button
                                  key={channel}
                                  onClick={() => toggleChannel(workflow, channel)}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                                    isActive
                                      ? "bg-primary/10 text-primary"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  <ChannelIcon className="h-3 w-3" />
                                  {isActive ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => fetchWorkflowDetails(workflow)}
                          >
                            <Workflow className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(workflow)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Switch
                            checked={workflow.actif}
                            onCheckedChange={() => toggleWorkflow(workflow)}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5" />
                Configurer : {selectedWorkflow?.nom}
              </DialogTitle>
              <DialogDescription>
                Personnalisez le comportement et les instructions de ce workflow
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="prompt" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="prompt">Prompt IA</TabsTrigger>
                <TabsTrigger value="config">Configuration</TabsTrigger>
              </TabsList>

              <TabsContent value="prompt" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Instructions personnalisées</Label>
                  <Textarea
                    value={editedPrompt}
                    onChange={e => setEditedPrompt(e.target.value)}
                    placeholder="Ajoutez des instructions spécifiques pour ce workflow...&#10;&#10;Ex: Toujours demander confirmation avant de changer un statut."
                    className="min-h-[200px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ces instructions seront injectées dans le prompt de l'agent IA pour ce workflow spécifique.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="config" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Configuration JSON</Label>
                  <Textarea
                    value={editedConfig}
                    onChange={e => setEditedConfig(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Paramètres techniques du workflow (types autorisés, validations, etc.)
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button onClick={saveWorkflowChanges} disabled={saving}>
                {saving ? (
                  <RotateCcw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Sauvegarder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
