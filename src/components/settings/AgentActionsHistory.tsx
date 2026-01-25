import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  History, 
  Undo2, 
  Calendar, 
  ShoppingBag, 
  Receipt,
  User,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface AgentAction {
  id: string;
  action_type: string;
  target_table: string;
  target_id: string;
  action_data: Record<string, unknown>;
  previous_data: Record<string, unknown> | null;
  description: string;
  is_undone: boolean;
  undone_at: string | null;
  created_at: string;
}

const AgentActionsHistory = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [actionToUndo, setActionToUndo] = useState<AgentAction | null>(null);

  const { data: actions, isLoading } = useQuery({
    queryKey: ["agent-actions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_agent_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as AgentAction[];
    },
    enabled: !!user,
  });

  const undoMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const { data, error } = await supabase.rpc("undo_agent_action", {
        p_action_id: actionId,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        throw new Error(result.error || "Erreur inconnue");
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success("Action annulée avec succès");
      queryClient.invalidateQueries({ queryKey: ["agent-actions"] });
      // Refresh other relevant data
      queryClient.invalidateQueries({ queryKey: ["rdv"] });
      queryClient.invalidateQueries({ queryKey: ["ventes"] });
      queryClient.invalidateQueries({ queryKey: ["frais"] });
      setActionToUndo(null);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
      setActionToUndo(null);
    },
  });

  const getActionIcon = (targetTable: string) => {
    switch (targetTable) {
      case "rdv":
        return <Calendar className="h-4 w-4" />;
      case "ventes":
        return <ShoppingBag className="h-4 w-4" />;
      case "frais":
        return <Receipt className="h-4 w-4" />;
      case "clients":
        return <User className="h-4 w-4" />;
      default:
        return <History className="h-4 w-4" />;
    }
  };

  const getActionTypeBadge = (actionType: string, isUndone: boolean) => {
    if (isUndone) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <Undo2 className="h-3 w-3 mr-1" />
          Annulée
        </Badge>
      );
    }

    switch (actionType) {
      case "create_rdv":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Création RDV</Badge>;
      case "update_rdv":
      case "cancel_rdv":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Modif RDV</Badge>;
      case "update_vente":
      case "create_vente":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Vente</Badge>;
      case "create_frais":
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Note frais</Badge>;
      default:
        return <Badge variant="secondary">{actionType}</Badge>;
    }
  };

  const canUndo = (action: AgentAction): boolean => {
    if (action.is_undone) return false;
    if (!action.previous_data) return false;
    
    // Only allow undo for actions less than 24h old
    const actionDate = new Date(action.created_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - actionDate.getTime()) / (1000 * 60 * 60);
    return hoursDiff < 24;
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique des actions
          </CardTitle>
          <CardDescription>
            Actions effectuées par l'agent IA (annulables sous 24h)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : actions && actions.length > 0 ? (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {actions.map((action) => (
                  <div
                    key={action.id}
                    className={`border rounded-lg p-3 space-y-2 ${
                      action.is_undone ? "bg-muted/50 opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getActionIcon(action.target_table)}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(action.created_at), "dd MMM HH:mm", { locale: fr })}
                        </span>
                      </div>
                      {getActionTypeBadge(action.action_type, action.is_undone)}
                    </div>
                    
                    <p className="text-sm">{action.description}</p>
                    
                    {action.is_undone && action.undone_at && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Annulée le {format(new Date(action.undone_at), "dd MMM à HH:mm", { locale: fr })}
                      </p>
                    )}
                    
                    {canUndo(action) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                        onClick={() => setActionToUndo(action)}
                      >
                        <Undo2 className="h-4 w-4 mr-2" />
                        Annuler cette action
                      </Button>
                    )}
                    
                    {!action.is_undone && !canUndo(action) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {action.previous_data 
                          ? "Délai d'annulation dépassé (24h)"
                          : "Action non annulable"
                        }
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucune action enregistrée</p>
              <p className="text-xs mt-1">
                Les actions de l'agent IA apparaîtront ici
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!actionToUndo} onOpenChange={() => setActionToUndo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Annuler cette action ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionToUndo && (
                <>
                  <p className="mb-2">Vous allez annuler l'action suivante :</p>
                  <p className="font-medium text-foreground">
                    "{actionToUndo.description}"
                  </p>
                  <p className="mt-2 text-sm">
                    Les données seront restaurées à leur état précédent.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => actionToUndo && undoMutation.mutate(actionToUndo.id)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Confirmer l'annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AgentActionsHistory;
