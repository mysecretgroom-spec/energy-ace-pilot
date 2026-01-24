import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTauxTVAByPuissance, ttcToHT } from "@/lib/tva";
import { findOrInterpolateBouquet } from "@/lib/bouquetInterpolation";

/**
 * Commission calculation result for a single sale
 */
export interface CommissionData {
  vente_id: string;
  /** Commission de base (forfait fixe du bouquet) */
  commission_base: number;
  /** Alias pour compatibilité - identique à commission_base */
  montant_commission: number;
  /** Bonus survente (X% de la marge au-dessus du prix recommandé) */
  bonus_survente: number;
  /** Frais décom déduits */
  decom_montant: number;
  /** Commission nette finale = base + survente - décom */
  commission_nette: number;
  /** Montant HT de la vente (pour référence) */
  montant_ht: number;
  /** Indique si le bouquet a été interpolé */
  isInterpolated: boolean;
}

interface BouquetData {
  puissance_kwc: number;
  prix_recommande: number;
  prix_max?: number;
  prix_hejja?: number;
  commission_fixe: number | null;
  regie_id?: string;
}

interface EtudeSurcouts {
  id: string;
  surcout_support: number | null;
  surcout_compteur: number | null;
  autre_surcout: number | null;
}

interface Vente {
  id: string;
  montant_ht: number;
  montant_ttc?: number;
  puissance_kwc: number | null;
  decom_montant?: number | null;
  type_vente?: "standard" | "external_installation";
  regie_id?: string | null;
  etude_id?: string | null;
  status?: string;
}

/**
 * Hook to calculate commissions for a list of sales
 * 
 * LOGIC SUMMARY:
 * 
 * 1. EXTERNAL INSTALLATION:
 *    - Commission = montant_ht (it's a fixed fee for installation work)
 *    - Net = montant_ht - decom
 * 
 * 2. STANDARD SALE:
 *    - Commission Base = bouquet.commission_fixe (fixed amount per power tier)
 *    - Survente = (Prix vendu TTC - Surcoûts TTC - Prix recommandé TTC) → converted to HT
 *    - Bonus Survente = Survente HT × (part_survente_pct / 100)
 *    - Net = Base + Bonus - Decom
 * 
 * 3. CANCELLED SALES: Commission = 0
 */
