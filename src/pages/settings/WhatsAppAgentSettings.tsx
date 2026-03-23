import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AgentActionsHistory from "@/components/settings/AgentActionsHistory";
import AgentMemoryManager from "@/components/settings/AgentMemoryManager";
import AgentPromptsManager from "@/components/settings/AgentPromptsManager";
import { 
  Bot, 
  MessageCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  Copy,
  ExternalLink,
  Smartphone,
  History,
  Shield,
  Brain,
  Wand2
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

const WhatsAppAgentSettings = () => {
  const { user } = useAuth();

  const { data: whatsappNumber } = useQuery({
    queryKey: ["twilio-whatsapp-number"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-whatsapp-number");
      if (error) throw error;
      return (data as { number: string })?.number || "";
    },
    staleTime: Infinity,
  });


  // Fetch recent WhatsApp messages
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["whatsapp-messages", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success("URL copiée !");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processed":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Traité</Badge>;
      case "processing":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20"><Clock className="h-3 w-3 mr-1" />En cours</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="h-3 w-3 mr-1" />Erreur</Badge>;
      case "rejected":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20"><AlertCircle className="h-3 w-3 mr-1" />Rejeté</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
    }
  };

  const getIntentLabel = (intent: string | null) => {
    const labels: Record<string, string> = {
      create_rdv: "Créer RDV",
      update_rdv: "Modifier RDV",
      update_vente_status: "Statut vente",
      import_document: "Document",
      import_facture: "Facture",
      query_info: "Information",
      conversation: "Conversation",
      unknown: "Non compris",
    };
    return labels[intent || ""] || intent || "-";
  };

  return (
    <MobileLayout title="Assistant WhatsApp" showBackButton>
      <div className="p-4 space-y-4">
        {/* Status Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Bot className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Agent IA WhatsApp</CardTitle>
                <CardDescription>
                  Gérez vos RDV et ventes par WhatsApp
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Security notice */}
            <div className="bg-blue-500/10 rounded-lg p-3 mb-4 flex items-start gap-2">
              <Shield className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-700">
                <strong>Isolation des données</strong>: L'agent n'accède qu'à vos données personnelles via votre numéro WhatsApp. Aucun croisement avec d'autres utilisateurs.
              </div>
            </div>
            
            {/* Instructions */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Comment utiliser l'assistant
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Envoyez un message à votre numéro WhatsApp Twilio</li>
                <li>• <strong>"RDV Dupont demain 14h"</strong> → Crée un RDV</li>
                <li>• <strong>"Martin positif"</strong> → Marque comme signé</li>
                <li>• <strong>"Lefebvre absent"</strong> → Marque comme absent</li>
                <li>• Envoyez une photo de ticket → Crée une note de frais</li>
              </ul>
              
              <Button 
                className="w-full mt-3 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  const clean = whatsappNumber?.replace(/[+\s\-()]/g, "") || "";
                  window.open(`https://wa.me/${clean}?text=Bonjour`, "_blank");
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ouvrir WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Messages, Actions, Memory, and Prompts */}
        <Tabs defaultValue="prompts" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="prompts" className="gap-1 text-xs">
              <Wand2 className="h-4 w-4" />
              <span className="hidden sm:inline">Instructions</span>
            </TabsTrigger>
            <TabsTrigger value="memory" className="gap-1 text-xs">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">Mémoire</span>
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-1 text-xs">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Actions</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1 text-xs">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Messages</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="prompts" className="mt-4">
            <AgentPromptsManager />
          </TabsContent>
          
          <TabsContent value="memory" className="mt-4">
            <AgentMemoryManager />
          </TabsContent>
          
          <TabsContent value="actions" className="mt-4">
            <AgentActionsHistory />
          </TabsContent>
          
          <TabsContent value="messages" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Historique des messages
                </CardTitle>
                <CardDescription>
                  Les 20 derniers messages traités
                </CardDescription>
              </CardHeader>
              <CardContent>
                {messagesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : messages && messages.length > 0 ? (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className="border rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(msg.created_at), "dd MMM HH:mm", { locale: fr })}
                          </span>
                          {getStatusBadge(msg.status)}
                        </div>
                        
                        <p className="text-sm line-clamp-2">
                          {msg.raw_content || msg.transcribed_content || "(média)"}
                        </p>
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {msg.message_type}
                          </Badge>
                          {msg.detected_intent && (
                            <Badge variant="secondary" className="text-xs">
                              {getIntentLabel(msg.detected_intent)}
                            </Badge>
                          )}
                        </div>

                        {msg.response_sent && (
                          <div className="bg-primary/5 rounded p-2 text-xs">
                            <span className="text-muted-foreground">Réponse : </span>
                            {msg.response_sent}
                          </div>
                        )}

                        {msg.rejection_reason && (
                          <p className="text-xs text-amber-600">
                            Raison : {msg.rejection_reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Aucun message reçu</p>
                    <p className="text-xs mt-1">
                      Les messages WhatsApp apparaîtront ici
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
};

export default WhatsAppAgentSettings;
