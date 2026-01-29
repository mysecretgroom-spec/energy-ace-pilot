import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
  MessageCircle,
  History,
  Plus,
  Trash2,
  Upload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useAgentConversations, AgentMessage } from "@/hooks/useAgentConversations";
import { ConversationHistory } from "./ConversationHistory";

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
  attachments?: Array<{
    type: "image" | "document";
    name: string;
    url?: string;
  }>;
}

interface PendingFile {
  id: string;
  file: File;
  preview?: string;
  status: "pending" | "uploading" | "uploaded" | "error";
  url?: string;
  error?: string;
}

// Constants for multi-file upload
const MAX_FILES = 10;
const MAX_TOTAL_SIZE_MB = 100;
const MAX_CONCURRENT_UPLOADS = 10;

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
  const [showHistory, setShowHistory] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const {
    conversations,
    messages: dbMessages,
    currentConversationId,
    loadingConversations,
    startNewConversation,
    selectConversation,
    addMessage,
    deleteConversation,
  } = useAgentConversations();

  // Convert DB messages to local format
  useEffect(() => {
    if (dbMessages && dbMessages.length > 0) {
      setLocalMessages(dbMessages.map((m: AgentMessage) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: new Date(m.created_at),
        attachment: m.attachment_type ? {
          type: m.attachment_type as "image" | "document",
          name: m.attachment_name || "",
          url: m.attachment_url || undefined,
        } : undefined,
      })));
    } else if (!currentConversationId) {
      setLocalMessages([]);
    }
  }, [dbMessages, currentConversationId]);

  // Load user profile to get name
  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setUserName(`${data.first_name || ""} ${data.last_name || ""}`.trim() || "Utilisateur");
      }
    }
    loadProfile();
  }, [user?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current && !showHistory) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, showHistory]);

  // Cleanup media recorder on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    };
  }, [mediaRecorder]);

  // Start fresh conversation when opening
  useEffect(() => {
    if (isOpen && !currentConversationId) {
      // Fresh start - no conversation selected
      setLocalMessages([]);
    }
  }, [isOpen, currentConversationId]);

  const sendMessage = async (text: string, attachment?: Message["attachment"]) => {
    if ((!text.trim() && !attachment) || !user) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
      attachment,
    };

    setLocalMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Save user message to DB
      await addMessage(
        "user",
        text.trim(),
        attachment ? { type: attachment.type, name: attachment.name, url: attachment.url } : undefined
      );

      // Build request matching AgentRequest interface
      const agentRequest = {
        messageId: crypto.randomUUID(),
        userId: user.id,
        userName: userName || "Utilisateur",
        fromNumber: "web_chat",
        messageType: attachment?.type === "image" ? "image" : attachment?.type === "document" ? "document" : "text",
        content: attachment 
          ? `[${attachment.type === "image" ? "Image" : "Document"}: ${attachment.name}] ${text.trim()}`
          : text.trim(),
        mediaUrl: attachment?.url,
        mediaContentType: attachment?.type === "image" ? "image/jpeg" : "application/pdf",
      };

      const { data, error } = await supabase.functions.invoke("whatsapp-agent", {
        body: agentRequest,
      });

      if (error) throw error;

      const responseContent = data?.responseMessage || data?.response || "Je n'ai pas pu traiter votre demande.";

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: responseContent,
        timestamp: new Date(),
      };

      setLocalMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message to DB
      await addMessage("assistant", responseContent);
    } catch (error) {
      console.error("Agent error:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "❌ Une erreur est survenue. Veuillez réessayer.",
        timestamp: new Date(),
      };
      setLocalMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleNewConversation = () => {
    selectConversation(null);
    setLocalMessages([]);
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
        
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];
          
          setIsLoading(true);
          try {
            const agentRequest = {
              messageId: crypto.randomUUID(),
              userId: user?.id,
              userName: userName || "Utilisateur",
              fromNumber: "web_chat",
              messageType: "audio" as const,
              content: "",
              audioData: base64Audio,
            };

            const { data, error } = await supabase.functions.invoke("whatsapp-agent", {
              body: agentRequest,
            });

            if (error) throw error;

            if (data?.transcription) {
              const userMessage: Message = {
                id: crypto.randomUUID(),
                role: "user",
                content: `🎤 ${data.transcription}`,
                timestamp: new Date(),
              };
              setLocalMessages((prev) => [...prev, userMessage]);
              await addMessage("user", `🎤 ${data.transcription}`);
            }

            const responseContent = data?.responseMessage || data?.response || "Je n'ai pas pu transcrire votre message.";
            const assistantMessage: Message = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: responseContent,
              timestamp: new Date(),
            };
            setLocalMessages((prev) => [...prev, assistantMessage]);
            await addMessage("assistant", responseContent);
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
      
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.error("Microphone access error:", error);
      toast.error("Impossible d'accéder au microphone");
    }
  }, [user?.id, userName, addMessage]);

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

  // Multi-file import - no per-file limit, only total limit
  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0 || !user) return;

    // Check file count limit
    const totalFiles = pendingFiles.length + selectedFiles.length;
    if (totalFiles > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} fichiers à la fois`);
      return;
    }

    // Check only total size (no per-file limit)
    let totalSize = pendingFiles.reduce((acc, f) => acc + f.file.size, 0);
    const validFiles: PendingFile[] = [];

    for (const file of selectedFiles) {
      totalSize += file.size;
      if (totalSize / (1024 * 1024) > MAX_TOTAL_SIZE_MB) {
        toast.error(`Limite de ${MAX_TOTAL_SIZE_MB}MB totale dépassée`);
        break;
      }

      const isImage = file.type.startsWith("image/");
      validFiles.push({
        id: crypto.randomUUID(),
        file,
        preview: isImage ? URL.createObjectURL(file) : undefined,
        status: "pending",
      });
    }

    setPendingFiles(prev => [...prev, ...validFiles]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePendingFile = (id: string) => {
    setPendingFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const clearPendingFiles = () => {
    pendingFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setPendingFiles([]);
  };

  // Parallel upload with concurrency limit
  const uploadPendingFiles = async (): Promise<Array<{ type: "image" | "document"; name: string; url: string }>> => {
    if (!user || pendingFiles.length === 0) return [];

    setIsUploading(true);
    setUploadProgress(0);
    const uploadedFiles: Array<{ type: "image" | "document"; name: string; url: string }> = [];
    const total = pendingFiles.length;
    let completed = 0;

    // Upload function for a single file
    const uploadSingle = async (pending: PendingFile): Promise<{ type: "image" | "document"; name: string; url: string } | null> => {
      try {
        const fileExt = pending.file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        // Path must be user_id/... to match RLS policy: (auth.uid())::text = (storage.foldername(name))[1]
        const filePath = `${user.id}/agent-uploads/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, pending.file);

        if (uploadError) throw uploadError;

        // Get signed URL since bucket is not public
        const { data: urlData } = await supabase.storage
          .from("documents")
          .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

        if (!urlData?.signedUrl) throw new Error("Failed to get signed URL");

        const isImage = pending.file.type.startsWith("image/");
        
        setPendingFiles(prev => 
          prev.map(f => f.id === pending.id ? { ...f, status: "uploaded", url: urlData.signedUrl } : f)
        );

        completed++;
        setUploadProgress(Math.round((completed / total) * 100));

        return {
          type: isImage ? "image" : "document",
          name: pending.file.name,
          url: urlData.signedUrl,
        };
      } catch (error) {
        console.error(`Upload error for ${pending.file.name}:`, error);
        setPendingFiles(prev => 
          prev.map(f => f.id === pending.id ? { ...f, status: "error", error: "Échec upload" } : f)
        );
        completed++;
        setUploadProgress(Math.round((completed / total) * 100));
        return null;
      }
    };

    // Process in parallel with concurrency limit
    const chunks: PendingFile[][] = [];
    for (let i = 0; i < pendingFiles.length; i += MAX_CONCURRENT_UPLOADS) {
      chunks.push(pendingFiles.slice(i, i + MAX_CONCURRENT_UPLOADS));
    }

    for (const chunk of chunks) {
      const results = await Promise.all(chunk.map(uploadSingle));
      results.forEach(r => { if (r) uploadedFiles.push(r); });
    }

    setIsUploading(false);
    return uploadedFiles;
  };

  const sendMultiFileMessage = async () => {
    if (!user || (pendingFiles.length === 0 && !input.trim())) return;

    setIsLoading(true);

    try {
      // Upload all pending files first
      const uploadedFiles = await uploadPendingFiles();

      if (uploadedFiles.length === 0 && pendingFiles.length > 0) {
        toast.error("Échec de l'upload des fichiers");
        setIsLoading(false);
        return;
      }

      // Create user message with attachments info
      const attachmentNames = uploadedFiles.map(f => f.name).join(", ");
      const messageContent = input.trim() 
        ? input.trim() 
        : uploadedFiles.length === 1 
          ? `J'ai envoyé ${uploadedFiles[0].type === "image" ? "une image" : "un document"}: ${uploadedFiles[0].name}`
          : `J'ai envoyé ${uploadedFiles.length} fichiers: ${attachmentNames}`;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: messageContent,
        timestamp: new Date(),
        attachments: uploadedFiles,
        attachment: uploadedFiles.length === 1 ? uploadedFiles[0] : undefined,
      };

      setLocalMessages(prev => [...prev, userMessage]);
      setInput("");
      clearPendingFiles();

      // Save user message to DB
      await addMessage(
        "user",
        messageContent,
        uploadedFiles.length > 0 ? { 
          type: uploadedFiles.length === 1 ? uploadedFiles[0].type : "document", 
          name: uploadedFiles.length === 1 ? uploadedFiles[0].name : `${uploadedFiles.length} fichiers`,
          url: uploadedFiles.length === 1 ? uploadedFiles[0].url : undefined,
        } : undefined
      );

      // Build request for batch processing
      const agentRequest = {
        messageId: crypto.randomUUID(),
        userId: user.id,
        userName: userName || "Utilisateur",
        fromNumber: "web_chat",
        messageType: uploadedFiles.length > 0 
          ? (uploadedFiles.length === 1 && uploadedFiles[0].type === "image" ? "image" : "document") 
          : "text",
        content: messageContent,
        // Multi-file support
        mediaFiles: uploadedFiles.length > 0 ? uploadedFiles.map(f => ({
          url: f.url,
          name: f.name,
          contentType: f.type === "image" ? "image/jpeg" : "application/pdf",
        })) : undefined,
        // Single file fallback for backward compat
        mediaUrl: uploadedFiles.length === 1 ? uploadedFiles[0].url : undefined,
        mediaContentType: uploadedFiles.length === 1 
          ? (uploadedFiles[0].type === "image" ? "image/jpeg" : "application/pdf") 
          : undefined,
      };

      const { data, error } = await supabase.functions.invoke("whatsapp-agent", {
        body: agentRequest,
      });

      if (error) throw error;

      const responseContent = data?.responseMessage || data?.response || "Je n'ai pas pu traiter votre demande.";

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: responseContent,
        timestamp: new Date(),
      };

      setLocalMessages(prev => [...prev, assistantMessage]);
      await addMessage("assistant", responseContent);

    } catch (error) {
      console.error("Agent error:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "❌ Une erreur est survenue. Veuillez réessayer.",
        timestamp: new Date(),
      };
      setLocalMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Button - positioned above BottomNav (72px + safe) and Hejja toggle */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-[calc(72px+env(safe-area-inset-bottom)+4rem)] right-4 z-40 sm:bottom-[calc(72px+env(safe-area-inset-bottom)+0.5rem)] sm:right-auto sm:left-4"
          >
            <Button
              onClick={() => setIsOpen(true)}
              variant="outline"
              className="h-12 px-4 gap-2 rounded-full shadow-lg bg-background/95 backdrop-blur border-border hover:bg-muted active:scale-95 transition-transform touch-action-manipulation"
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

      {/* Hidden file input - multiple enabled */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx"
        className="hidden"
        multiple
        onChange={handleFilesSelect}
      />

      {/* Chat Window - positioned above BottomNav, responsive sizing */}
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
                ? "inset-2 sm:inset-4 md:inset-8"
                : "bottom-[calc(72px+env(safe-area-inset-bottom)+0.5rem)] right-2 left-2 sm:right-4 sm:left-auto sm:w-[400px] md:w-[420px] h-[55vh] sm:h-[60vh] max-h-[500px]"
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
                  onClick={() => setShowHistory(true)}
                  title="Historique"
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleNewConversation}
                  title="Nouvelle conversation"
                >
                  <Plus className="h-4 w-4" />
                </Button>
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

            {/* History Panel */}
            <AnimatePresence>
              {showHistory && (
                <ConversationHistory
                  conversations={conversations || []}
                  currentConversationId={currentConversationId}
                  onSelectConversation={selectConversation}
                  onNewConversation={handleNewConversation}
                  onDeleteConversation={deleteConversation}
                  onClose={() => setShowHistory(false)}
                  isLoading={loadingConversations}
                />
              )}
            </AnimatePresence>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
              {localMessages.length === 0 ? (
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
                  {localMessages.map((message) => (
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

            {/* Pending Files Preview */}
            {pendingFiles.length > 0 && (
              <div className="px-4 py-2 border-t bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    {pendingFiles.length} fichier{pendingFiles.length > 1 ? "s" : ""} sélectionné{pendingFiles.length > 1 ? "s" : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={clearPendingFiles}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Tout retirer
                  </Button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {pendingFiles.map(pending => (
                    <div
                      key={pending.id}
                      className="relative shrink-0 w-14 h-14 rounded-lg bg-muted border overflow-hidden group"
                    >
                      {pending.preview ? (
                        <img
                          src={pending.preview}
                          alt={pending.file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        onClick={() => removePendingFile(pending.id)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                      {pending.status === "error" && (
                        <div className="absolute inset-0 bg-destructive/80 flex items-center justify-center">
                          <X className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {isUploading && (
                  <Progress value={uploadProgress} className="h-1 mt-2" />
                )}
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t bg-muted/30">
              <form onSubmit={(e) => {
                e.preventDefault();
                if (pendingFiles.length > 0) {
                  sendMultiFileMessage();
                } else {
                  sendMessage(input);
                }
              }} className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "shrink-0 h-10 w-10",
                    pendingFiles.length > 0 && "text-primary"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isRecording || isUploading}
                >
                  {pendingFiles.length > 0 ? (
                    <Badge variant="secondary" className="h-6 w-6 p-0 justify-center text-xs">
                      {pendingFiles.length}
                    </Badge>
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>

                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    isRecording 
                      ? "Enregistrement..." 
                      : pendingFiles.length > 0 
                        ? "Message (optionnel)..." 
                        : "Tapez votre message..."
                  }
                  className="flex-1"
                  disabled={isLoading || isRecording || isUploading}
                />

                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "ghost"}
                  size="icon"
                  className={cn(
                    "shrink-0 h-10 w-10",
                    isRecording && "animate-pulse"
                  )}
                  onClick={toggleRecording}
                  disabled={isLoading || isUploading}
                >
                  {isRecording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  type="submit"
                  size="icon"
                  disabled={(!input.trim() && pendingFiles.length === 0) || isLoading || isRecording || isUploading}
                  className="shrink-0 h-10 w-10"
                >
                  {isLoading || isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : pendingFiles.length > 0 ? (
                    <Upload className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
