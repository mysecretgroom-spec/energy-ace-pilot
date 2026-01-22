import React, { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, FileText, Receipt } from "lucide-react";
import type { DocumentContext } from "./AddDocumentFlow";

interface DocumentMethodModalProps {
  isOpen: boolean;
  context: DocumentContext;
  onSelectMethod: (method: "scan" | "import") => void;
  onFileImport: (file: File) => void;
  onClose: () => void;
}

export function DocumentMethodModal({
  isOpen,
  context,
  onSelectMethod,
  onFileImport,
  onClose,
}: DocumentMethodModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const title = context === "finance" 
    ? "Ajouter une facture" 
    : "Ajouter un document";

  const scanLabel = context === "finance"
    ? "Scanner une facture"
    : "Scanner un document";

  const importLabel = context === "finance"
    ? "Importer un fichier"
    : "Importer un fichier";

  const Icon = context === "finance" ? Receipt : FileText;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileImport(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <Button
            variant="outline"
            className="h-24 flex flex-col items-center justify-center gap-2 border-2 border-dashed hover:border-primary hover:bg-primary/5"
            onClick={() => onSelectMethod("scan")}
          >
            <Camera className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium">{scanLabel}</span>
            <span className="text-xs text-muted-foreground">
              Utilisez la caméra pour numériser
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-24 flex flex-col items-center justify-center gap-2 border-2 border-dashed hover:border-primary hover:bg-primary/5"
            onClick={handleImportClick}
          >
            <Upload className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium">{importLabel}</span>
            <span className="text-xs text-muted-foreground">
              PDF, JPG, JPEG ou PNG
            </span>
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/jpg,image/png"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
