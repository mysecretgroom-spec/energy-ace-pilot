import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Wand2, 
  Trash2, 
  Plus,
  Edit2,
  User,
  BookOpen,
  Shield,
  Briefcase
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface AgentPrompt {
  id: string;
  user_id: string;
  prompt_type: string;
  title: string;
  content: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

const promptTypeLabels: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; description: string }> = {
  persona: { 
    label: "Personnalité", 
    icon: User, 
    color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    description: "Comment l'agent doit s'exprimer (ton, style)"
  },
  instruction: { 
    label: "Instruction", 
    icon: BookOpen, 
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    description: "Comportement général à suivre"
  },
  rule: { 
    label: "Règle", 
    icon: Shield, 
    color: "bg-red-500/10 text-red-600 border-red-500/20",
    description: "Contrainte impérative à respecter"
  },
  context: { 
    label: "Contexte", 
    icon: Briefcase, 
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    description: "Information métier importante"
  },
};

const AgentPromptsManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AgentPrompt | null>(null);
  
  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formType, setFormType] = useState<string>("instruction");
  const [formPriority, setFormPriority] = useState(0);

  // Fetch prompts - cast to unknown first to handle missing type
  const { data: prompts, isLoading } = useQuery({
    queryKey: ["agent-prompts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_agent_prompts" as any)
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as AgentPrompt[];
    },
    enabled: !!user,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; title: string; content: string; prompt_type: string; priority: number }) => {
      if (data.id) {
        // Update
        const { error } = await supabase
          .from("whatsapp_agent_prompts" as any)
          .update({
            title: data.title,
            content: data.content,
            prompt_type: data.prompt_type,
            priority: data.priority,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from("whatsapp_agent_prompts" as any)
          .insert({
            user_id: user!.id,
            title: data.title,
            content: data.content,
            prompt_type: data.prompt_type,
            priority: data.priority,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-prompts"] });
      toast.success(editingPrompt ? "Instruction modifiée" : "Instruction ajoutée");
      resetForm();
    },
    onError: () => {
      toast.error("Erreur lors de la sauvegarde");
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("whatsapp_agent_prompts" as any)
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-prompts"] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (promptId: string) => {
      const { error } = await supabase
        .from("whatsapp_agent_prompts" as any)
        .delete()
        .eq("id", promptId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-prompts"] });
      toast.success("Instruction supprimée");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  const resetForm = () => {
    setFormTitle("");
    setFormContent("");
    setFormType("instruction");
    setFormPriority(0);
    setEditingPrompt(null);
    setIsDialogOpen(false);
  };

  const openEdit = (prompt: AgentPrompt) => {
    setEditingPrompt(prompt);
    setFormTitle(prompt.title);
    setFormContent(prompt.content);
    setFormType(prompt.prompt_type);
    setFormPriority(prompt.priority);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error("Titre et contenu requis");
      return;
    }
    saveMutation.mutate({
      id: editingPrompt?.id,
      title: formTitle.trim(),
      content: formContent.trim(),
      prompt_type: formType,
      priority: formPriority,
    });
  };

  const typeInfo = (type: string) => promptTypeLabels[type] || promptTypeLabels.instruction;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wand2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Instructions personnalisées</CardTitle>
              <CardDescription>
                Personnalisez le comportement de votre agent
              </CardDescription>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            if (!open) resetForm();
            setIsDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingPrompt ? "Modifier l'instruction" : "Nouvelle instruction"}
                </DialogTitle>
                <DialogDescription>
                  Ces instructions seront utilisées par l'agent WhatsApp pour personnaliser ses réponses.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(promptTypeLabels).map(([key, info]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <info.icon className="h-4 w-4" />
                            <span>{info.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {typeInfo(formType).description}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Titre</Label>
                  <Input
                    placeholder="Ex: Toujours tutoyer"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contenu de l'instruction</Label>
                  <Textarea
                    placeholder="Ex: Utilise toujours le tutoiement avec moi, jamais le vouvoiement."
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Priorité (0-10)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={formPriority}
                    onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Plus la priorité est haute, plus l'instruction est importante.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>
                  Annuler
                </Button>
                <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                  {editingPrompt ? "Modifier" : "Ajouter"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info card */}
        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
          <p>Ajoutez des instructions pour personnaliser votre agent :</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            <li>• <strong>Personnalité</strong> : ton, style de communication</li>
            <li>• <strong>Instruction</strong> : comportement général</li>
            <li>• <strong>Règle</strong> : contrainte impérative</li>
            <li>• <strong>Contexte</strong> : info métier importante</li>
          </ul>
        </div>

        {/* Prompts list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : prompts && prompts.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {prompts.map((prompt) => {
              const info = typeInfo(prompt.prompt_type);
              const Icon = info.icon;
              return (
                <div
                  key={prompt.id}
                  className={`border rounded-lg p-3 transition-colors ${
                    prompt.is_active ? "hover:bg-muted/30" : "opacity-50 bg-muted/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={info.color}>
                          <Icon className="h-3 w-3 mr-1" />
                          {info.label}
                        </Badge>
                        {prompt.priority > 0 && (
                          <span className="text-xs text-muted-foreground">
                            priorité {prompt.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium">{prompt.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {prompt.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Créée le {format(new Date(prompt.created_at), "dd MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={prompt.is_active}
                        onCheckedChange={(checked) => 
                          toggleActiveMutation.mutate({ id: prompt.id, isActive: checked })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(prompt)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm("Supprimer cette instruction ?")) {
                            deleteMutation.mutate(prompt.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Wand2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucune instruction personnalisée</p>
            <p className="text-xs mt-1">
              Ajoutez des instructions pour customiser votre agent
            </p>
          </div>
        )}

        {/* Stats */}
        {prompts && prompts.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>{prompts.length} instruction(s)</span>
            <span>
              {prompts.filter(p => p.is_active).length} active(s)
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentPromptsManager;