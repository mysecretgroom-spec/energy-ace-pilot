import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Brain, 
  Trash2, 
  RefreshCw,
  Star,
  User,
  Settings,
  Lightbulb,
  MessageSquare
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface AgentMemory {
  id: string;
  user_id: string | null;
  scope: string;
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
};

const AgentMemoryManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch memories
  const { data: memories, isLoading } = useQuery({
    queryKey: ["agent-memories", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_agent_memory")
        .select("*")
        .order("usage_count", { ascending: false })
        .order("last_used_at", { ascending: false });

      if (error) throw error;
      return data as AgentMemory[];
    },
    enabled: !!user,
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

  // Clear all memories
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
      toast.success("Toutes les mémoires ont été effacées");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  // Filter memories
  const filteredMemories = memories?.filter((m) => {
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
    
    // Format based on memory type
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
    
    // Default: show JSON summary
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(", ");
  };

  const typeInfo = (type: string) => memoryTypeLabels[type] || memoryTypeLabels.context;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Mémoire de l'agent</CardTitle>
              <CardDescription>
                L'agent apprend de vos habitudes et préférences
              </CardDescription>
            </div>
          </div>
          {memories && memories.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => {
                if (confirm("Effacer toutes les mémoires de l'agent ?")) {
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
        {/* Info card */}
        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
          <p>L'agent retient automatiquement :</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            <li>• Vos alias de clients (ex: "le client de Bordeaux")</li>
            <li>• Vos préférences de formulation</li>
            <li>• Les corrections que vous apportez</li>
            <li>• Vos raccourcis personnels</li>
          </ul>
        </div>

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
        ) : filteredMemories && filteredMemories.length > 0 ? (
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
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={info.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {info.label}
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => deleteMutation.mutate(memory.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucune mémoire enregistrée</p>
            <p className="text-xs mt-1">
              L'agent apprendra de vos interactions
            </p>
          </div>
        )}

        {/* Stats */}
        {memories && memories.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>{memories.length} mémoire(s) enregistrée(s)</span>
            <span>
              Confiance moy.: {Math.round(memories.reduce((sum, m) => sum + Number(m.confidence), 0) / memories.length * 100)}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentMemoryManager;
