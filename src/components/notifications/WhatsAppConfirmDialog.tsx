import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageCircle } from "lucide-react";

interface WhatsAppConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  clientName: string;
  classification: string;
}

const classificationLabels: Record<string, string> = {
  positif: "Positif ✅",
  negatif: "Négatif ❌",
  r2: "R2 - Second RDV 🔄",
  r2_prestudy: "R2 Pré-étude 📋",
  attente: "En attente ⏳",
  reporte: "Reporté 📅",
  nouveau: "Nouveau 🆕",
  annule: "Annulé 🚫",
  // Vente-specific
  installe: "Installation terminée ✅",
  paye: "Paiement reçu 💰",
};

export function WhatsAppConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  clientName,
  classification,
}: WhatsAppConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            Notification WhatsApp
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Voulez-vous prévenir le confirmateur par WhatsApp du changement de statut ?
            </p>
            <div className="bg-muted p-3 rounded-lg mt-2 space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">Client :</span>{" "}
                <span className="font-medium text-foreground">{clientName}</span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Nouveau statut :</span>{" "}
                <span className="font-medium text-foreground">
                  {classificationLabels[classification] || classification}
                </span>
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            Non, ne pas envoyer
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-green-600 hover:bg-green-700"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Oui, envoyer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
