import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { MediaPreview } from "./MediaPreview";
import type { PreviewMedia } from "./previewMedia";
import { TransferDocumentsDialog } from "./TransferDocumentsDialog";

interface DocumentPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  documents: PreviewMedia[];
  initialIndex?: number;
  clientId?: string;
  onTransferSuccess?: () => void;
}

export function DocumentPreview({ isOpen, onClose, documents, initialIndex = 0, clientId, onTransferSuccess }: DocumentPreviewProps) {
  const [transferId, setTransferId] = useState<string | null>(null);
  return <>
    <MediaPreview isOpen={isOpen && !transferId} onClose={onClose} items={documents} initialIndex={initialIndex}
      action={clientId ? { label: "Transférer", icon: <ArrowRight className="h-5 w-5" />, onClick: (item) => setTransferId(item.id) } : undefined} />
    <TransferDocumentsDialog open={!!transferId} onOpenChange={(open) => { if (!open) setTransferId(null); }}
      documentIds={transferId ? [transferId] : []} currentClientId={clientId}
      onSuccess={() => { setTransferId(null); onTransferSuccess?.(); onClose(); }} />
  </>;
}
