import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AgentConversation {
  id: string;
  title: string | null;
  last_message_preview: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface AgentMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  attachment_type?: string | null;
  attachment_name?: string | null;
  attachment_url?: string | null;
  created_at: string;
}

export function useAgentConversations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Fetch all conversations
  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ["agent-conversations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_conversations")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as AgentConversation[];
    },
    enabled: !!user,
  });

  // Fetch messages for current conversation
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["agent-conversation-messages", currentConversationId],
    queryFn: async () => {
      if (!currentConversationId) return [];
      
      const { data, error } = await supabase
        .from("agent_conversation_messages")
        .select("*")
        .eq("conversation_id", currentConversationId)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as AgentMessage[];
    },
    enabled: !!currentConversationId,
  });

  // Create new conversation
  const createConversationMutation = useMutation({
    mutationFn: async (firstMessage?: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const title = firstMessage 
        ? firstMessage.substring(0, 50) + (firstMessage.length > 50 ? "..." : "")
        : "Nouvelle conversation";
      
      const { data, error } = await supabase
        .from("agent_conversations")
        .insert({
          user_id: user.id,
          title,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as AgentConversation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agent-conversations"] });
      setCurrentConversationId(data.id);
    },
  });

  // Add message to conversation
  const addMessageMutation = useMutation({
    mutationFn: async ({
      conversationId,
      role,
      content,
      attachment,
    }: {
      conversationId: string;
      role: "user" | "assistant";
      content: string;
      attachment?: {
        type: string;
        name: string;
        url?: string;
      };
    }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("agent_conversation_messages")
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role,
          content,
          attachment_type: attachment?.type,
          attachment_name: attachment?.name,
          attachment_url: attachment?.url,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as AgentMessage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-conversation-messages", currentConversationId] });
      queryClient.invalidateQueries({ queryKey: ["agent-conversations"] });
    },
  });

  // Delete conversation
  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("agent_conversations")
        .delete()
        .eq("id", conversationId);
      
      if (error) throw error;
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["agent-conversations"] });
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
      }
    },
  });

  // Start new conversation
  const startNewConversation = useCallback(async (firstMessage?: string) => {
    const conversation = await createConversationMutation.mutateAsync(firstMessage);
    return conversation;
  }, [createConversationMutation]);

  // Select an existing conversation
  const selectConversation = useCallback((conversationId: string | null) => {
    setCurrentConversationId(conversationId);
  }, []);

  // Add message to current or new conversation
  const addMessage = useCallback(async (
    role: "user" | "assistant",
    content: string,
    attachment?: { type: string; name: string; url?: string }
  ) => {
    let convId = currentConversationId;
    
    // If no conversation, create one
    if (!convId) {
      const conv = await startNewConversation(role === "user" ? content : undefined);
      convId = conv.id;
    }
    
    return addMessageMutation.mutateAsync({
      conversationId: convId,
      role,
      content,
      attachment,
    });
  }, [currentConversationId, startNewConversation, addMessageMutation]);

  return {
    conversations,
    messages,
    currentConversationId,
    loadingConversations,
    loadingMessages,
    startNewConversation,
    selectConversation,
    addMessage,
    deleteConversation: deleteConversationMutation.mutate,
    isCreating: createConversationMutation.isPending,
  };
}
