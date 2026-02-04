import { useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "etude_form_draft";
const STORAGE_VERSION = 1;

export interface EtudeFormDraft {
  version: number;
  clientId: string | null;
  rdvId: string | null;
  etudeId: string | null;
  timestamp: number;
  data: Record<string, any>;
}

interface UseEtudeFormPersistenceOptions {
  clientId: string | null;
  rdvId: string | null;
  etudeId: string | null;
  enabled?: boolean;
}

/**
 * Hook to persist form state to sessionStorage and protect against accidental navigation
 * - Saves form data automatically on changes
 * - Restores form data when returning to the page
 * - Shows beforeunload warning when leaving with unsaved changes
 * - Clears draft when form is successfully saved
 */
export function useEtudeFormPersistence({
  clientId,
  rdvId,
  etudeId,
  enabled = true,
}: UseEtudeFormPersistenceOptions) {
  const hasUnsavedChangesRef = useRef(false);
  const isRestoringRef = useRef(false);

  // Get storage key unique to this client/rdv/etude combination
  const getStorageKey = useCallback(() => {
    const suffix = etudeId || `${clientId}_${rdvId || "new"}`;
    return `${STORAGE_KEY}_${suffix}`;
  }, [clientId, rdvId, etudeId]);

  // Save draft to sessionStorage
  const saveDraft = useCallback((data: Record<string, any>) => {
    if (!enabled || !clientId || isRestoringRef.current) return;
    
    try {
      const draft: EtudeFormDraft = {
        version: STORAGE_VERSION,
        clientId,
        rdvId,
        etudeId,
        timestamp: Date.now(),
        data,
      };
      sessionStorage.setItem(getStorageKey(), JSON.stringify(draft));
      hasUnsavedChangesRef.current = true;
    } catch (error) {
      console.warn("Failed to save etude draft:", error);
    }
  }, [enabled, clientId, rdvId, etudeId, getStorageKey]);

  // Load draft from sessionStorage
  const loadDraft = useCallback((): Record<string, any> | null => {
    if (!enabled || !clientId) return null;
    
    try {
      const stored = sessionStorage.getItem(getStorageKey());
      if (!stored) return null;
      
      const draft: EtudeFormDraft = JSON.parse(stored);
      
      // Check version compatibility
      if (draft.version !== STORAGE_VERSION) {
        sessionStorage.removeItem(getStorageKey());
        return null;
      }
      
      // Check if draft is for the same client/rdv/etude
      if (draft.clientId !== clientId) {
        return null;
      }
      
      // Check if draft is not too old (max 24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - draft.timestamp > maxAge) {
        sessionStorage.removeItem(getStorageKey());
        return null;
      }
      
      isRestoringRef.current = true;
      return draft.data;
    } catch (error) {
      console.warn("Failed to load etude draft:", error);
      return null;
    }
  }, [enabled, clientId, getStorageKey]);

  // Clear draft (call after successful save)
  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(getStorageKey());
      hasUnsavedChangesRef.current = false;
    } catch (error) {
      console.warn("Failed to clear etude draft:", error);
    }
  }, [getStorageKey]);

  // Mark restoration as complete (call after form values are set)
  const markRestorationComplete = useCallback(() => {
    // Delay to allow form state to settle
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 500);
  }, []);

  // Check if we're currently restoring data
  const isRestoring = useCallback(() => {
    return isRestoringRef.current;
  }, []);

  // Beforeunload handler to warn user before leaving
  useEffect(() => {
    if (!enabled) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = ""; // Required for Chrome
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled]);

  // Visibility change handler - save immediately when app goes to background
  useEffect(() => {
    if (!enabled) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && hasUnsavedChangesRef.current) {
        // The draft should already be saved via regular saveDraft calls
        // This just ensures we don't lose the ref state
        console.log("[EtudeFormPersistence] Page hidden, draft preserved");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [enabled]);

  // Pagehide handler for iOS Safari
  useEffect(() => {
    if (!enabled) return;
    
    const handlePageHide = () => {
      if (hasUnsavedChangesRef.current) {
        console.log("[EtudeFormPersistence] Page hiding, draft preserved");
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [enabled]);

  return {
    saveDraft,
    loadDraft,
    clearDraft,
    markRestorationComplete,
    isRestoring,
    setHasUnsavedChanges: (value: boolean) => {
      hasUnsavedChangesRef.current = value;
    },
  };
}
