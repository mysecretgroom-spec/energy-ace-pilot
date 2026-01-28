import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  FileText, 
  Euro, 
  Download, 
  CheckSquare, 
  Square,
  Loader2,
  User,
  Calendar
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Vente {
  id: string;
  numero_contrat: string | null;
  date_signature: string | null;
  montant_ht: number;
  montant_ttc: number;
  puissance_kwc: number | null;
  status: string;
  regie_id?: string | null;
  decom_montant?: number | null;
  client: {
    id: string;
    nom: string;
    prenom: string | null;
  } | null;
}

interface Commission {
  vente_id: string;
  montant_base: number;
  commission_fixe: number;
  bonus_survente: number;
  montant_commission: number;
}

interface CommissionInvoiceProps {
  ventes: Vente[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

export const CommissionInvoice = ({ ventes, open, onOpenChange }: CommissionInvoiceProps) => {
  const { user } = useAuth();
  const [selectedVentes, setSelectedVentes] = useState<string[]>([]);
  const [commissions, setCommissions] = useState<Map<string, Commission>>(new Map());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Filtrer les ventes éligibles (payées uniquement)
  const eligibleVentes = ventes.filter(v => v.status === "paye");

  useEffect(() => {
    if (open && eligibleVentes.length > 0) {
      loadAndCalculateCommissions();
    }
  }, [open, ventes]);

  useEffect(() => {
    if (selectedVentes.length > 0) {
      loadAndCalculateCommissions();
    }
  }, [selectedVentes]);

  const loadAndCalculateCommissions = async () => {
    setLoading(true);
    
    try {
      // Get unique regie IDs from ventes
      const regieIds = [...new Set(eligibleVentes.map(v => v.regie_id).filter(Boolean))] as string[];
      
      // Fetch bouquets (unified table) and regie configs
      const [bouquetsRes, regiesRes, configRes] = await Promise.all([
        supabase.from("bouquets").select("puissance_kwc, prix_recommande, commission_fixe, regie_ids").eq("actif", true),
        regieIds.length > 0
          ? supabase.from("regies").select("id, part_survente_pct").in("id", regieIds)
          : Promise.resolve({ data: [] }),
        supabase.from("config_commissions").select("part_survente_pct").maybeSingle(),
      ]);

      const allBouquets = bouquetsRes.data || [];
      const regies = regiesRes.data || [];
      const globalSurventePct = configRes.data?.part_survente_pct || 50;
      
      // Separate global bouquets (regie_ids is null) from regie-specific ones
      const globalBouquets = allBouquets.filter((b: any) => !b.regie_ids || b.regie_ids.length === 0);
      
      // Create maps for quick lookup
      const regieConfigMap = new Map(regies.map((r: any) => [r.id, r]));
      const regieBouquetsMap = new Map<string, any[]>();
      allBouquets.forEach((b: any) => {
        if (b.regie_ids && b.regie_ids.length > 0) {
          b.regie_ids.forEach((regieId: string) => {
            const existing = regieBouquetsMap.get(regieId) || [];
            existing.push(b);
            regieBouquetsMap.set(regieId, existing);
          });
        }
      });

      // Helper to find or interpolate bouquet
      const findBouquet = (bouquets: any[], puissance: number) => {
        const exact = bouquets.find(b => b.puissance_kwc === puissance);
        if (exact) return { prixRecommande: exact.prix_recommande, commissionFixe: exact.commission_fixe || 0 };
        
        const sorted = [...bouquets].sort((a, b) => a.puissance_kwc - b.puissance_kwc);
        const lower = sorted.filter(b => b.puissance_kwc < puissance).pop();
        if (lower) {
          return { prixRecommande: lower.prix_recommande + (puissance - lower.puissance_kwc) * 1000, commissionFixe: lower.commission_fixe || 0 };
        }
        const upper = sorted.find(b => b.puissance_kwc > puissance);
        if (upper) {
          return { prixRecommande: upper.prix_recommande - (upper.puissance_kwc - puissance) * 1000, commissionFixe: upper.commission_fixe || 0 };
        }
        return { prixRecommande: puissance * 4500, commissionFixe: 0 };
      };

      // Calculate commissions
      const newCommissions = new Map<string, Commission>();
      
      eligibleVentes.forEach(vente => {
        if (!vente.puissance_kwc) return;
        
        const regieConfig = vente.regie_id ? regieConfigMap.get(vente.regie_id) : null;
        const bouquetsToUse = vente.regie_id && regieBouquetsMap.has(vente.regie_id)
          ? regieBouquetsMap.get(vente.regie_id)!
          : globalBouquets;
        const partSurventePct = regieConfig?.part_survente_pct ?? globalSurventePct;
        
        const bouquet = findBouquet(bouquetsToUse, vente.puissance_kwc);
        const commissionFixe = bouquet.commissionFixe;
        
        // Calculate survente
        let bonusSurvente = 0;
        const puissance = vente.puissance_kwc || 3;
        const tauxTVA = puissance <= 3 ? 10 : 20;
        const montantTTC = vente.montant_ttc || (vente.montant_ht * (1 + tauxTVA / 100));
        
        if (bouquet.prixRecommande > 0 && montantTTC > bouquet.prixRecommande) {
          const surventeTTC = montantTTC - bouquet.prixRecommande;
          const surventeHT = surventeTTC / (1 + tauxTVA / 100);
          bonusSurvente = surventeHT * (partSurventePct / 100);
        }
        
        const decomMontant = vente.decom_montant || 0;
        const montantCommission = Math.max(0, commissionFixe + bonusSurvente - decomMontant);

        newCommissions.set(vente.id, {
          vente_id: vente.id,
          montant_base: vente.montant_ht,
          commission_fixe: commissionFixe,
          bonus_survente: bonusSurvente,
          montant_commission: montantCommission,
        });
      });

      setCommissions(newCommissions);
    } catch (error) {
      console.error("Error loading commission data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const toggleVente = (venteId: string) => {
    setSelectedVentes(prev => 
      prev.includes(venteId) 
        ? prev.filter(id => id !== venteId)
        : [...prev, venteId]
    );
  };

  const selectAll = () => {
    setSelectedVentes(eligibleVentes.map(v => v.id));
  };

  const deselectAll = () => {
    setSelectedVentes([]);
  };

  // montant_commission = commissionFixe + bonusSurvente - decomMontant (déjà calculé)
  const totalCommissions = selectedVentes.reduce((sum, venteId) => {
    const c = commissions.get(venteId);
    return sum + (c?.montant_commission || 0);
  }, 0);

  const generatePDF = async () => {
    if (selectedVentes.length === 0) {
      toast.error("Sélectionnez au moins une vente");
      return;
    }

    setGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("FACTURE DE COMMISSIONS", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${format(new Date(), "dd MMMM yyyy", { locale: fr })}`, 14, 35);
      doc.text(`Nombre de ventes: ${selectedVentes.length}`, 14, 42);

      // Table data
      const tableData = selectedVentes.map(venteId => {
        const vente = eligibleVentes.find(v => v.id === venteId);
        const commission = commissions.get(venteId);
        
        if (!vente || !commission) return [];

        return [
          vente.client ? `${vente.client.prenom || ""} ${vente.client.nom}`.trim() : "-",
          vente.numero_contrat || "-",
          vente.date_signature ? format(new Date(vente.date_signature), "dd/MM/yy") : "-",
          formatCurrency(vente.montant_ht),
          formatCurrency(commission.commission_fixe),
          formatCurrency(commission.bonus_survente),
          formatCurrency(commission.montant_commission),
        ];
      }).filter(row => row.length > 0);

      autoTable(doc, {
        startY: 50,
        head: [["Client", "N° Contrat", "Date", "CA HT", "Com. Fixe", "Survente", "Net"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 30 },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right", fontStyle: "bold" },
        },
      });

      // Total
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`TOTAL COMMISSIONS: ${formatCurrency(totalCommissions)}`, pageWidth - 14, finalY, { align: "right" });

      // Footer
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text("Document généré automatiquement par DébalePro", pageWidth / 2, finalY + 20, { align: "center" });

      // Save
      doc.save(`facture_commissions_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      
      toast.success("Facture générée avec succès");
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur génération PDF:", error);
      toast.error("Erreur lors de la génération");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Facture de commissions
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Selection controls */}
            <div className="flex items-center justify-between py-2">
              <p className="text-sm text-muted-foreground">
                {eligibleVentes.length} vente(s) payée(s) disponible(s)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Tout
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  <Square className="h-4 w-4 mr-1" />
                  Aucun
                </Button>
              </div>
            </div>

            {/* Ventes list */}
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[40vh]">
              {eligibleVentes.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Euro className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Aucune vente payée disponible</p>
                  </CardContent>
                </Card>
              ) : (
                eligibleVentes.map(vente => {
                  const isSelected = selectedVentes.includes(vente.id);
                  const commission = commissions.get(vente.id);

                  return (
                    <Card 
                      key={vente.id}
                      className={`cursor-pointer transition-colors ${isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                      onClick={() => toggleVente(vente.id)}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <Checkbox checked={isSelected} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium truncate">
                              {vente.client?.prenom} {vente.client?.nom}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            {vente.numero_contrat && <span>{vente.numero_contrat}</span>}
                            {vente.date_signature && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(vente.date_signature), "dd/MM/yy")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(vente.montant_ht)}</p>
                          {isSelected && commission && (
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600">
                              +{formatCurrency(commission.montant_commission)}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            <Separator />

            {/* Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ventes sélectionnées</span>
                <span className="font-medium">{selectedVentes.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Total commissions</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(totalCommissions)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button 
                className="flex-1" 
                onClick={generatePDF}
                disabled={selectedVentes.length === 0 || generating}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Générer PDF
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
