import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Json } from "@/integrations/supabase/types";

export type JobType = "document_analysis" | "receipt_ocr" | "bouquet_extraction";
export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface BackgroundJob {
  id: string;
  user_id: string;
  job_type: JobType;
  status: JobStatus;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error_message?: string;
  priority: number;
  attempts: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export function useBackgroundJobs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pendingJobs, setPendingJobs] = useState<BackgroundJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Keyed on the id: the user object changes on every token refresh, which
  // used to refetch and resubscribe repeatedly.
  const userId = user?.id;

  // Fetch user's pending jobs
  const fetchPendingJobs = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("background_jobs")
      .select("id, user_id, job_type, status, priority, attempts, created_at, started_at, completed_at, error_message")
      .eq("user_id", userId)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setPendingJobs(data as unknown as BackgroundJob[]);
    }
  }, [userId]);

  // Create a new background job
  const createJob = useCallback(async (
    jobType: JobType,
    payload: Record<string, unknown>,
    priority = 0
  ): Promise<string | null> => {
    if (!user) return null;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("background_jobs")
        .insert([{
          user_id: user.id,
          job_type: jobType,
          payload: payload as Json,
          priority,
        }])
        .select("id")
        .single();

      if (error) throw error;

      toast({
        title: "Traitement en cours",
        description: "L'analyse se poursuit en arrière-plan. Vous pouvez fermer l'application.",
      });

      // Trigger immediate processing
      triggerProcessing();

      return data.id;
    } catch (error) {
      console.error("Failed to create job:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de lancer le traitement",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  // Trigger the background processor
  const triggerProcessing = useCallback(async () => {
    try {
      await supabase.functions.invoke("process-background-jobs");
    } catch (error) {
      console.error("Failed to trigger processing:", error);
    }
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return;

    fetchPendingJobs();

    // Re-read only when the app comes back to the foreground; realtime covers the rest.
    const onVisible = () => { if (document.visibilityState === "visible") fetchPendingJobs(); };
    document.addEventListener("visibilitychange", onVisible);

    // Unique name per hook instance: a shared name made instances collide and resubscribe.
    const channel = supabase
      .channel(`background-jobs-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "background_jobs",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<BackgroundJob>) => {
          const newJob = payload.new as BackgroundJob;
          
          if (payload.eventType === "INSERT") {
            setPendingJobs(prev => [newJob, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            if (newJob.status === "completed") {
              setPendingJobs(prev => prev.filter(j => j.id !== newJob.id));
              toast({
                title: "Analyse terminée ✓",
                description: newJob.job_type === "document_analysis" 
                  ? "Le document a été analysé avec succès"
                  : "Le justificatif a été traité",
              });
            } else if (newJob.status === "failed") {
              setPendingJobs(prev => prev.filter(j => j.id !== newJob.id));
              toast({
                variant: "destructive",
                title: "Échec de l'analyse",
                description: newJob.error_message || "Une erreur est survenue",
              });
            } else {
              setPendingJobs(prev => prev.map(j => j.id === newJob.id ? newJob : j));
            }
          } else if (payload.eventType === "DELETE") {
            const oldJob = payload.old as BackgroundJob;
            setPendingJobs(prev => prev.filter(j => j.id !== oldJob.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchPendingJobs, toast]);

  return {
    pendingJobs,
    pendingCount: pendingJobs.length,
    isLoading,
    createJob,
    triggerProcessing,
    refetch: fetchPendingJobs,
  };
}
