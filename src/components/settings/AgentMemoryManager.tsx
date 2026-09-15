import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Brain,
  Trash2,
  RefreshCw,
  Star,
  User,
  Users,
  Settings,
  Lightbulb,
  MessageSquare,
  Building2,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface AgentMemory {
  id: string;
  user_id: string | null;
  scope: string;
  regie_id?: string | null;
  memory_type: string;
  key: string;
  value: Record<string, unknown>;
  confidence: number;
  usage_count: number;
  last_used_at: string;
  created_at: string;
}

const memoryTypeLabels: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  preference: { label: "Préférence", icon: Star, color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  pattern: { label: "Habitude", icon: RefreshCw, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  correction: { label: "Correction", icon: Lightbulb, color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  context: { label: "Contexte", icon: MessageSquare, color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  alias: { label: "Alias", icon: User, color: "bg-green-500/10 text-green-600 border-green-500/20" },
  shortcut: { label: "Raccourci", icon: Settings, color: "bg-pink-500/10 text-pink-600 border-pink-500/20" },
  rule: { label: "Règle régie", icon: Building2, color: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
};

const AgentMemoryManager = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [tab, setTab] = useState<"user" | "regie" | "global">("user");
  const [selectedRegieId, setSelectedRegieId] = useState<string>("");
  const [newRuleTitle, setNewRuleTitle] = useState("");
  const [newRuleText, setNewRuleText] = useState("");

  // Fetch memories (personnelles + régie + communes)
  const { data: memories, isLoading } = useQuery({
    queryKey: ["agent-memories", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_agent_memory")
        .select("*")
        .order("usage_count", { ascending: false })
        .order("last_used_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as AgentMemory[];
    },
    enabled: !!user,
  });

  const { data: regies } = useQuery({
    queryKey: ["agent-memories-regies", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regies")
        .select("id, nom")
        .order("nom");
      if (error) throw error;
      return (data || []) as { id: string; nom: string }[];
    },
    enabled: !!user,
  });

  const userMemories = memories?.filter((m) => m.scope === "user" || (!m.scope && m.user_id)) ?? [];
  const globalMemories = memories?.filter((m) => m.scope === "global") ?? [];
  const regieMemories = memories?.filter((m) => m.scope === "regie") ?? [];
  const regieName = (id?: string | null) => regies?.find((r) => r.id === id)?.nom || "Régie";
  const currentList =
    tab === "global"
      ? globalMemories
      : tab === "regie"
      ? regieMemories.filter((m) => !selectedRegieId || m.regie_id === selectedRegieId)
      : userMemories;

  const addRegieRuleMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non authentifié");
      if (!selectedRegieId) throw new Error("Choisissez une régie");
      if (!newRuleTitle.trim() || !newRuleText.trim()) throw new Error("Titre et règle requis");
      const { error } = await supabase.from("whatsapp_agent_memory").insert({
        user_id: user.id,
        regie_id: selectedRegieId,
        scope: "regie",
        memory_type: "rule",
        key: newRuleTitle.trim(),
        value: { description: newRuleText.trim() },
        confidence: 1,
        usage_count: 0,
        last_used_at: new Date().toISOString(),
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewRuleTitle("");
      setNewRuleText("");
      queryClient.invalidateQueries({ queryKey: ["agent-memories"] });
      toast.success("Règle de régie enregistrée");
    },
    onError: (e: Error) => toast.error(e.message || "Erreur lors de l'enregistrement"),
  });

  // Delete memory mutation
  const deleteMutation = useMutation({
    mutationFn: async (memoryId: string) => {
      const { error } = await supabase
        .from("whatsapp_agent_memory")
        .delete()
        .eq("id", memoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-memories"] });
      toast.success("Mémoire supprimée");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  // Clear all personal memories
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("whatsapp_agent_memory")
        .delete()
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-memories"] });
      toast.success("Vos mémoires personnelles ont été effacées");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  // Filter memories
  const filteredMemories = currentList.filter((m) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      m.key.toLowerCase().includes(search) ||
      m.memory_type.toLowerCase().includes(search) ||
      JSON.stringify(m.value).toLowerCase().includes(search)
    );
  });

  const getMemoryDisplay = (memory: AgentMemory) => {
    const value = memory.value;

    if (memory.memory_type === "alias" && value.original && value.alias) {
      return `"${value.alias}" → "${value.original}"`;
    }
    if (memory.memory_type === "preference" && value.description) {
      return String(value.description);
    }
    if (memory.memory_type === "pattern" && value.pattern) {
      return String(value.pattern);
    }
    if (memory.memory_type === "shortcut" && value.shortcut && value.meaning) {
      return `"${value.shortcut}" = ${value.meaning}`;
    }

    return Object.entries(value)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join(", ");
  };

  const typeInfo = (type: string) => memoryTypeLabels[type] || memoryTypeLabels.context;

  const canDelete = (memory: AgentMemory) => memory.scope !== "global" || isAdmin;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">Mémoire de l'agent</CardTitle>
              <CardDescription>
                Apprentissages communs à tous et apprentissages qui vous sont propres
              </CardDescription>
            </div>
          </div>
          {tab === "user" && userMemories.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive shrink-0"
              onClick={() => {
                if (confirm("Effacer toutes vos mémoires personnelles ?")) {
                  clearAllMutation.mutate();
                }
              }}
              disabled={clearAllMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Tout effacer
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "user" | "regie" | "global")}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="user" className="gap-1 text-xs">
              <User className="h-3.5 w-3.5" />
              Pour vous ({userMemories.length})
            </TabsTrigger>
            <TabsTrigger value="regie" className="gap-1 text-xs">
              <Building2 className="h-3.5 w-3.5" />
              Par régie ({regieMemories.length})
            </TabsTrigger>
            <TabsTrigger value="global" className="gap-1 text-xs">
              <Users className="h-3.5 w-3.5" />
              Communes ({globalMemories.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="regie" className="mt-3 space-y-3">
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              Règles, grilles de prix et aides propres à une régie. L'agent les applique en
              priorité, avant ses apprentissages généraux.
            </div>
            <Select value={selectedRegieId} onValueChange={setSelectedRegieId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choisir une régie" />
              </SelectTrigger>
              <SelectContent>
                {(regies || []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRegieId && (
              <div className="space-y-2 border rounded-lg p-3">
                <Input
                  placeholder="Titre (ex: Grille de prix Full Black)"
                  value={newRuleTitle}
                  onChange={(e) => setNewRuleTitle(e.target.value)}
                  className="h-9"
                />
                <Textarea
                  placeholder="La règle, la grille ou l'aide, en toutes lettres…"
                  value={newRuleText}
                  onChange={(e) => setNewRuleText(e.target.value)}
                  rows={3}
                />
                <Button
                  size="sm"
                  onClick={() => addRegieRuleMutation.mutate()}
                  disabled={addRegieRuleMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter à {regieName(selectedRegieId)}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="user" className="mt-3">
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <p>L'agent retient automatiquement pour vous :</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                <li>• Vos alias de clients (ex: "le client de Bordeaux")</li>
                <li>• Vos préférences de formulation</li>
                <li>• Les corrections que vous apportez</li>
                <li>• Vos raccourcis personnels</li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="global" className="mt-3">
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <p>
                Ces apprentissages s'appliquent à tout le monde : vocabulaire métier, règles
                générales, expressions communes.
              </p>
              <p className="text-xs mt-1">
                {isAdmin
                  ? "En tant qu'administrateur, vous pouvez les supprimer."
                  : "Seul un administrateur peut les modifier."}
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Search */}
        <Input
          placeholder="Rechercher dans les mémoires..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-9"
        />

        {/* Memories list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredMemories.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredMemories.map((memory) => {
              const info = typeInfo(memory.memory_type);
              const Icon = info.icon;
              return (
                <div
                  key={memory.id}
                  className="border rounded-lg p-3 flex items-start justify-between gap-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={info.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {info.label}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {memory.scope === "global"
                          ? "Commun"
                          : memory.scope === "regie"
                          ? regieName(memory.regie_id)
                          : "Pour vous"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        utilisé {memory.usage_count}x
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">{memory.key}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {getMemoryDisplay(memory)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dernier usage: {format(new Date(memory.last_used_at), "dd MMM à HH:mm", { locale: fr })}
                    </p>
                  </div>
                  {canDelete(memory) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => deleteMutation.mutate(memory.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>
              {tab === "global"
                ? "Aucun apprentissage commun"
                : "Aucune mémoire enregistrée"}
            </p>
            <p className="text-xs mt-1">L'agent apprendra de vos interactions</p>
          </div>
        )}

        {/* Stats */}
        {currentList.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>{currentList.length} mémoire(s)</span>
            <span>
              Confiance moy.:{" "}
              {Math.round(
                (currentList.reduce((sum, m) => sum + Number(m.confidence), 0) / currentList.length) * 100,
              )}
              %
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentMemoryManager;
