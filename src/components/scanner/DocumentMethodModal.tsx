import React, { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Camera, 
  Upload, 
  FileText, 
  Receipt, 
  Smartphone, 
  ScanLine,
  ChevronRight,
  ArrowLeft
} from "lucide-react";
import type { DocumentContext } from "./types";

interface DocumentMethodModalProps {
  isOpen: boolean;
  context: DocumentContext;
  onSelectMethod: (method: "scan" | "import") => void;
  onFileImport: (file: File) => void;
  onClose: () => void;
}

type ModalView = "main" | "scan-options";

export function DocumentMethodModal({
  isOpen,
  context,
  onSelectMethod,
  onFileImport,
  onClose,
}: DocumentMethodModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCaptureRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<ModalView>("main");

  const title = context === "finance" 
    ? "Ajouter une facture" 
    : "Ajouter un document";

  const Icon = context === "finance" ? Receipt : FileText;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileImport(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleNativeCaptureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileImport(file);
    }
    if (nativeCaptureRef.current) {
      nativeCaptureRef.current.value = "";
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleNativeScanClick = () => {
    nativeCaptureRef.current?.click();
  };

  const handleExternalAppScan = () => {
    // Show instructions for using external scanner apps
    const message = `Pour scanner avec une application externe :

1. Ouvrez CamScanner, Adobe Scan ou l'app de scan de votre téléphone
2. Scannez votre document
3. Exportez-le en PDF ou image
4. Revenez ici et utilisez "Importer un fichier"`;
    
    alert(message);
  };

  const handleClose = () => {
    setView("main");
    onClose();
  };

  const renderMainView = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </DialogTitle>
      </DialogHeader>
      
      <div className="grid gap-3 py-4">
        <Button
          variant="outline"
          className="h-20 flex items-center justify-between px-4 border-2 hover:border-primary hover:bg-primary/5"
          onClick={() => setView("scan-options")}
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <ScanLine className="h-6 w-6 text-primary" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium block">Scanner un document</span>
              <span className="text-xs text-muted-foreground">
                Plusieurs options disponibles
              </span>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Button>

        <Button
          variant="outline"
          className="h-20 flex items-center justify-start gap-3 px-4 border-2 hover:border-primary hover:bg-primary/5"
          onClick={handleImportClick}
        >
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div className="text-left">
            <span className="text-sm font-medium block">Importer un fichier</span>
            <span className="text-xs text-muted-foreground">
              PDF, JPG, JPEG ou PNG
            </span>
          </div>
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
        <Button variant="ghost" onClick={handleClose}>
          Annuler
        </Button>
      </div>
    </>
  );

  const renderScanOptionsView = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 mr-1"
            onClick={() => setView("main")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          Choisir un scanner
        </DialogTitle>
      </DialogHeader>
      
      <div className="grid gap-3 py-4">
        {/* Native device scanner - uses capture attribute */}
        <Button
          variant="outline"
          className="h-20 flex items-center justify-start gap-3 px-4 border-2 hover:border-primary hover:bg-primary/5"
          onClick={handleNativeScanClick}
        >
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <Smartphone className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-left flex-1">
            <span className="text-sm font-medium block">Scanner natif</span>
            <span className="text-xs text-muted-foreground">
              iOS Notes / Android Scanner
            </span>
          </div>
          <span className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-full">
            Recommandé
          </span>
        </Button>

        {/* External app scanner */}
        <Button
          variant="outline"
          className="h-20 flex items-center justify-start gap-3 px-4 border-2 hover:border-primary hover:bg-primary/5"
          onClick={handleExternalAppScan}
        >
          <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-left">
            <span className="text-sm font-medium block">Application externe</span>
            <span className="text-xs text-muted-foreground">
              CamScanner, Adobe Scan...
            </span>
          </div>
        </Button>

        {/* Built-in scanner */}
        <Button
          variant="outline"
          className="h-20 flex items-center justify-start gap-3 px-4 border-2 hover:border-primary hover:bg-primary/5"
          onClick={() => onSelectMethod("scan")}
        >
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Camera className="h-6 w-6 text-primary" />
          </div>
          <div className="text-left">
            <span className="text-sm font-medium block">Scanner intégré</span>
            <span className="text-xs text-muted-foreground">
              Détection automatique des bords
            </span>
          </div>
        </Button>

        {/* Hidden input for native capture */}
        <input
          ref={nativeCaptureRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleNativeCaptureChange}
          className="hidden"
        />
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={handleClose}>
          Annuler
        </Button>
      </div>
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {view === "main" ? renderMainView() : renderScanOptionsView()}
      </DialogContent>
    </Dialog>
  );
}