export const useVenteCommissions = (ventes: Vente[]) => {
  const [commissions, setCommissions] = useState<Map<string, CommissionData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [surventePct, setSurventePct] = useState(50);

  const calculateAllCommissions = useCallback(async () => {
    if (ventes.length === 0) return;

    setLoading(true);
    try {
      // Collect unique IDs for batch fetching
      const regieIds = [...new Set(ventes.map((v) => v.regie_id).filter(Boolean))] as string[];
      const etudeIds = [...new Set(ventes.map((v) => v.etude_id).filter(Boolean))] as string[];

      // Fetch all data in parallel
      const [globalBouquetsRes, regieBouquetsRes, regiesRes, configRes, etudesRes] = await Promise.all([
        supabase.from("data_prix_bouquets").select("puissance_kwc, prix_recommande, prix_max, prix_hejja, commission_fixe").eq("actif", true),
        regieIds.length > 0
          ? supabase.from("regies_bouquets").select("puissance_kwc, prix_recommande, prix_max, prix_hejja, commission_fixe, regie_id").eq("actif", true).in("regie_id", regieIds)
          : Promise.resolve({ data: [] }),
        regieIds.length > 0
          ? supabase.from("regies").select("id, part_survente_pct").in("id", regieIds)
          : Promise.resolve({ data: [] }),
        supabase.from("config_commissions").select("part_survente_pct").maybeSingle(),
        etudeIds.length > 0
          ? supabase.from("etudes").select("id, surcout_support, surcout_compteur, autre_surcout").in("id", etudeIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Parse bouquets with proper number conversion
      const globalBouquets: BouquetData[] = (globalBouquetsRes.data || []).map((b) => ({
        puissance_kwc: Number(b.puissance_kwc),
        prix_recommande: Number(b.prix_recommande),
        prix_max: b.prix_max ? Number(b.prix_max) : undefined,
        prix_hejja: b.prix_hejja ? Number(b.prix_hejja) : undefined,
        commission_fixe: b.commission_fixe ? Number(b.commission_fixe) : null,
      }));

      const regieBouquets: BouquetData[] = (regieBouquetsRes.data || []).map((b) => ({
        puissance_kwc: Number(b.puissance_kwc),
        prix_recommande: Number(b.prix_recommande),
        prix_max: b.prix_max ? Number(b.prix_max) : undefined,
        prix_hejja: b.prix_hejja ? Number(b.prix_hejja) : undefined,
        commission_fixe: b.commission_fixe ? Number(b.commission_fixe) : null,
        regie_id: b.regie_id,
      }));

      // Create lookup maps
      const regieConfigMap = new Map((regiesRes.data || []).map((r) => [r.id, r]));
      const regieBouquetsMap = new Map<string, BouquetData[]>();
      regieBouquets.forEach((b) => {
        if (b.regie_id) {
          const existing = regieBouquetsMap.get(b.regie_id) || [];
          existing.push(b);
          regieBouquetsMap.set(b.regie_id, existing);
        }
      });
      const etudeSurcoutsMap = new Map((etudesRes.data || []).map((e) => [e.id, e as EtudeSurcouts]));

      const globalSurventePct = configRes.data?.part_survente_pct || 50;
      setSurventePct(globalSurventePct);

      const newCommissions = new Map<string, CommissionData>();

      for (const vente of ventes) {
        // ═══════════════════════════════════════════════════════════════
        // CASE 1: CANCELLED SALE → No commission
        // ═══════════════════════════════════════════════════════════════
        if (vente.status === "annule") {
          newCommissions.set(vente.id, createZeroCommission(vente));
          continue;
        }

        // ═══════════════════════════════════════════════════════════════
        // CASE 2: EXTERNAL INSTALLATION → Commission = full HT amount
        // ═══════════════════════════════════════════════════════════════
        if (vente.type_vente === "external_installation") {
          const decom = vente.decom_montant || 0;
          newCommissions.set(vente.id, {
            vente_id: vente.id,
            commission_base: vente.montant_ht,
            montant_commission: vente.montant_ht,
            bonus_survente: 0,
            decom_montant: decom,
            commission_nette: Math.max(0, vente.montant_ht - decom),
            montant_ht: vente.montant_ht,
            isInterpolated: false,
          });
          continue;
        }

        // ═══════════════════════════════════════════════════════════════
        // CASE 3: STANDARD SALE → Bouquet commission + survente bonus
        // ═══════════════════════════════════════════════════════════════
        if (!vente.puissance_kwc) {
          newCommissions.set(vente.id, createZeroCommission(vente));
          continue;
        }

        const puissanceKwc = Number(vente.puissance_kwc);

        // Get bouquets (régie-specific or global)
        const bouquetsToUse = vente.regie_id && regieBouquetsMap.has(vente.regie_id)
          ? regieBouquetsMap.get(vente.regie_id)!
          : globalBouquets;

        // Find or interpolate the bouquet
        const interpolated = findOrInterpolateBouquet(bouquetsToUse, puissanceKwc);
        const commissionBase = interpolated.commissionFixe;
        const prixRecommandeTTC = interpolated.prixRecommande;

        // Get survente percentage (régie-specific or global)
        const regieConfig = vente.regie_id ? regieConfigMap.get(vente.regie_id) : null;
        const partSurventePct = regieConfig?.part_survente_pct ?? globalSurventePct;

        // Get technical surcharges from etude (these are NOT survente)
        const etudeSurcouts = vente.etude_id ? etudeSurcoutsMap.get(vente.etude_id) : null;
        const totalSurcoutsTTC = etudeSurcouts
          ? (Number(etudeSurcouts.surcout_support) || 0) +
            (Number(etudeSurcouts.surcout_compteur) || 0) +
            (Number(etudeSurcouts.autre_surcout) || 0)
          : 0;

        // Calculate survente bonus
        const tauxTVA = getTauxTVAByPuissance(puissanceKwc);
        const montantTTC = vente.montant_ttc || vente.montant_ht * (1 + tauxTVA / 100);
        const montantTTCSansSurcouts = montantTTC - totalSurcoutsTTC;

        let bonusSurvente = 0;
        if (prixRecommandeTTC > 0 && montantTTCSansSurcouts > prixRecommandeTTC) {
          const surventeTTC = montantTTCSansSurcouts - prixRecommandeTTC;
          const surventeHT = ttcToHT(surventeTTC, tauxTVA);
          bonusSurvente = surventeHT * (partSurventePct / 100);
        }

        // Calculate net commission
        const decom = vente.decom_montant || 0;
        const commissionNette = Math.max(0, commissionBase + bonusSurvente - decom);

        newCommissions.set(vente.id, {
          vente_id: vente.id,
          commission_base: commissionBase,
          montant_commission: commissionBase,
          bonus_survente: bonusSurvente,
          decom_montant: decom,
          commission_nette: commissionNette,
          montant_ht: vente.montant_ht,
          isInterpolated: interpolated.isInterpolated,
        });
      }

      setCommissions(newCommissions);
    } catch (error) {
      console.error("Erreur calcul commissions:", error);
    } finally {
      setLoading(false);
    }
  }, [ventes]);

  useEffect(() => {
    calculateAllCommissions();
  }, [calculateAllCommissions]);

  const getCommission = (venteId: string) => commissions.get(venteId) || null;

  const getTotalCommission = (venteIds: string[]) => {
    return venteIds.reduce((total, id) => {
      const comm = commissions.get(id);
      return comm ? total + comm.commission_nette : total;
    }, 0);
  };

  return {
    commissions,
    loading,
    surventePct,
    getCommission,
    getTotalCommission,
    refresh: calculateAllCommissions,
  };
};

/**
 * Create a zero-commission entry (for cancelled sales or missing data)
 */
function createZeroCommission(vente: Vente): CommissionData {
  return {
    vente_id: vente.id,
    commission_base: 0,
    montant_commission: 0,
    bonus_survente: 0,
    decom_montant: 0,
    commission_nette: 0,
    montant_ht: vente.montant_ht,
    isInterpolated: false,
  };
}
