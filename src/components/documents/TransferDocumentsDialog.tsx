import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Search, User, ArrowRight, FileText } from "lucide-react";

interface Client {
  id: string;
  nom: string;
  prenom: string | null;
  ville: string | null;
}

interface TransferDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentIds: string[];
  currentClientId?: string;
  onSuccess?: () => void;
}

export function TransferDocumentsDialog({
  open,
  onOpenChange,
  documentIds,
  currentClientId,
  onSuccess,
}: TransferDocumentsDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      fetchClients();
    }
  }, [open, user]);

  useEffect(() => {
    setSelectedClientId(null);
  }, [open]);

  const fetchClients = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, nom, prenom, ville")
        .eq("user_id", user.id)
        .order("nom", { ascending: true })
        .limit(100);

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter((client) => {
    if (client.id === currentClientId) return false;
    const fullName = `${client.prenom || ""} ${client.nom}`.toLowerCase();
    const searchLower = search.toLowerCase();
    return fullName.includes(searchLower) || client.ville?.toLowerCase().includes(searchLower);
  });

  const handleTransfer = async () => {
    if (!selectedClientId || documentIds.length === 0) return;

    setTransferring(true);
    try {
      const { error } = await supabase
        .from("documents")
        .update({ client_id: selectedClientId })
        .in("id", documentIds);

      if (error) throw error;

      const targetClient = clients.find((c) => c.id === selectedClientId);
      toast.success(
        `${documentIds.length} document${documentIds.length > 1 ? "s" : ""} transféré${documentIds.length > 1 ? "s" : ""} vers ${targetClient?.prenom || ""} ${targetClient?.nom}`
      );
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error transferring documents:", error);
      toast.error("Erreur lors du transfert");
    } finally {
      setTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Transférer {documentIds.length} document{documentIds.length > 1 ? "s" : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Client list */}
          <ScrollArea className="h-64 border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <User className="h-8 w-8 mb-2" />
                <p className="text-sm text-center">
                  {search ? "Aucun client trouvé" : "Aucun autre client disponible"}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                      selectedClientId === client.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {client.prenom} {client.nom}
                      </p>
                      {client.ville && (
                        <p className={`text-xs truncate ${
                          selectedClientId === client.id 
                            ? "text-primary-foreground/70" 
                            : "text-muted-foreground"
                        }`}>
                          {client.ville}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedClientId || transferring}
          >
            {transferring ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Transférer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
