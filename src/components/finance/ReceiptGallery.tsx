import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  FolderOpen,
  FileImage,
  Download,
  Send,
  Eye,
  Loader2,
  X,
  ChevronDown,
  Calendar,
  Euro,
} from "lucide-react";
import { toast } from "sonner";
import { MediaPreview } from "@/components/documents/MediaPreview";

interface ReceiptItem {
  id: string;
  montant: number;
  date_frais: string;
  categorie: string;
  description: string | null;
  justificatif_url: string | null;
}

const categoryLabels: Record<string, string> = {
  carburant: "Carburant",
  repas: "Repas",
  hotel: "Hôtel",
  peage: "Péage",
  parking: "Parking",
  train: "Trains",
  location_vehicule: "Location Véhicule",
  autre: "Autre",
};

interface ReceiptGalleryProps {
  onClose?: () => void;
}

export function ReceiptGallery({ onClose }: ReceiptGalleryProps) {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchReceipts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("frais")
          .select("id, montant, date_frais, categorie, description, justificatif_url")
          .eq("user_id", user.id)
          .not("justificatif_url", "is", null)
          .order("date_frais", { ascending: false });

        if (error) throw error;
        setReceipts(data || []);
      } catch (err) {
        console.error("Error fetching receipts:", err);
        toast.error("Erreur lors du chargement des factures");
      } finally {
        setLoading(false);
      }
    };

    fetchReceipts();
  }, [user]);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === receipts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(receipts.map((r) => r.id)));
    }
  };

  const handlePreview = (url: string) => {
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  const handleDownload = async (receipt: ReceiptItem) => {
    if (!receipt.justificatif_url) return;

    try {
      const url = receipt.justificatif_url;
      // Detect file type from URL or base64 header
      let extension = "jpg";
      if (url.includes(".pdf") || url.startsWith("data:application/pdf")) {
        extension = "pdf";
      } else if (url.includes(".png") || url.startsWith("data:image/png")) {
        extension = "png";
      }
      
      const fileName = `facture_${receipt.date_frais}_${categoryLabels[receipt.categorie]}.${extension}`;

      // For base64 data
      if (url.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // For storage URLs, fetch and download
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }
      toast.success("Téléchargement lancé");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Erreur lors du téléchargement");
    }
  };

  const handleBulkDownload = async () => {
    const selected = receipts.filter((r) => selectedIds.has(r.id));
    for (const receipt of selected) {
      await handleDownload(receipt);
    }
  };

  const handleSendEmail = () => {
    const selected = receipts.filter((r) => selectedIds.has(r.id));
    const total = selected.reduce((sum, r) => sum + Number(r.montant), 0);
    const body = selected
      .map(
        (r) =>
          `- ${new Date(r.date_frais).toLocaleDateString("fr-FR")} | ${categoryLabels[r.categorie]} | ${Number(r.montant).toFixed(2)}€`
      )
      .join("\n");

    const subject = encodeURIComponent(`Note de frais - ${selected.length} factures - ${total.toFixed(2)}€`);
    const mailBody = encodeURIComponent(
      `Bonjour,\n\nVeuillez trouver ci-joint mes justificatifs de frais:\n\n${body}\n\nTotal: ${total.toFixed(2)}€\n\nCordialement`
    );

    window.open(`mailto:?subject=${subject}&body=${mailBody}`, "_blank");
    toast.info("Ouverture du client mail...");
  };

  const selectedCount = selectedIds.size;

  return (
    <Card className="w-full max-h-[80vh] flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Mes factures ({receipts.length})
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Selection actions */}
        {receipts.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="text-xs"
            >
              {selectedIds.size === receipts.length ? "Tout désélectionner" : "Tout sélectionner"}
            </Button>

            {selectedCount > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" size="sm" className="gap-1.5">
                    {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={handleBulkDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSendEmail}>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer par email
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileImage className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucune facture scannée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    selectedIds.has(receipt.id)
                      ? "bg-primary/5 border-primary/30"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={selectedIds.has(receipt.id)}
                    onCheckedChange={() => toggleSelection(receipt.id)}
                  />

                  {/* Thumbnail */}
                  <div
                    className="h-12 w-12 rounded bg-muted flex-shrink-0 overflow-hidden cursor-pointer"
                    onClick={() => receipt.justificatif_url && handlePreview(receipt.justificatif_url)}
                  >
                    {receipt.justificatif_url?.startsWith("data:image") ? (
                      <img
                        src={receipt.justificatif_url}
                        alt="Facture"
                        className="h-full w-full object-cover"
                      />
                    ) : receipt.justificatif_url && !receipt.justificatif_url.includes(".pdf") && !receipt.justificatif_url.startsWith("data:application/pdf") ? (
                      <img
                        src={receipt.justificatif_url}
                        alt="Facture"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          // Fallback to icon if image fails to load
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).parentElement?.insertAdjacentHTML('beforeend', '<div class="h-full w-full flex items-center justify-center"><svg class="h-5 w-5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg></div>');
                        }}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <FileImage className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {receipt.description || categoryLabels[receipt.categorie]}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(receipt.date_frais).toLocaleDateString("fr-FR")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Euro className="h-3 w-3" />
                        {Number(receipt.montant).toFixed(2)}€
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 min-h-[44px] min-w-[44px]"
                      onClick={() => receipt.justificatif_url && handlePreview(receipt.justificatif_url)}
                    >
                      <Eye className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 min-h-[44px] min-w-[44px]"
                      onClick={() => handleDownload(receipt)}
                    >
                      <Download className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      <MediaPreview isOpen={previewOpen} onClose={() => setPreviewOpen(false)}
        initialIndex={Math.max(0, receipts.filter((r) => r.justificatif_url).findIndex((r) => r.justificatif_url === previewUrl))}
        items={receipts.flatMap((r) => r.justificatif_url ? [{ id: r.id, nom: r.description || `Facture ${r.date_frais}`, url: r.justificatif_url }] : [])} />
    </Card>
  );
}
