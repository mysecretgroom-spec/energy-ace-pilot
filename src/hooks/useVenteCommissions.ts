import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTauxTVAByPuissance, ttcToHT } from "@/lib/tva";
import { findOrInterpolateBouquet } from "@/lib/bouquetInterpolation";
import { 
  CommissionResult, 
  CommissionTier,
  CommissionMode,
  getTotalSurcouts, 
  createZeroCommission, 
  createExternalCommission 
} from "@/lib/commissionTypes";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HOOK DE CALCUL DES COMMISSIONS - 2 MODES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Mode déterminé par régie.mode_calcul_commission :
 * 
 * 1. BOUQUET    : Commission Fixe + Survente - Décom
 * 2. POURCENTAGE: % du CA (selon tranches) - Décom
 * 3. EXTERNE    : Montant HT - Décom
 * 4. ANNULÉE    : 0
 * 
 * @see src/lib/commissionTypes.ts pour la documentation détaillée
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface BouquetData {
  puissance_kwc: number;
  prix_recommande: number;
  commission_fixe: number | null;
  regie_id?: string;
  product_type?: string | null;
  gamme?: string | null;
}

interface VenteInput {
  id: string;
  montant_ht: number;
  montant_ttc?: number;
  puissance_kwc: number | null;
  decom_montant?: number | null;
  type_vente?: "standard" | "external_installation";
  regie_id?: string | null;
  etude_id?: string | null;
  status?: string;
  product_type?: "PV" | "PAC" | "ITE" | null;
  gamme?: string | null;
  commission_override?: number | null;
}

