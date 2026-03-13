import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { PinDialog } from "@/components/auth/PinDialog";
import { FileText, ShieldCheck, ShieldOff, X } from "lucide-react";

interface ResultatPdfChoiceDialogProps {
  open: boolean;
  onClose: () => void;
  onChoose: (showLogos: boolean) => void;
  loading?: boolean;
}

export function ResultatPdfChoiceDialog({ open, onClose, onChoose, loading }: ResultatPdfChoiceDialogProps) {
  const [showPinDialog, setShowPinDialog] = useState(false);

  const handleHejjaClick = () => {
    setShowPinDialog(true);
  };

  const handlePinSuccess = () => {
    setShowPinDialog(false);
    onChoose(true);
  };

  return (
    <>
      <Dialog open={open && !showPinDialog} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogClose asChild>
            <button
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Fermer</span>
            </button>
          </DialogClose>
          <DialogHeader>
            <DialogTitle className="text-center">Résultat d'étude</DialogTitle>
            <DialogDescription className="text-center">
              Choisissez la version du document à générer
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 pt-2">
            {/* Kasher version */}
            <Button
              variant="outline"
              className="flex flex-col items-center gap-3 h-auto py-6 border-2 hover:border-primary hover:bg-primary/5 transition-all"
              onClick={() => onChoose(false)}
              disabled={loading}
            >
              <ShieldCheck className="h-8 w-8 text-primary" />
              <div className="text-center">
                <p className="font-semibold text-sm">Kasher</p>
                <p className="text-[10px] text-muted-foreground mt-1">Sans logos partenaires</p>
              </div>
            </Button>

            {/* Hejja version */}
            <Button
              variant="outline"
              className="flex flex-col items-center gap-3 h-auto py-6 border-2 border-red-200 hover:border-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:border-red-500 dark:hover:bg-red-900/20 transition-all"
              onClick={handleHejjaClick}
              disabled={loading}
            >
              <ShieldOff className="h-8 w-8 text-red-500" />
              <div className="text-center">
                <p className="font-semibold text-sm text-red-600 dark:text-red-400">Hejja</p>
                <p className="text-[10px] text-muted-foreground mt-1">Avec logos partenaires</p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PinDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        onSuccess={handlePinSuccess}
        title="Code HEJJA requis"
        description="Entrez le code PIN pour générer la version avec logos"
      />
    </>
  );
}
