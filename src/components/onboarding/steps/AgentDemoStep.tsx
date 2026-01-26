import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Bot, 
  Send, 
  Sparkles, 
  MessageCircle,
  Calendar,
  Users,
  BarChart3,
  CheckCircle,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const DEMO_MESSAGES = [
  {
    id: "1",
    role: "assistant" as const,
    content: "👋 Bonjour ! Je suis votre assistant IA personnel. Je peux vous aider à :\n\n📅 Consulter votre planning\n👤 Rechercher des clients\n📊 Voir vos statistiques\n\nEssayez de m'envoyer un message !",
  },
];

const SUGGESTIONS = [
  { icon: Calendar, text: "Planning demain" },
  { icon: Users, text: "Chercher client" },
  { icon: BarChart3, text: "Mes stats" },
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AgentDemoStep() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !user) return;

    setHasInteracted(true);
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-agent", {
        body: {
          message: text.trim(),
          userId: user.id,
          source: "onboarding_demo",
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data?.response || "Je suis prêt à vous aider !",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Agent error:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "🎉 L'agent est configuré ! Vous pourrez l'utiliser après l'onboarding.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-3">
          <Bot className="h-7 w-7 text-primary-foreground" />
        </div>
        <h2 className="text-xl font-bold">Testez l'Assistant IA</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Disponible via WhatsApp et directement dans l'app
        </p>
      </div>

      {/* Chat Demo */}
      <div className="rounded-xl border bg-muted/30 overflow-hidden">
        {/* Messages */}
        <div className="h-48 overflow-y-auto p-3 space-y-3">
          {messages.map((message, i) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-2",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-line",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background border"
                )}
              >
                {message.content}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div className="bg-background border rounded-xl px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </motion.div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t bg-background">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Essayez un message..."
              className="flex-1 text-sm"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="shrink-0 h-9 w-9"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Quick Suggestions */}
      <div className="flex flex-wrap gap-2 justify-center">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion.text}
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => sendMessage(suggestion.text)}
            disabled={isLoading}
          >
            <suggestion.icon className="h-3.5 w-3.5" />
            {suggestion.text}
          </Button>
        ))}
      </div>

      {/* WhatsApp Link */}
      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-700">
              Aussi disponible sur WhatsApp
            </p>
            <p className="text-xs text-green-600/80">
              Configurez votre numéro dans les paramètres
            </p>
          </div>
          {hasInteracted && (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
        </div>
      </div>
    </div>
  );
}