interface RegieConfig {
  id: string;
  mode_calcul_commission: CommissionMode | null;
  part_survente_pct: number | null;
  cout_panneau_supplementaire: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export const useVenteCommissions = (ventes: VenteInput[]) => {
  const [commissions, setCommissions] = useState<Map<string, CommissionResult>>(new Map());
  const [loading, setLoading] = useState(false);
  const [surventePct, setSurventePct] = useState(50);

  const calculateAllCommissions = useCallback(async () => {
    if (ventes.length === 0) return;

    setLoading(true);
    try {
      // ─────────────────────────────────────────────────────────────────────
      // ÉTAPE 1: Récupérer toutes les données nécessaires en parallèle
      // ─────────────────────────────────────────────────────────────────────
      const regieIds = [...new Set(ventes.map((v) => v.regie_id).filter(Boolean))] as string[];
      const etudeIds = [...new Set(ventes.map((v) => v.etude_id).filter(Boolean))] as string[];

      // Collect unique product types for filtering bouquets
      const productTypes = [...new Set(ventes.map(v => v.product_type).filter(Boolean))] as string[];

      const [bouquetsRes, regiesRes, configRes, etudesRes, tiersRes] = await Promise.all([
        supabase.from("bouquets").select("puissance_kwc, prix_recommande, commission_fixe, regie_ids, product_type, gamme").eq("actif", true),
        regieIds.length > 0
          ? supabase.from("regies").select("id, mode_calcul_commission, part_survente_pct, cout_panneau_supplementaire").in("id", regieIds)
          : Promise.resolve({ data: [] }),
        supabase.from("config_commissions").select("mode_calcul, part_survente_pct").maybeSingle(),
        etudeIds.length > 0
          ? supabase.from("etudes").select("id, surcout_support, surcout_compteur, autre_surcout, prime_autoconsommation").in("id", etudeIds)
          : Promise.resolve({ data: [] }),
        // Tranches pour le mode pourcentage
        supabase.from("data_commissions").select("tranche_min, tranche_max, taux_commission, bonus_survente, product_type").order("tranche_min", { ascending: true }),
      ]);

      // ─────────────────────────────────────────────────────────────────────
      // ÉTAPE 2: Préparer les lookups
      // ─────────────────────────────────────────────────────────────────────
      const allBouquets = bouquetsRes.data || [];
      
      // Helper to filter bouquets by product_type
      const filterByProductType = (bouquets: any[], productType: string | null | undefined) => {
        if (!productType) return bouquets; // No product_type on vente, don't filter
        const filtered = bouquets.filter((b: any) => b.product_type === productType);
        return filtered.length > 0 ? filtered : bouquets; // Fallback to all if no match
      };
      
      // Global bouquets (regie_ids is null or empty), indexed by product_type
      const globalBouquetsAll: BouquetData[] = allBouquets
        .filter((b: any) => !b.regie_ids || b.regie_ids.length === 0)
        .map((b: any) => ({
          puissance_kwc: Number(b.puissance_kwc),
          prix_recommande: Number(b.prix_recommande),
          commission_fixe: b.commission_fixe ? Number(b.commission_fixe) : null,
          product_type: b.product_type,
          gamme: b.gamme ?? null,
        }));

      const regieBouquetsMapAll = new Map<string, BouquetData[]>();
      allBouquets.forEach((b: any) => {
        if (b.regie_ids && b.regie_ids.length > 0) {
          b.regie_ids.forEach((regieId: string) => {
            const existing = regieBouquetsMapAll.get(regieId) || [];
            existing.push({
              puissance_kwc: Number(b.puissance_kwc),
              prix_recommande: Number(b.prix_recommande),
              commission_fixe: b.commission_fixe ? Number(b.commission_fixe) : null,
              regie_id: regieId,
              product_type: b.product_type,
              gamme: b.gamme ?? null,
            });
            regieBouquetsMapAll.set(regieId, existing);
          });
        }
      });

      const regieConfigMap = new Map<string, RegieConfig>(
        (regiesRes.data || []).map((r) => [r.id, r as RegieConfig])
      );
      const etudeSurcoutsMap = new Map((etudesRes.data || []).map((e) => [e.id, e]));

      // Tranches de commission (mode pourcentage) - all, will be filtered per vente
      const allCommissionTiers = (tiersRes.data || []).map((t: any) => ({
        trancheMin: Number(t.tranche_min),
        trancheMax: Number(t.tranche_max),
        tauxCommission: Number(t.taux_commission),
        bonusSurvente: Number(t.bonus_survente || 0),
        productType: t.product_type as string | null,
      }));

      const globalConfig = {
        mode: (configRes.data?.mode_calcul || "bouquet") as CommissionMode,
        surventePct: configRes.data?.part_survente_pct || 50,
      };
      setSurventePct(globalConfig.surventePct);

      // ─────────────────────────────────────────────────────────────────────
      // ÉTAPE 3: Calculer chaque commission
      // ─────────────────────────────────────────────────────────────────────
      const results = new Map<string, CommissionResult>();

      for (const vente of ventes) {
        // CAS 1: Vente annulée → Commission = 0
        if (vente.status === "annule") {
          results.set(vente.id, createZeroCommission(vente.id, vente.montant_ht));
          continue;
        }

        // CAS 1b: Commission figée (override) → utiliser directement
        if (vente.commission_override != null) {
          const decom = vente.decom_montant || 0;
          const commissionNette = Math.round(Math.max(0, vente.commission_override - decom) / 100) * 100;
          results.set(vente.id, {
            venteId: vente.id,
            type: "standard",
            mode: "bouquet",
            commissionBase: vente.commission_override,
            bonusSurvente: 0,
            decomMontant: decom,
            commissionNette,
            montantHT: vente.montant_ht,
            isInterpolated: false,
          });
          continue;
        }

        // CAS 2: Pose externe → Commission = montant HT - décom
        if (vente.type_vente === "external_installation") {
          results.set(vente.id, createExternalCommission(vente.id, vente.montant_ht, vente.decom_montant || 0));
          continue;
        }

        // CAS 3: Vente standard → Selon le mode de la régie
        const decom = vente.decom_montant || 0;
        const regieConfig = vente.regie_id ? regieConfigMap.get(vente.regie_id) : null;
        const mode: CommissionMode = regieConfig?.mode_calcul_commission || globalConfig.mode;

        if (mode === "pourcentage") {
          // ═══════════════════════════════════════════════════════════════
          // MODE POURCENTAGE: % du CA selon tranches
          // ═══════════════════════════════════════════════════════════════
          // Filter tiers by product_type
          const commissionTiers: CommissionTier[] = allCommissionTiers
            .filter(t => !vente.product_type || !t.productType || t.productType === vente.product_type)
            .map(t => ({ trancheMin: t.trancheMin, trancheMax: t.trancheMax, tauxCommission: t.tauxCommission, bonusSurvente: t.bonusSurvente }));
          const result = calculatePourcentageCommission(vente, commissionTiers, decom);
          results.set(vente.id, result);
        } else {
          // ═══════════════════════════════════════════════════════════════
          // MODE BOUQUET: Commission fixe + survente
          // ═══════════════════════════════════════════════════════════════
          if (!vente.puissance_kwc) {
            results.set(vente.id, createZeroCommission(vente.id, vente.montant_ht));
            continue;
          }

          const puissanceKwc = Number(vente.puissance_kwc);
          
          // Filter bouquets by product_type then by régie
          const regieBouquetsRaw = (vente.regie_id && regieBouquetsMapAll.has(vente.regie_id))
            ? regieBouquetsMapAll.get(vente.regie_id)!
            : globalBouquetsAll;
          
          // Apply product_type filter
          const bouquetsByProduct = vente.product_type
            ? (regieBouquetsRaw.filter(b => b.product_type === vente.product_type).length > 0
              ? regieBouquetsRaw.filter(b => b.product_type === vente.product_type)
              : regieBouquetsRaw)
            : regieBouquetsRaw;

          // Filtre par gamme : deux gammes peuvent avoir la même puissance à des
          // prix / commissions différents. Sans gamme renseignée, on garde tout.
          const venteGamme = (vente.gamme || "").trim();
          const bouquetsByGamme = venteGamme
            ? bouquetsByProduct.filter(b => (b.gamme || "").trim() === venteGamme)
            : [];
          const bouquets = bouquetsByGamme.length > 0 ? bouquetsByGamme : bouquetsByProduct;

          const coutPanneau = regieConfig?.cout_panneau_supplementaire ?? 500;
          const interpolated = findOrInterpolateBouquet(bouquets, puissanceKwc, coutPanneau);
          const commissionBase = interpolated.commissionFixe;
          const prixRecommandeTTC = interpolated.prixRecommande;

          // Calculer le bonus survente
          const partSurventePct = regieConfig?.part_survente_pct ?? globalConfig.surventePct;
          const etudeSurcouts = vente.etude_id ? etudeSurcoutsMap.get(vente.etude_id) : null;
          const totalSurcoutsTTC = getTotalSurcouts(etudeSurcouts ? {
            surcoutSupport: Number(etudeSurcouts.surcout_support) || 0,
            surcoutCompteur: Number(etudeSurcouts.surcout_compteur) || 0,
            autreSurcout: Number(etudeSurcouts.autre_surcout) || 0,
          } : null);

          const tauxTVA = getTauxTVAByPuissance(puissanceKwc);
          const montantTTC = vente.montant_ttc || vente.montant_ht * (1 + tauxTVA / 100);
          const montantTTCSansSurcouts = montantTTC - totalSurcoutsTTC;

          let bonusSurvente = 0;
          if (prixRecommandeTTC > 0 && montantTTCSansSurcouts > prixRecommandeTTC) {
            const surventeTTC = montantTTCSansSurcouts - prixRecommandeTTC;
            const surventeHT = ttcToHT(surventeTTC, tauxTVA);
           bonusSurvente = surventeHT * (partSurventePct / 100);
          }

          // Arrondir la commission finale à la centaine d'euros
          const commissionNette = Math.round(Math.max(0, commissionBase + bonusSurvente - decom) / 100) * 100;

          results.set(vente.id, {
            venteId: vente.id,
            type: "standard",
            mode: "bouquet",
            commissionBase,
            bonusSurvente,
            decomMontant: decom,
            commissionNette,
            montantHT: vente.montant_ht,
            isInterpolated: interpolated.isInterpolated,
          });
        }
      }

      setCommissions(results);
    } catch (error) {
      console.error("Erreur calcul commissions:", error);
    } finally {
      setLoading(false);
    }
  }, [ventes]);

  useEffect(() => {
    calculateAllCommissions();
  }, [calculateAllCommissions]);

  // ─────────────────────────────────────────────────────────────────────────
  // API PUBLIQUE
  // ─────────────────────────────────────────────────────────────────────────

  const getCommission = (venteId: string): CommissionResult | null => {
    return commissions.get(venteId) || null;
  };

  const getTotalCommission = (venteIds: string[]): number => {
    return venteIds.reduce((total, id) => {
      const comm = commissions.get(id);
      return comm ? total + comm.commissionNette : total;
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

// ═══════════════════════════════════════════════════════════════════════════
// CALCUL MODE POURCENTAGE
// ═══════════════════════════════════════════════════════════════════════════

function calculatePourcentageCommission(
  vente: VenteInput,
  tiers: CommissionTier[],
  decom: number
): CommissionResult {
  const montantHT = vente.montant_ht;

  if (tiers.length === 0) {
    // Fallback: 5% si pas de tranches
    const commission = montantHT * 0.05;
    return {
      venteId: vente.id,
      type: "standard",
      mode: "pourcentage",
      commissionBase: commission,
      bonusSurvente: 0,
      decomMontant: decom,
      commissionNette: Math.max(0, commission - decom),
      montantHT,
      tauxApplique: 5,
      isInterpolated: false,
    };
  }

  // Trouver la tranche applicable
  const tier = tiers.find(t => montantHT >= t.trancheMin && montantHT <= t.trancheMax);
  const applicableTier = tier || tiers[tiers.length - 1]; // Dernière tranche si au-delà

  const taux = applicableTier.tauxCommission / 100;
  const commissionBase = montantHT * taux;
  const bonusSurvente = montantHT * (applicableTier.bonusSurvente / 100);
  const commissionNette = Math.round(Math.max(0, commissionBase + bonusSurvente - decom) / 100) * 100;

  return {
    venteId: vente.id,
    type: "standard",
    mode: "pourcentage",
    commissionBase,
    bonusSurvente,
    decomMontant: decom,
    commissionNette,
    montantHT,
    tauxApplique: applicableTier.tauxCommission,
    isInterpolated: false,
  };
}
