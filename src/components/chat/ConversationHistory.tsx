import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  ChevronLeft,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentConversation } from "@/hooks/useAgentConversations";
import { motion } from "framer-motion";

interface ConversationHistoryProps {
  conversations: AgentConversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function ConversationHistory({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onClose,
  isLoading,
}: ConversationHistoryProps) {
  return (
    <motion.div
      initial={{ x: "-100%" }}
      animate={{ x: 0 }}
      exit={{ x: "-100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="absolute inset-0 bg-background z-10 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-semibold text-sm">Historique</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            onNewConversation();
            onClose();
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Nouveau
        </Button>
      </div>

      {/* Conversations list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Chargement...
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Aucune conversation
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Démarrez une nouvelle discussion
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "group relative rounded-lg p-3 cursor-pointer transition-colors",
                  currentConversationId === conversation.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted/50"
                )}
                onClick={() => {
                  onSelectConversation(conversation.id);
                  onClose();
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {conversation.title || "Sans titre"}
                    </p>
                    {conversation.last_message_preview && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conversation.last_message_preview}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(conversation.updated_at), "dd MMM à HH:mm", { locale: fr })}
                      <span className="text-muted-foreground/50">•</span>
                      <span>{conversation.message_count} msg</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conversation.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </motion.div>
  );
}
