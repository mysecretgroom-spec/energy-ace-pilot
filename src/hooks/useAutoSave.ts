import { useCallback, useRef, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface AutoSaveOptions {
  debounceMs?: number;
  onSave: () => Promise<void>;
  enabled?: boolean;
}

export function useAutoSave({ debounceMs = 2000, onSave, enabled = true }: AutoSaveOptions) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const triggerSave = useCallback(async () => {
    if (!enabled) return;
    
    setIsSaving(true);
    try {
      await onSave();
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Auto-save failed:", error);
      toast({
        variant: "destructive",
        title: "Erreur d'enregistrement automatique",
        description: "Les modifications seront réessayées",
      });
    } finally {
      setIsSaving(false);
    }
  }, [enabled, onSave, toast]);

  const debouncedSave = useCallback(() => {
    if (!enabled) return;
    
    setHasUnsavedChanges(true);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      triggerSave();
    }, debounceMs);
  }, [enabled, debounceMs, triggerSave]);

  // Immediate save (e.g., for photo uploads or status changes)
  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    await triggerSave();
  }, [triggerSave]);

  // Cancel pending save
  const cancelPendingSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    debouncedSave,
    saveNow,
    cancelPendingSave,
    setHasUnsavedChanges,
  };
}
