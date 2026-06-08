import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UseDeleteEntityOptions {
  tableName: "clients" | "ventes" | "rdv";
  entityName: string;
  onSuccess?: () => void;
}

export function useDeleteEntity({ tableName, entityName, onSuccess }: UseDeleteEntityOptions) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${entityName} supprimé(e) avec succès`);
      setIsDeleteDialogOpen(false);
      setEntityToDelete(null);
      onSuccess?.();
    },
    onError: (error: unknown) => {
      console.error("Delete error:", error);

      const err = error as { code?: string; message?: string } | null;
      // Handle foreign key constraint errors
      if (err?.code === "23503" || err?.message?.includes("foreign key")) {
        toast.error(`Impossible de supprimer : des données liées existent`);
      } else {
        toast.error(`Erreur lors de la suppression`);
      }
    },
  });

  const openDeleteDialog = (id: string) => {
    setEntityToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (entityToDelete) {
      deleteMutation.mutate(entityToDelete);
    }
  };

  const cancelDelete = () => {
    setIsDeleteDialogOpen(false);
    setEntityToDelete(null);
  };

  return {
    isDeleteDialogOpen,
    isDeleting: deleteMutation.isPending,
    openDeleteDialog,
    confirmDelete,
    cancelDelete,
  };
}
