import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Loader2, Sparkles, X, Wand2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  config?: Record<string, unknown>;
}

interface WorkflowEdge {
  source: string;
  target: string;
  condition_type?: string;
}

interface GeneratedWorkflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowAssistantProps {
  currentNodes: WorkflowNode[];
  currentEdges: WorkflowEdge[];
  onApplyWorkflow: (workflow: GeneratedWorkflow) => void;
  isOpen: boolean;
  onClose: () => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workflow-assistant`;

export function WorkflowAssistant({ 
  currentNodes, 
  currentEdges, 
  onApplyWorkflow, 
  isOpen, 
  onClose 
}: WorkflowAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Bonjour ! Je suis là pour t'aider à créer ton workflow. Décris-moi ce que tu veux automatiser et je te proposerai une structure adaptée. 🚀"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const extractWorkflowFromResponse = (content: string): GeneratedWorkflow | null => {
    // Look for JSON in the response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.nodes && Array.isArray(parsed.nodes)) {
          return parsed as GeneratedWorkflow;
        }
      } catch (e) {
        console.error("Failed to parse workflow JSON:", e);
      }
    }
    
    // Try to find raw JSON object
    const rawJsonMatch = content.match(/\{[\s\S]*"nodes"[\s\S]*\}/);
    if (rawJsonMatch) {
      try {
        const parsed = JSON.parse(rawJsonMatch[0]);
        if (parsed.nodes && Array.isArray(parsed.nodes)) {
          return parsed as GeneratedWorkflow;
        }
      } catch (e) {
        // Not valid JSON
      }
    }
    
    return null;
  };

  const streamChat = useCallback(async (userMessages: Message[]) => {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ 
        messages: userMessages,
        currentWorkflow: {
          nodes: currentNodes,
          edges: currentEdges
        }
      }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || "Erreur de connexion");
    }

    if (!resp.body) throw new Error("Pas de réponse");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantContent += content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant" && prev.length > 1) {
                return prev.map((m, i) => 
                  i === prev.length - 1 ? { ...m, content: assistantContent } : m
                );
              }
              return [...prev, { role: "assistant", content: assistantContent }];
            });
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    return assistantContent;
  }, [currentNodes, currentEdges]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await streamChat(newMessages.filter(m => m.role !== "assistant" || messages.indexOf(m) > 0));
      
      // Check if response contains a workflow definition
      const workflow = extractWorkflowFromResponse(response);
      if (workflow) {
        // Add apply button message
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: "✨ Workflow détecté ! Clique sur le bouton ci-dessous pour l'appliquer dans l'éditeur."
          }
        ]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error(error instanceof Error ? error.message : "Erreur de communication");
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Désolé, une erreur s'est produite. Réessaie dans un instant." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyLastWorkflow = () => {
    // Find the last message containing a workflow
    for (let i = messages.length - 1; i >= 0; i--) {
      const workflow = extractWorkflowFromResponse(messages[i].content);
      if (workflow) {
        onApplyWorkflow(workflow);
        toast.success("Workflow appliqué dans l'éditeur !");
        return;
      }
    }
    toast.error("Aucun workflow trouvé dans la conversation");
  };

  // Check if there's a workflow in recent messages
  const hasWorkflowToApply = messages.some(m => extractWorkflowFromResponse(m.content) !== null);

  if (!isOpen) return null;

  return (
    <Card className="fixed right-4 bottom-4 w-96 h-[500px] shadow-2xl z-50 flex flex-col border-primary/20">
      <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          Assistant Workflow
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {hasWorkflowToApply && (
        <div className="px-4 py-2 border-t bg-primary/5">
          <Button 
            onClick={handleApplyLastWorkflow}
            className="w-full gap-2"
            size="sm"
          >
            <Wand2 className="h-4 w-4" />
            Appliquer le workflow
          </Button>
        </div>
      )}

      <CardContent className="p-3 border-t">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Décris ton workflow..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Floating button to open assistant
export function WorkflowAssistantTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      className="fixed right-4 bottom-4 h-12 w-12 rounded-full z-40"
      size="icon"
    >
      <Sparkles className="h-5 w-5" />
    </Button>
  );
}
