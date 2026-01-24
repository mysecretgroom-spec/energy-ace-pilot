import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Loader2, MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TicketReply {
  id: string;
  ticket_id: string;
  user_id: string;
  is_admin: boolean;
  message: string;
  created_at: string;
}

export default function Support() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [replyText, setReplyText] = useState("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["my-support-tickets", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase.rpc("get_my_support_tickets" as any);

      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!user?.id,
  });

  const { data: replies, refetch: refetchReplies } = useQuery({
    queryKey: ["ticket-replies", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket?.id) return [];
      
      const { data, error } = await supabase.rpc("get_ticket_replies" as any, {
        p_ticket_id: selectedTicket.id
      });

      if (error) throw error;
      return data as TicketReply[];
    },
    enabled: !!selectedTicket?.id,
  });

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("create_support_ticket" as any, {
        p_subject: newSubject,
        p_message: newMessage
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setNewSubject("");
      setNewMessage("");
      setIsNewTicketOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-support-tickets"] });
      toast.success("Ticket créé avec succès");
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("add_ticket_reply" as any, {
        p_ticket_id: selectedTicket?.id,
        p_message: replyText,
        p_is_admin: false
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setReplyText("");
      refetchReplies();
      toast.success("Réponse envoyée");
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge className="bg-blue-500">Ouvert</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-500">En cours</Badge>;
      case "resolved":
        return <Badge className="bg-green-500">Résolu</Badge>;
      case "closed":
        return <Badge variant="secondary">Fermé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <MobileLayout title="Support">
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Mes tickets</h2>
          <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nouveau
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau ticket</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Sujet</Label>
                  <Input
                    placeholder="Décrivez brièvement votre problème"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    placeholder="Expliquez votre problème en détail"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button 
                  className="w-full"
                  onClick={() => createTicketMutation.mutate()}
                  disabled={!newSubject || !newMessage || createTicketMutation.isPending}
                >
                  {createTicketMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Envoyer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : tickets?.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucun ticket</p>
              <p className="text-sm text-muted-foreground">Créez un ticket pour obtenir de l'aide</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets?.map((ticket) => (
              <Card 
                key={ticket.id} 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedTicket(ticket)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="font-medium truncate">{ticket.subject}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(ticket.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                      </p>
                    </div>
                    {getStatusBadge(ticket.status)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="pr-8">{selectedTicket?.subject}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            <div className="flex items-center gap-2">
              {selectedTicket && getStatusBadge(selectedTicket.status)}
              <span className="text-sm text-muted-foreground">
                {selectedTicket?.created_at && format(new Date(selectedTicket.created_at), "dd MMM yyyy", { locale: fr })}
              </span>
            </div>

            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm">{selectedTicket?.message}</p>
            </div>

            <ScrollArea className="flex-1 border rounded-lg p-3 min-h-[150px]">
              <div className="space-y-3">
                {replies?.map((reply) => (
                  <div 
                    key={reply.id}
                    className={`p-3 rounded-lg ${
                      reply.is_admin 
                        ? "bg-primary/10 ml-4" 
                        : "bg-muted mr-4"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium">
                        {reply.is_admin ? "Support" : "Vous"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(reply.created_at), "dd MMM HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <p className="text-sm">{reply.message}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {selectedTicket?.status !== "closed" && (
              <div className="flex gap-2">
                <Textarea
                  placeholder="Votre réponse..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button 
                  size="icon"
                  onClick={() => replyMutation.mutate()}
                  disabled={!replyText || replyMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}
