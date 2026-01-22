import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  FileText, 
  Copy,
  Loader2,
  CheckCircle,
} from "lucide-react";

interface Vente {
  id: string;
  montant_ht: number;
  puissance_kwc: number | null;
  client: {
    id: string;
    nom: string;
    prenom: string | null;
  } | null;
}

interface QontoInvoiceProps {
  venteIds: string[];
  ventes: Vente[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommissionLine {
  clientName: string;
  puissanceKwc: number;
  commissionHT: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

export const QontoInvoice = ({ venteIds, ventes, open, onOpenChange }: QontoInvoiceProps) => {
  const [lines, setLines] = useState<CommissionLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedVentes = ventes.filter(v => venteIds.includes(v.id));

  useEffect(() => {
    if (open && venteIds.length > 0) {
      calculateCommissions();
    }
  }, [open, venteIds]);

  const calculateCommissions = async () => {
    setLoading(true);
    
    try {
      // Fetch commission data
      const { data: dataCommissions } = await supabase
        .from("data_commissions")
        .select("*")
        .order("tranche_min");

      const { data: bouquets } = await supabase
        .from("data_prix_bouquets")
        .select("puissance_kwc, prix_hejja, prix_recommande");

      const { data: configData } = await supabase
        .from("config_commissions")
        .select("part_survente_pct")
        .maybeSingle();

      const surventePct = configData?.part_survente_pct || 50;

      const calculatedLines: CommissionLine[] = selectedVentes.map(vente => {
        const clientName = vente.client 
          ? `${vente.client.prenom || ""} ${vente.client.nom}`.trim()
          : "Client inconnu";
        
        const puissance = vente.puissance_kwc || 0;
        
        // Find matching bouquet for base commission
        const bouquet = bouquets?.find(b => b.puissance_kwc === puissance);
        const prixHejja = bouquet?.prix_hejja || 0;
        const prixRecommande = bouquet?.prix_recommande || 0;
        
        // Find commission rate for this tranche
        const tranche = dataCommissions?.find(
          t => vente.montant_ht >= t.tranche_min && vente.montant_ht <= t.tranche_max
        );
        
        const tauxCommission = tranche?.taux_commission || 0;
        
        // Base commission from montant HT
        let commissionHT = vente.montant_ht * (tauxCommission / 100);
        
        // Add survente bonus if price is above prix recommandé
        if (prixHejja > 0 && vente.montant_ht > prixRecommande) {
          const surventeBase = vente.montant_ht - prixRecommande;
          const bonusSurvente = surventeBase * (surventePct / 100);
          commissionHT += bonusSurvente;
        }

        return {
          clientName,
          puissanceKwc: puissance,
          commissionHT,
        };
      });

      setLines(calculatedLines);
    } catch (error) {
      console.error("Erreur calcul commissions:", error);
      toast.error("Erreur lors du calcul des commissions");
    } finally {
      setLoading(false);
    }
  };

  const totalCommission = lines.reduce((sum, l) => sum + l.commissionHT, 0);

  const copyToClipboard = () => {
    // Format for Qonto: Client | Puissance | Commission HT
    const text = lines.map(l => 
      `${l.clientName}\t${l.puissanceKwc} kWc\t${formatCurrency(l.commissionHT)}`
    ).join("\n");
    
    const fullText = `Lignes pour facture Qonto:\n\n${text}\n\nTOTAL HT: ${formatCurrency(totalCommission)}`;
    
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copié dans le presse-papier");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Lignes facture Qonto
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Copiez ces lignes pour créer votre facture sur Qonto
            </p>

            {/* Table */}
            <div className="flex-1 overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">kWc</TableHead>
                    <TableHead className="text-right">Commission HT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{line.clientName}</TableCell>
                      <TableCell className="text-right">{line.puissanceKwc}</TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {formatCurrency(line.commissionHT)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Separator />

            {/* Total */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 flex items-center justify-between">
                <span className="font-medium">TOTAL HT</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(totalCommission)}
                </span>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Fermer
              </Button>
              <Button className="flex-1" onClick={copyToClipboard}>
                {copied ? (
                  <CheckCircle className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copied ? "Copié !" : "Copier tout"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
