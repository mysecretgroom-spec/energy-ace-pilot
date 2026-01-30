import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Centralized hook to invalidate queries after mutations.
 * This ensures the UI refreshes automatically after data changes.
 */
export function useQueryInvalidation() {
  const queryClient = useQueryClient();

  // Invalidate all finance-related queries
  const invalidateFinance = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["frais"] });
    queryClient.invalidateQueries({ queryKey: ["ventes"] });
    queryClient.invalidateQueries({ queryKey: ["commissions"] });
    queryClient.invalidateQueries({ queryKey: ["finance-stats"] });
  }, [queryClient]);

  // Invalidate client-related queries
  const invalidateClient = useCallback((clientId?: string) => {
    if (clientId) {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client-documents", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client-rdvs", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client-etudes", clientId] });
    }
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  }, [queryClient]);

  // Invalidate document-related queries
  const invalidateDocuments = useCallback((clientId?: string) => {
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["pending-documents"] });
    if (clientId) {
      queryClient.invalidateQueries({ queryKey: ["client-documents", clientId] });
    }
  }, [queryClient]);

  // Invalidate planning/RDV queries
  const invalidatePlanning = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["rdv"] });
    queryClient.invalidateQueries({ queryKey: ["planning"] });
    queryClient.invalidateQueries({ queryKey: ["rdvs"] });
  }, [queryClient]);

  // Invalidate settings queries
  const invalidateSettings = useCallback((settingType?: string) => {
    if (settingType) {
      queryClient.invalidateQueries({ queryKey: [settingType] });
    }
    queryClient.invalidateQueries({ queryKey: ["settings"] });
    queryClient.invalidateQueries({ queryKey: ["user-settings"] });
    queryClient.invalidateQueries({ queryKey: ["regies"] });
    queryClient.invalidateQueries({ queryKey: ["bouquets"] });
    queryClient.invalidateQueries({ queryKey: ["data-aides"] });
    queryClient.invalidateQueries({ queryKey: ["data-psh"] });
    queryClient.invalidateQueries({ queryKey: ["data-orientation"] });
    queryClient.invalidateQueries({ queryKey: ["data-tarifs"] });
    queryClient.invalidateQueries({ queryKey: ["data-compteurs"] });
    queryClient.invalidateQueries({ queryKey: ["data-calibres"] });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
    queryClient.invalidateQueries({ queryKey: ["agent-prompts"] });
    queryClient.invalidateQueries({ queryKey: ["agent-memories"] });
  }, [queryClient]);

  // Invalidate CRM/ventes queries
  const invalidateCRM = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["ventes"] });
    queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    queryClient.invalidateQueries({ queryKey: ["crm"] });
    queryClient.invalidateQueries({ queryKey: ["commissions"] });
  }, [queryClient]);

  // Invalidate all data (nuclear option for major changes)
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  return {
    invalidateFinance,
    invalidateClient,
    invalidateDocuments,
    invalidatePlanning,
    invalidateSettings,
    invalidateCRM,
    invalidateAll,
  };
}

// Helper to create a refresh callback that can be passed to child components
export function createRefreshCallback(refetchFn: () => void) {
  return () => {
    refetchFn();
  };
}
