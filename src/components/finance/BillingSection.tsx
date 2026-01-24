import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { getTauxTVAByPuissance, ttcToHT } from "@/lib/tva";
import { 
  FileText, 
  Euro, 
  ChevronRight, 
  Loader2,
  Copy,
  CheckCircle,
  X
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface BillableVente {
  id: string;
  client_nom: string;
  client_prenom: string | null;
  puissance_kwc: number | null;
  montant_ht: number;
  montant_ttc: number;
  date_installation: string | null;
  commission: number;
  decom_montant: number;
}

interface BillingSectionProps {
  onRefresh?: () => void;
}

export function BillingSection({ onRefresh }: BillingSectionProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ventes, setVentes] = useState<BillableVente[]>([]);
  const [totalBillable, setTotalBillable] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBillableVentes();
    }
  }, [user]);

  const fetchBillableVentes = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch ventes with status "attente_paiement"
      const { data: ventesData, error: ventesError } = await supabase
        .from("ventes")
        .select(`
          id,
          montant_ht,
          montant_ttc,
          puissance_kwc,
          date_installation,
          decom_montant,
          regie_id,
          clients (
            nom,
            prenom
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "attente_paiement")
        .order("date_installation", { ascending: true });

      if (ventesError) throw ventesError;

      // If no ventes in attente_paiement, just set empty and return
      if (!ventesData || ventesData.length === 0) {
        setVentes([]);
        setTotalBillable(0);
        setLoading(false);
        return;
      }

      // Fetch bouquets (global and per-regie) and regie configs
      const regieIds = [...new Set(ventesData.map((v: any) => v.regie_id).filter(Boolean))] as string[];
      
      const [globalBouquetsRes, regieBouquetsRes, regiesRes, configRes] = await Promise.all([
        supabase.from("data_prix_bouquets").select("puissance_kwc, prix_recommande, commission_fixe").eq("actif", true),
        regieIds.length > 0 
          ? supabase.from("regies_bouquets").select("puissance_kwc, prix_recommande, commission_fixe, regie_id").eq("actif", true).in("regie_id", regieIds)
          : Promise.resolve({ data: [] }),
        regieIds.length > 0
          ? supabase.from("regies").select("id, part_survente_pct").in("id", regieIds)
          : Promise.resolve({ data: [] }),
        supabase.from("config_commissions").select("part_survente_pct").maybeSingle(),
      ]);

      const globalBouquets = globalBouquetsRes.data || [];
      const regieBouquets = regieBouquetsRes.data || [];
      const regies = regiesRes.data || [];
      const globalSurventePct = configRes.data?.part_survente_pct || 50;
      
      // Create maps for quick lookup
      const regieConfigMap = new Map(regies.map((r: any) => [r.id, r]));
      const regieBouquetsMap = new Map<string, any[]>();
      regieBouquets.forEach((b: any) => {
        if (b.regie_id) {
          const existing = regieBouquetsMap.get(b.regie_id) || [];
          existing.push(b);
          regieBouquetsMap.set(b.regie_id, existing);
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

      // Calculate commissions using new bouquet logic
      const billableVentes: BillableVente[] = (ventesData || []).map((v: any) => {
        const regieConfig = v.regie_id ? regieConfigMap.get(v.regie_id) : null;
        const bouquetsToUse = v.regie_id && regieBouquetsMap.has(v.regie_id)
          ? regieBouquetsMap.get(v.regie_id)!
          : globalBouquets;
        const partSurventePct = regieConfig?.part_survente_pct ?? globalSurventePct;
        
        const bouquet = findBouquet(bouquetsToUse, v.puissance_kwc || 3);
        const baseCommission = bouquet.commissionFixe;
        
        // Calcul survente
        let bonusSurvente = 0;
        const puissance = v.puissance_kwc || 3;
        const tauxTVA = getTauxTVAByPuissance(puissance);
        const montantTTC = v.montant_ttc || (v.montant_ht * (1 + tauxTVA / 100));
        
        if (bouquet.prixRecommande > 0 && montantTTC > bouquet.prixRecommande) {
          const surventeTTC = montantTTC - bouquet.prixRecommande;
          const surventeHT = ttcToHT(surventeTTC, tauxTVA);
          bonusSurvente = surventeHT * (partSurventePct / 100);
        }
        
        const decomMontant = v.decom_montant || 0;
        const commission = Math.max(0, baseCommission + bonusSurvente - decomMontant);

        return {
          id: v.id,
          client_nom: v.clients?.nom || "Client inconnu",
          client_prenom: v.clients?.prenom || null,
          puissance_kwc: v.puissance_kwc,
          montant_ht: v.montant_ht,
          montant_ttc: v.montant_ttc,
          date_installation: v.date_installation,
          commission,
          decom_montant: decomMontant,
        };
      });

      setVentes(billableVentes);
      setTotalBillable(billableVentes.reduce((sum, v) => sum + v.commission, 0));
    } catch (error) {
      console.error("Error fetching billable ventes:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === ventes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ventes.map(v => v.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedVentes = ventes.filter(v => selectedIds.has(v.id));
  const selectedTotal = selectedVentes.reduce((sum, v) => sum + v.commission, 0);
  const selectedDecom = selectedVentes.reduce((sum, v) => sum + v.decom_montant, 0);

  const handleCopySelected = () => {
    if (selectedVentes.length === 0) return;

    const lines = selectedVentes.map(v => {
      const clientName = v.client_prenom 
        ? `${v.client_prenom} ${v.client_nom}`
        : v.client_nom;
      const decomNote = v.decom_montant > 0 ? ` (décom: -${formatCurrency(v.decom_montant)} €)` : "";
      return `${clientName}\t${v.puissance_kwc || "-"} kWc\t${formatCurrency(v.commission)} €${decomNote}`;
    });

    let fullText = `Lignes pour facture Qonto:\n\n${lines.join("\n")}\n\nTOTAL HT: ${formatCurrency(selectedTotal)} €`;
    if (selectedDecom > 0) {
      fullText += `\n(Dont décommissions: -${formatCurrency(selectedDecom)} €)`;
    }
    
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success("Lignes copiées dans le presse-papier");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-card border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              <span className="text-amber-800">Facturation</span>
            </div>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              {ventes.length} dossier{ventes.length > 1 ? "s" : ""}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Total à facturer */}
          <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white">
            <p className="text-sm opacity-90">Total à facturer</p>
            <p className="text-3xl font-bold">{formatCurrency(totalBillable)} €</p>
            <p className="text-xs opacity-75 mt-1">Commissions HT nettes</p>
          </div>

          {/* Liste des dossiers avec sélection */}
          {ventes.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              Aucun dossier en attente de paiement
            </p>
          ) : (
            <>
              {/* Select all / Deselect */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="text-xs text-amber-700"
                >
                  {selectedIds.size === ventes.length ? "Tout désélectionner" : "Tout sélectionner"}
                </Button>
                {selectedIds.size > 0 && (
                  <Badge variant="outline" className="bg-amber-100 text-amber-800">
                    {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {ventes.map((vente) => (
                  <div
                    key={vente.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      selectedIds.has(vente.id)
                        ? "bg-amber-100 border-amber-300"
                        : "bg-white border-amber-100 hover:bg-amber-50"
                    }`}
                  >
                    <Checkbox
                      checked={selectedIds.has(vente.id)}
                      onCheckedChange={() => toggleSelection(vente.id)}
                      className="border-amber-400 data-[state=checked]:bg-amber-600"
                    />
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(`/ventes/${vente.id}`)}
                    >
                      <p className="font-medium text-sm truncate">
                        {vente.client_prenom && `${vente.client_prenom} `}{vente.client_nom}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{vente.puissance_kwc || "-"} kWc</span>
                        {vente.date_installation && (
                          <>
                            <span>•</span>
                            <span>
                              Posé le {format(new Date(vente.date_installation), "dd MMM", { locale: fr })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-700">{formatCurrency(vente.commission)} €</p>
                      {vente.decom_montant > 0 && (
                        <p className="text-xs text-destructive">-{formatCurrency(vente.decom_montant)} € décom</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Selection bar fixed at bottom */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-50 px-4">
          <Card className="bg-amber-600 text-white shadow-xl border-0">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 min-h-[44px] min-w-[44px] text-white hover:bg-amber-700"
                    onClick={clearSelection}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                  <div>
                    <p className="text-sm font-medium">{selectedIds.size} dossier{selectedIds.size > 1 ? "s" : ""}</p>
                    <p className="text-lg font-bold">{formatCurrency(selectedTotal)} €</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setInvoiceDialogOpen(true)}
                    className="gap-1 bg-white text-amber-700 hover:bg-amber-50"
                  >
                    <FileText className="h-4 w-4" />
                    Voir
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCopySelected}
                    className="gap-1 bg-amber-800 hover:bg-amber-900"
                  >
                    {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copié !" : "Copier"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoice Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              Facture Commissions
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            {selectedIds.size} dossier{selectedIds.size > 1 ? "s" : ""} sélectionné{selectedIds.size > 1 ? "s" : ""} - Copiez ces lignes pour Qonto
          </p>

          {/* Table */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">kWc</TableHead>
                  <TableHead className="text-right">Décom</TableHead>
                  <TableHead className="text-right">Commission HT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedVentes.map((vente) => (
                  <TableRow key={vente.id}>
                    <TableCell className="font-medium">
                      {vente.client_prenom && `${vente.client_prenom} `}{vente.client_nom}
                    </TableCell>
                    <TableCell className="text-right">{vente.puissance_kwc || "-"}</TableCell>
                    <TableCell className="text-right text-destructive">
                      {vente.decom_montant > 0 ? `-${formatCurrency(vente.decom_montant)} €` : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-amber-700">
                      {formatCurrency(vente.commission)} €
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Separator />

          {/* Total */}
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="font-medium text-amber-800">TOTAL HT</span>
                {selectedDecom > 0 && (
                  <p className="text-xs text-muted-foreground">
                    (Dont décom: -{formatCurrency(selectedDecom)} €)
                  </p>
                )}
              </div>
              <span className="text-xl font-bold text-amber-700">
                {formatCurrency(selectedTotal)} €
              </span>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setInvoiceDialogOpen(false)}>
              Fermer
            </Button>
            <Button 
              className="flex-1 bg-amber-600 hover:bg-amber-700" 
              onClick={handleCopySelected}
            >
              {copied ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copied ? "Copié !" : "Copier tout"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
