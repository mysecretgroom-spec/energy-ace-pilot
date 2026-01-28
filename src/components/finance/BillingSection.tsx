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
  ChevronUp,
  MoreVertical,
  Pencil,
  Trash2,
  MinusCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [editingFacture, setEditingFacture] = useState<Facture | null>(null);
  const [factureVentes, setFactureVentes] = useState<BillableVente[]>([]);
  const [loadingFactureVentes, setLoadingFactureVentes] = useState(false);
  const [copiedFactureId, setCopiedFactureId] = useState<string | null>(null);
  const [addableVentes, setAddableVentes] = useState<BillableVente[]>([]);
  const [selectedAddIds, setSelectedAddIds] = useState<Set<string>>(new Set());
  const [addingToFacture, setAddingToFacture] = useState(false);
  const [deletingFacture, setDeletingFacture] = useState<Facture | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [removingVenteId, setRemovingVenteId] = useState<string | null>(null);

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
      
      // 1. Create the facture
      const { error: factureError } = await supabase
        .from("factures")
        .insert({
          user_id: user.id,
          numero_facture: invoiceNumber,
          montant_total_ht: selectedTotal,
          vente_ids: selectedVentes.map(v => v.id),
          statut: "emise",
        });

      if (factureError) throw factureError;

      // 2. Update ventes to "attente_paiement" status
      const { error: ventesError } = await supabase
        .from("ventes")
        .update({ status: "attente_paiement" })
        .in("id", selectedVentes.map(v => v.id));

      if (ventesError) throw ventesError;

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

  // Fetch ventes for a specific facture (for copy/edit)
  const fetchFactureVentes = async (facture: Facture): Promise<BillableVente[]> => {
    if (!user || facture.vente_ids.length === 0) return [];

    try {
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
          clients (nom, prenom)
        `)
        .in("id", facture.vente_ids);

      if (ventesError) throw ventesError;
      if (!ventesData || ventesData.length === 0) return [];

      // Fetch bouquets and regie configs for commission calculation
      const regieIds = [...new Set(ventesData.map((v: any) => v.regie_id).filter(Boolean))] as string[];
      const etudeIds = [...new Set(ventesData.map((v: any) => v.etude_id).filter(Boolean))] as string[];

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

      return ventesData.map((v: any) => {
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
          ? (Number(etudeSurcouts.surcout_support) || 0) + (Number(etudeSurcouts.surcout_compteur) || 0) + (Number(etudeSurcouts.autre_surcout) || 0)
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
    } catch (error) {
      console.error("Error fetching facture ventes:", error);
      return [];
    }
  };

  // Copy facture ventes for Qonto (one by one format)
  const handleCopyFactureForQonto = async (facture: Facture) => {
    const factureVentesData = await fetchFactureVentes(facture);
    
    if (factureVentesData.length === 0) {
      toast.error("Aucune vente trouvée pour cette facture");
      return;
    }

    const lines = factureVentesData.map(v => {
      const clientName = v.client_prenom 
        ? `${v.client_prenom} ${v.client_nom}`
        : v.client_nom;
      const puissanceStr = v.puissance_kwc ? `${v.puissance_kwc} kWc` : "";
      return `Commission Installation(s): ${puissanceStr} - ${clientName}\t${formatCurrency(v.commission)} €`;
    });

    const totalCommission = factureVentesData.reduce((sum, v) => sum + v.commission, 0);
    const fullText = lines.join("\n") + `\n\nTOTAL HT: ${formatCurrency(totalCommission)} €`;
    
    navigator.clipboard.writeText(fullText);
    setCopiedFactureId(facture.id);
    toast.success("Lignes copiées pour Qonto");
    setTimeout(() => setCopiedFactureId(null), 2000);
  };

  // Open edit dialog for facture
  const handleEditFacture = async (facture: Facture) => {
    setEditingFacture(facture);
    setLoadingFactureVentes(true);
    setSelectedAddIds(new Set());
    const ventesData = await fetchFactureVentes(facture);
    setFactureVentes(ventesData);
    // Calculate addable ventes (billable ventes not in this facture)
    const factureVenteIds = new Set(facture.vente_ids);
    setAddableVentes(ventes.filter(v => !factureVenteIds.has(v.id)));
    setLoadingFactureVentes(false);
  };

  // Toggle addable vente selection
  const toggleAddableSelection = (id: string) => {
    setSelectedAddIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Add selected ventes to the facture
  const handleAddVentesToFacture = async () => {
    if (!editingFacture || selectedAddIds.size === 0 || !user) return;

    setAddingToFacture(true);
    try {
      const newVenteIds = [...editingFacture.vente_ids, ...Array.from(selectedAddIds)];
      const addedVentes = addableVentes.filter(v => selectedAddIds.has(v.id));
      const addedCommission = addedVentes.reduce((sum, v) => sum + v.commission, 0);
      const newTotal = Number(editingFacture.montant_total_ht) + addedCommission;

      // Update facture
      const { error: factureError } = await supabase
        .from("factures")
        .update({
          vente_ids: newVenteIds,
          montant_total_ht: newTotal,
        })
        .eq("id", editingFacture.id);

      if (factureError) throw factureError;

      // Update ventes status to attente_paiement
      const { error: ventesError } = await supabase
        .from("ventes")
        .update({ status: "attente_paiement" })
        .in("id", Array.from(selectedAddIds));

      if (ventesError) throw ventesError;

      toast.success(`${selectedAddIds.size} vente(s) ajoutée(s) à la facture`);
      
      // Refresh data
      setEditingFacture(null);
      fetchBillableVentes();
      fetchPendingFactures();
      onRefresh?.();
    } catch (error) {
      console.error("Error adding ventes to facture:", error);
      toast.error("Erreur lors de l'ajout des ventes");
    } finally {
      setAddingToFacture(false);
    }
  };

  // Delete entire facture
  const handleDeleteFacture = async () => {
    if (!deletingFacture || !user) return;

    setIsDeleting(true);
    try {
      // 1. Revert ventes to "installe" status (make them billable again)
      const { error: ventesError } = await supabase
        .from("ventes")
        .update({ status: "installe" })
        .in("id", deletingFacture.vente_ids);

      if (ventesError) throw ventesError;

      // 2. Delete the facture
      const { error: factureError } = await supabase
        .from("factures")
        .delete()
        .eq("id", deletingFacture.id);

      if (factureError) throw factureError;

      toast.success(`Facture ${deletingFacture.numero_facture} supprimée`);
      setDeletingFacture(null);
      fetchBillableVentes();
      fetchPendingFactures();
      onRefresh?.();
    } catch (error) {
      console.error("Error deleting facture:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  // Remove a single vente from facture
  const handleRemoveVenteFromFacture = async (venteId: string) => {
    if (!editingFacture || !user) return;

    // Check if it's the last vente - if so, delete the entire facture
    if (editingFacture.vente_ids.length === 1) {
      setDeletingFacture(editingFacture);
      setEditingFacture(null);
      return;
    }

    setRemovingVenteId(venteId);
    try {
      const venteToRemove = factureVentes.find(v => v.id === venteId);
      const newVenteIds = editingFacture.vente_ids.filter(id => id !== venteId);
      const removedCommission = venteToRemove?.commission || 0;
      const newTotal = Math.max(0, Number(editingFacture.montant_total_ht) - removedCommission);

      // 1. Update facture
      const { error: factureError } = await supabase
        .from("factures")
        .update({
          vente_ids: newVenteIds,
          montant_total_ht: newTotal,
        })
        .eq("id", editingFacture.id);

      if (factureError) throw factureError;

      // 2. Revert vente status to "installe" (billable again)
      const { error: venteError } = await supabase
        .from("ventes")
        .update({ status: "installe" })
        .eq("id", venteId);

      if (venteError) throw venteError;

      toast.success("Vente retirée de la facture");

      // Update local state
      const updatedFacture = {
        ...editingFacture,
        vente_ids: newVenteIds,
        montant_total_ht: newTotal,
      };
      setEditingFacture(updatedFacture);
      setFactureVentes(prev => prev.filter(v => v.id !== venteId));
      
      // Add to addable ventes
      if (venteToRemove) {
        setAddableVentes(prev => [...prev, venteToRemove]);
      }

      // Refresh global data
      fetchBillableVentes();
      fetchPendingFactures();
      onRefresh?.();
    } catch (error) {
      console.error("Error removing vente from facture:", error);
      toast.error("Erreur lors du retrait de la vente");
    } finally {
      setRemovingVenteId(null);
    }
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
                  className="p-3 rounded-lg bg-white border border-purple-100 space-y-2"
                >
                  {/* Ligne 1: Numéro + Montant */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{facture.numero_facture}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{format(new Date(facture.date_emission), "dd MMM yyyy", { locale: fr })}</span>
                        <span>•</span>
                        <span>{facture.vente_ids.length} vente{facture.vente_ids.length > 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <p className="font-bold text-purple-700 whitespace-nowrap shrink-0">
                      {formatCurrency(Number(facture.montant_total_ht))} €
                    </p>
                  </div>
                  
                  {/* Ligne 2: Actions */}
                  <div className="flex items-center justify-end gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                          <MoreVertical className="h-4 w-4 text-purple-600" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-background z-50">
                        <DropdownMenuItem onClick={() => handleEditFacture(facture)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyFactureForQonto(facture)}>
                          {copiedFactureId === facture.id ? (
                            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4 mr-2" />
                          )}
                          {copiedFactureId === facture.id ? "Copié !" : "Copier pour Qonto"}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeletingFacture(facture)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <Button
                      size="sm"
                      onClick={() => handleMarkAsPaid(facture)}
                      disabled={markingPaid === facture.id}
                      className="gap-1.5 bg-green-600 hover:bg-green-700 h-9"
                    >
                      {markingPaid === facture.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      <span>Payée</span>
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

      {/* Edit Facture Dialog */}
      <Dialog open={!!editingFacture} onOpenChange={(open) => { if (!open) { setEditingFacture(null); setSelectedAddIds(new Set()); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Modifier {editingFacture?.numero_facture}
            </DialogTitle>
          </DialogHeader>
          
          {loadingFactureVentes ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto flex-1">
              {/* Current ventes in facture */}
              <p className="text-sm text-muted-foreground">
                Ventes incluses dans cette facture :
              </p>
              
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">kWc</TableHead>
                      <TableHead className="text-right">Commission HT</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {factureVentes.map((vente) => (
                      <TableRow 
                        key={vente.id}
                        className="hover:bg-muted/50"
                      >
                        <TableCell 
                          className="font-medium cursor-pointer"
                          onClick={() => {
                            setEditingFacture(null);
                            navigate(`/ventes/${vente.id}`);
                          }}
                        >
                          {vente.client_prenom && `${vente.client_prenom} `}{vente.client_nom}
                        </TableCell>
                        <TableCell className="text-right">{vente.puissance_kwc || "-"}</TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {formatCurrency(vente.commission)} €
                          {vente.decom_montant > 0 && (
                            <span className="text-xs text-destructive block">
                              -{formatCurrency(vente.decom_montant)} € décom
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveVenteFromFacture(vente.id)}
                            disabled={removingVenteId === vente.id}
                          >
                            {removingVenteId === vente.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MinusCircle className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <span className="font-medium">TOTAL HT</span>
                <span className="text-lg font-bold text-purple-700">
                  {formatCurrency(factureVentes.reduce((sum, v) => sum + v.commission, 0))} €
                </span>
              </div>
              
              <p className="text-xs text-muted-foreground">
                💡 Cliquez sur une vente pour la modifier (ajouter décom, etc.)
              </p>

              {/* Addable ventes section */}
              {addableVentes.length > 0 && (
                <>
                  <Separator />
                  
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-amber-800">
                      Ajouter des ventes "En attente de paiement" :
                    </p>
                    
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2 bg-amber-50/50">
                      {addableVentes.map((vente) => (
                        <div
                          key={vente.id}
                          className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                            selectedAddIds.has(vente.id)
                              ? "bg-amber-100 border-amber-300"
                              : "bg-white border-amber-100 hover:bg-amber-50"
                          }`}
                        >
                          <Checkbox
                            checked={selectedAddIds.has(vente.id)}
                            onCheckedChange={() => toggleAddableSelection(vente.id)}
                            className="border-amber-400 data-[state=checked]:bg-amber-600"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {vente.client_prenom && `${vente.client_prenom} `}{vente.client_nom}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {vente.puissance_kwc || "-"} kWc
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-amber-700 text-sm">{formatCurrency(vente.commission)} €</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedAddIds.size > 0 && (
                      <div className="flex items-center justify-between p-2 bg-amber-100 rounded-lg">
                        <span className="text-sm">
                          {selectedAddIds.size} vente(s) • +{formatCurrency(
                            addableVentes
                              .filter(v => selectedAddIds.has(v.id))
                              .reduce((sum, v) => sum + v.commission, 0)
                          )} €
                        </span>
                        <Button
                          size="sm"
                          onClick={handleAddVentesToFacture}
                          disabled={addingToFacture}
                          className="gap-1 bg-amber-600 hover:bg-amber-700"
                        >
                          {addingToFacture ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                          Ajouter
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setEditingFacture(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Facture Confirmation Dialog */}
      <AlertDialog open={!!deletingFacture} onOpenChange={(open) => { if (!open) setDeletingFacture(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              La facture {deletingFacture?.numero_facture} sera supprimée et les {deletingFacture?.vente_ids.length || 0} vente(s) associée(s) redeviendront facturables.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteFacture();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Suppression...
                </>
              ) : (
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}