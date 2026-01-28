import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { getTauxTVAByPuissance, ttcToHT } from "@/lib/tva";
import { 
  FileText, 
  Euro, 
  Loader2,
  Copy,
  CheckCircle,
  X,
  Receipt,
  CreditCard,
  Clock,
  ChevronDown,
  ChevronUp
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
  date_installation_reelle: string | null;
  commission: number;
  decom_montant: number;
}

interface Facture {
  id: string;
  numero_facture: string;
  date_emission: string;
  montant_total_ht: number;
  statut: "emise" | "payee";
  date_paiement: string | null;
  vente_ids: string[];
}

interface BillingSectionProps {
  onRefresh?: () => void;
}

export function BillingSection({ onRefresh }: BillingSectionProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ventes, setVentes] = useState<BillableVente[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [totalBillable, setTotalBillable] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [showPendingInvoices, setShowPendingInvoices] = useState(true);

  useEffect(() => {
    if (user) {
      fetchBillableVentes();
      fetchPendingFactures();
    }
  }, [user]);

  const fetchPendingFactures = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("factures")
        .select("*")
        .eq("user_id", user.id)
        .eq("statut", "emise")
        .order("date_emission", { ascending: false });

      if (error) throw error;
      setFactures((data || []) as Facture[]);
    } catch (error) {
      console.error("Error fetching factures:", error);
    }
  };

  const fetchBillableVentes = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // À facturer = installe OU attente_paiement avec date_installation >= 2 semaines
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      
      const { data: ventesData, error: ventesError } = await supabase
        .from("ventes")
        .select(`
          id,
          montant_ht,
          montant_ttc,
          puissance_kwc,
          date_installation_reelle,
          decom_montant,
          regie_id,
          etude_id,
          type_vente,
          status,
          clients (
            nom,
            prenom
          )
        `)
        .eq("user_id", user.id)
        .in("status", ["installe", "attente_paiement"])
        .order("date_installation_reelle", { ascending: true });

      if (ventesError) throw ventesError;

      // Filtrer: date_installation_reelle >= 2 semaines
      const billableData = (ventesData || []).filter((v: any) => {
        if (!v.date_installation_reelle) return false;
        return new Date(v.date_installation_reelle) <= twoWeeksAgo;
      });

      // Also fetch pending factures to exclude already invoiced ventes
      const { data: pendingFactures } = await supabase
        .from("factures")
        .select("vente_ids")
        .eq("user_id", user.id)
        .eq("statut", "emise");

      const invoicedVenteIds = new Set(
        (pendingFactures || []).flatMap((f: any) => f.vente_ids || [])
      );

      // Exclude already invoiced ventes
      const notInvoicedData = billableData.filter((v: any) => !invoicedVenteIds.has(v.id));

      if (notInvoicedData.length === 0) {
        setVentes([]);
        setTotalBillable(0);
        setLoading(false);
        return;
      }
      
      const filteredVentesData = notInvoicedData;

      // Fetch bouquets (global and per-regie), regie configs, and etude surcharges
      const regieIds = [...new Set(filteredVentesData.map((v: any) => v.regie_id).filter(Boolean))] as string[];
      const etudeIds = [...new Set(filteredVentesData.map((v: any) => v.etude_id).filter(Boolean))] as string[];
      
      const [bouquetsRes, regiesRes, configRes, etudesRes] = await Promise.all([
        supabase.from("bouquets").select("puissance_kwc, prix_recommande, commission_fixe, regie_ids").eq("actif", true),
        regieIds.length > 0
          ? supabase.from("regies").select("id, part_survente_pct").in("id", regieIds)
          : Promise.resolve({ data: [] }),
        supabase.from("config_commissions").select("part_survente_pct").maybeSingle(),
        etudeIds.length > 0
          ? supabase.from("etudes").select("id, surcout_support, surcout_compteur, autre_surcout").in("id", etudeIds)
          : Promise.resolve({ data: [] }),
      ]);

      const allBouquets = bouquetsRes.data || [];
      const regies = regiesRes.data || [];
      const globalSurventePct = configRes.data?.part_survente_pct || 50;
      
      const globalBouquets = allBouquets.filter((b: any) => !b.regie_ids || b.regie_ids.length === 0);
      
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
      
      const etudeSurcoutsMap = new Map((etudesRes.data || []).map((e: any) => [e.id, e]));

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

      const billableVentes: BillableVente[] = filteredVentesData.map((v: any) => {
        const decomMontant = v.decom_montant || 0;
        
        if (v.type_vente === "external_installation") {
          const commission = Math.max(0, v.montant_ht - decomMontant);
          return {
            id: v.id,
            client_nom: v.clients?.nom || "Client inconnu",
            client_prenom: v.clients?.prenom || null,
            puissance_kwc: v.puissance_kwc,
            montant_ht: v.montant_ht,
            montant_ttc: v.montant_ttc,
            date_installation_reelle: v.date_installation_reelle,
            commission,
            decom_montant: decomMontant,
          };
        }
        
        const regieConfig = v.regie_id ? regieConfigMap.get(v.regie_id) : null;
        const bouquetsToUse = v.regie_id && regieBouquetsMap.has(v.regie_id)
          ? regieBouquetsMap.get(v.regie_id)!
          : globalBouquets;
        const partSurventePct = regieConfig?.part_survente_pct ?? globalSurventePct;
        
        const bouquet = findBouquet(bouquetsToUse, v.puissance_kwc || 3);
        const baseCommission = bouquet.commissionFixe;
        
        let bonusSurvente = 0;
        const puissance = v.puissance_kwc || 3;
        const tauxTVA = getTauxTVAByPuissance(puissance);
        const montantTTC = v.montant_ttc || (v.montant_ht * (1 + tauxTVA / 100));
        
        const etudeSurcouts = v.etude_id ? etudeSurcoutsMap.get(v.etude_id) : null;
        const totalSurcoutsTTC = etudeSurcouts 
          ? (Number(etudeSurcouts.surcout_support) || 0) + 
            (Number(etudeSurcouts.surcout_compteur) || 0) + 
            (Number(etudeSurcouts.autre_surcout) || 0)
          : 0;
        
        const montantTTCSansSurcouts = montantTTC - totalSurcoutsTTC;
        
        if (bouquet.prixRecommande > 0 && montantTTCSansSurcouts > bouquet.prixRecommande) {
          const surventeTTC = montantTTCSansSurcouts - bouquet.prixRecommande;
          const surventeHT = ttcToHT(surventeTTC, tauxTVA);
          bonusSurvente = surventeHT * (partSurventePct / 100);
        }
        
        const commission = Math.max(0, baseCommission + bonusSurvente - decomMontant);

        return {
          id: v.id,
          client_nom: v.clients?.nom || "Client inconnu",
          client_prenom: v.clients?.prenom || null,
          puissance_kwc: v.puissance_kwc,
          montant_ht: v.montant_ht,
          montant_ttc: v.montant_ttc,
          date_installation_reelle: v.date_installation_reelle,
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

  // Generate unique invoice number
  const generateInvoiceNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `FAC-${year}${month}-${random}`;
  };

  // Create invoice
  const handleCreateInvoice = async () => {
    if (selectedVentes.length === 0 || !user) return;

    setCreating(true);
    try {
      const invoiceNumber = generateInvoiceNumber();
      const { error } = await supabase
        .from("factures")
        .insert({
          user_id: user.id,
          numero_facture: invoiceNumber,
          montant_total_ht: selectedTotal,
          vente_ids: selectedVentes.map(v => v.id),
          statut: "emise",
        });

      if (error) throw error;

      toast.success(`Facture ${invoiceNumber} créée`);
      clearSelection();
      fetchBillableVentes();
      fetchPendingFactures();
      onRefresh?.();
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast.error("Erreur lors de la création de la facture");
    } finally {
      setCreating(false);
    }
  };

  // Mark invoice as paid
  const handleMarkAsPaid = async (facture: Facture) => {
    if (!user) return;

    setMarkingPaid(facture.id);
    try {
      // 1. Update facture status
      const { error: factureError } = await supabase
        .from("factures")
        .update({
          statut: "payee",
          date_paiement: new Date().toISOString(),
        })
        .eq("id", facture.id);

      if (factureError) throw factureError;

      // 2. Update all ventes in this facture to "paye"
      const { error: ventesError } = await supabase
        .from("ventes")
        .update({ status: "paye" })
        .in("id", facture.vente_ids);

      if (ventesError) throw ventesError;

      toast.success(`Facture ${facture.numero_facture} marquée comme payée`);
      fetchBillableVentes();
      fetchPendingFactures();
      onRefresh?.();
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setMarkingPaid(null);
    }
  };

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

  const totalPendingInvoices = factures.reduce((sum, f) => sum + Number(f.montant_total_ht), 0);

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
      {/* Factures en attente de paiement */}
      {factures.length > 0 && (
        <Card className="shadow-card border-purple-200 bg-purple-50/50 mb-4">
          <CardHeader className="pb-2">
            <CardTitle 
              className="flex items-center justify-between text-base cursor-pointer"
              onClick={() => setShowPendingInvoices(!showPendingInvoices)}
            >
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-purple-600" />
                <span className="text-purple-800">Factures émises</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                  {formatCurrency(totalPendingInvoices)} €
                </Badge>
                {showPendingInvoices ? (
                  <ChevronUp className="h-4 w-4 text-purple-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-purple-600" />
                )}
              </div>
            </CardTitle>
          </CardHeader>
          {showPendingInvoices && (
            <CardContent className="space-y-2">
              {factures.map((facture) => (
                <div
                  key={facture.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white border border-purple-100"
                >
                  <div>
                    <p className="font-medium text-sm">{facture.numero_facture}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(facture.date_emission), "dd MMM yyyy", { locale: fr })}</span>
                      <span>•</span>
                      <span>{facture.vente_ids.length} vente{facture.vente_ids.length > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-purple-700">{formatCurrency(Number(facture.montant_total_ht))} €</p>
                    <Button
                      size="sm"
                      onClick={() => handleMarkAsPaid(facture)}
                      disabled={markingPaid === facture.id}
                      className="gap-1 bg-green-600 hover:bg-green-700"
                    >
                      {markingPaid === facture.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      Payée
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Ventes en attente de paiement */}
      <Card className="shadow-card border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              <span className="text-amber-800">En attente de paiement</span>
            </div>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              {ventes.length} dossier{ventes.length > 1 ? "s" : ""}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Total en attente de paiement */}
          <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white">
            <p className="text-sm opacity-90">Total en attente de paiement</p>
            <p className="text-3xl font-bold">{formatCurrency(totalBillable)} €</p>
            <p className="text-xs opacity-75 mt-1">Commissions HT nettes</p>
          </div>

          {/* Liste des dossiers avec sélection */}
          {ventes.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              Aucun dossier en attente de facturation
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
                        {vente.date_installation_reelle && (
                          <>
                            <span>•</span>
                            <span>
                              Posé le {format(new Date(vente.date_installation_reelle), "dd MMM", { locale: fr })}
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
                    size="sm"
                    onClick={handleCopySelected}
                    className="gap-1 bg-amber-800 hover:bg-amber-900"
                  >
                    {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copié" : "Copier"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreateInvoice}
                    disabled={creating}
                    className="gap-1 bg-green-600 hover:bg-green-700"
                  >
                    {creating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Receipt className="h-4 w-4" />
                    )}
                    Facturer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}