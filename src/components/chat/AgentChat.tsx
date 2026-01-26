import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { 
  X, 
  Send, 
  Loader2, 
  Bot, 
  User, 
  Sparkles,
  Minimize2,
  Maximize2,
  Mic,
  MicOff,
  Paperclip,
  Image as ImageIcon,
  FileText,
  MessageCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachment?: {
    type: "image" | "document";
    name: string;
    url?: string;
  };
}

const SUGGESTIONS = [
  "📅 Mon planning de demain",
  "📊 Mes ventes ce mois",
  "👤 Rechercher un client",
  "🏆 Mes statistiques",
];

export function AgentChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load conversation from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`agent-chat-${user?.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })));
      } catch (e) {
        console.error("Error loading chat history:", e);
      }
    }
  }, [user?.id]);

  // Save conversation to localStorage
  useEffect(() => {
    if (messages.length > 0 && user?.id) {
      localStorage.setItem(
        `agent-chat-${user.id}`,
        JSON.stringify(messages.slice(-50))
      );
    }
  }, [messages, user?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Cleanup media recorder on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    };
  }, [mediaRecorder]);

  const sendMessage = async (text: string, attachment?: Message["attachment"]) => {
    if ((!text.trim() && !attachment) || !user) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
      attachment,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-agent", {
        body: {
          message: attachment 
            ? `[${attachment.type === "image" ? "Image" : "Document"}: ${attachment.name}] ${text.trim()}`
            : text.trim(),
          userId: user.id,
          source: "web_chat",
          conversationHistory: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          }))
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data?.response || "Je n'ai pas pu traiter votre demande.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Agent error:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "❌ Une erreur est survenue. Veuillez réessayer.",
        timestamp: new Date(),
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

  const clearChat = () => {
    setMessages([]);
    if (user?.id) {
      localStorage.removeItem(`agent-chat-${user.id}`);
    }
  };

  // Speech-to-text
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        
        // Convert to base64 for the agent
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];
          
          setIsLoading(true);
          try {
            const { data, error } = await supabase.functions.invoke("whatsapp-agent", {
              body: {
                userId: user?.id,
                source: "web_chat_voice",
                audioData: base64Audio,
                conversationHistory: messages.slice(-10).map(m => ({
                  role: m.role,
                  content: m.content
                }))
              },
            });

            if (error) throw error;

            // Add transcribed message from user
            if (data?.transcription) {
              const userMessage: Message = {
                id: crypto.randomUUID(),
                role: "user",
                content: `🎤 ${data.transcription}`,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, userMessage]);
            }

            // Add agent response
            const assistantMessage: Message = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: data?.response || "Je n'ai pas pu transcrire votre message.",
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
          } catch (error) {
            console.error("Voice processing error:", error);
            toast.error("Erreur lors du traitement vocal");
          } finally {
            setIsLoading(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.error("Microphone access error:", error);
      toast.error("Impossible d'accéder au microphone");
    }
  }, [user?.id, messages]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      
      if (navigator.vibrate) {
        navigator.vibrate([50, 50, 50]);
      }
    }
  }, [mediaRecorder]);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // File import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const isImage = file.type.startsWith("image/");
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (file.size > maxSize) {
      toast.error("Fichier trop volumineux (max 10MB)");
      return;
    }

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `agent-uploads/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      // Send message with attachment
      sendMessage(
        input || `J'ai envoyé ${isImage ? "une image" : "un document"}: ${file.name}`,
        {
          type: isImage ? "image" : "document",
          name: file.name,
          url: urlData.publicUrl,
        }
      );

      toast.success(`${isImage ? "Image" : "Document"} envoyé`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erreur lors de l'envoi du fichier");
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Button - positioned above HEJJA toggle */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-40 right-4 z-50"
          >
            <Button
              onClick={() => setIsOpen(true)}
              variant="outline"
              className="h-12 px-4 gap-2 rounded-full shadow-lg bg-background/95 backdrop-blur border-border hover:bg-muted"
            >
              <div className="relative">
                <MessageCircle className="h-5 w-5 text-primary" />
                <Sparkles className="h-2.5 w-2.5 text-primary absolute -top-1 -right-1" />
              </div>
              <span className="text-muted-foreground font-medium">Agent</span>
              <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed z-50 bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden",
              isExpanded
                ? "inset-4 md:inset-8"
                : "bottom-4 right-4 w-[calc(100vw-2rem)] max-w-md h-[70vh] max-h-[600px]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/10 to-primary/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Assistant IA</h3>
                  <p className="text-xs text-muted-foreground">
                    Voix, texte et documents
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4">
                    <Bot className="h-8 w-8 text-primary" />
                  </div>
                  <h4 className="font-semibold mb-1">Bonjour ! 👋</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Posez vos questions par texte, voix ou envoyez des documents.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mb-4">
                    {SUGGESTIONS.map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => sendMessage(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mic className="h-3 w-3" /> Voix
                    </span>
                    <span className="flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" /> Images
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Documents
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-3",
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {message.role === "assistant" && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <div className="h-full w-full rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary-foreground" />
                          </div>
                        </Avatar>
                      )}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        )}
                      >
                        {message.attachment && (
                          <div className="flex items-center gap-2 mb-1 text-xs opacity-80">
                            {message.attachment.type === "image" ? (
                              <ImageIcon className="h-3 w-3" />
                            ) : (
                              <FileText className="h-3 w-3" />
                            )}
                            {message.attachment.name}
                          </div>
                        )}
                        {message.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        ) : (
                          message.content
                        )}
                      </div>
                      {message.role === "user" && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <div className="h-full w-full rounded-full bg-secondary flex items-center justify-center">
                            <User className="h-4 w-4 text-secondary-foreground" />
                          </div>
                        </Avatar>
                      )}
                    </motion.div>
                  ))}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <div className="h-full w-full rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary-foreground" />
                        </div>
                      </Avatar>
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t bg-muted/30">
              <form onSubmit={handleSubmit} className="flex gap-2">
                {/* Attachment button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-10 w-10"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isRecording}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                {/* Input */}
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isRecording ? "Enregistrement..." : "Tapez votre message..."}
                  className="flex-1"
                  disabled={isLoading || isRecording}
                />

                {/* Voice button */}
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "ghost"}
                  size="icon"
                  className={cn(
                    "shrink-0 h-10 w-10",
                    isRecording && "animate-pulse"
                  )}
                  onClick={toggleRecording}
                  disabled={isLoading}
                >
                  {isRecording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>

                {/* Send button */}
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading || isRecording}
                  className="shrink-0 h-10 w-10"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
                >
                  Effacer la conversation
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
