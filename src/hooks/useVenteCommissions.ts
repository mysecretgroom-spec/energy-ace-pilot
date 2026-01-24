import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTauxTVAByPuissance, ttcToHT } from "@/lib/tva";
import { findOrInterpolateBouquet } from "@/lib/bouquetInterpolation";
import { 
  CommissionResult, 
  getTotalSurcouts, 
  createZeroCommission, 
  createExternalCommission 
} from "@/lib/commissionTypes";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HOOK DE CALCUL DES COMMISSIONS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Calcule les commissions pour une liste de ventes selon 2 modes simples :
 * 
 * 1. VENTE STANDARD : Commission Fixe (bouquet) + Bonus Survente - Décom
 * 2. POSE EXTERNE   : Montant HT - Décom
 * 3. ANNULÉE        : 0
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

      const [globalBouquetsRes, regieBouquetsRes, regiesRes, configRes, etudesRes] = await Promise.all([
        supabase.from("data_prix_bouquets").select("puissance_kwc, prix_recommande, commission_fixe").eq("actif", true),
        regieIds.length > 0
          ? supabase.from("regies_bouquets").select("puissance_kwc, prix_recommande, commission_fixe, regie_id").eq("actif", true).in("regie_id", regieIds)
          : Promise.resolve({ data: [] }),
        regieIds.length > 0
          ? supabase.from("regies").select("id, part_survente_pct").in("id", regieIds)
          : Promise.resolve({ data: [] }),
        supabase.from("config_commissions").select("part_survente_pct").maybeSingle(),
        etudeIds.length > 0
          ? supabase.from("etudes").select("id, surcout_support, surcout_compteur, autre_surcout").in("id", etudeIds)
          : Promise.resolve({ data: [] }),
      ]);

      // ─────────────────────────────────────────────────────────────────────
      // ÉTAPE 2: Préparer les lookups
      // ─────────────────────────────────────────────────────────────────────
      const globalBouquets: BouquetData[] = (globalBouquetsRes.data || []).map((b) => ({
        puissance_kwc: Number(b.puissance_kwc),
        prix_recommande: Number(b.prix_recommande),
        commission_fixe: b.commission_fixe ? Number(b.commission_fixe) : null,
      }));

      const regieBouquetsMap = new Map<string, BouquetData[]>();
      (regieBouquetsRes.data || []).forEach((b) => {
        const existing = regieBouquetsMap.get(b.regie_id) || [];
        existing.push({
          puissance_kwc: Number(b.puissance_kwc),
          prix_recommande: Number(b.prix_recommande),
          commission_fixe: b.commission_fixe ? Number(b.commission_fixe) : null,
          regie_id: b.regie_id,
        });
        regieBouquetsMap.set(b.regie_id, existing);
      });

      const regieConfigMap = new Map((regiesRes.data || []).map((r) => [r.id, r]));
      const etudeSurcoutsMap = new Map((etudesRes.data || []).map((e) => [e.id, e]));

      const globalSurventePct = configRes.data?.part_survente_pct || 50;
      setSurventePct(globalSurventePct);

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

        // CAS 2: Pose externe → Commission = montant HT - décom
        if (vente.type_vente === "external_installation") {
          results.set(vente.id, createExternalCommission(vente.id, vente.montant_ht, vente.decom_montant || 0));
          continue;
        }

        // CAS 3: Vente standard → Commission fixe + survente - décom
        if (!vente.puissance_kwc) {
          results.set(vente.id, createZeroCommission(vente.id, vente.montant_ht));
          continue;
        }

        const puissanceKwc = Number(vente.puissance_kwc);
        const decom = vente.decom_montant || 0;

        // Trouver le bouquet (régie ou global)
        const bouquets = (vente.regie_id && regieBouquetsMap.has(vente.regie_id))
          ? regieBouquetsMap.get(vente.regie_id)!
          : globalBouquets;

        const interpolated = findOrInterpolateBouquet(bouquets, puissanceKwc);
        const commissionBase = interpolated.commissionFixe;
        const prixRecommandeTTC = interpolated.prixRecommande;

        // Calculer le bonus survente
        const regieConfig = vente.regie_id ? regieConfigMap.get(vente.regie_id) : null;
        const partSurventePct = regieConfig?.part_survente_pct ?? globalSurventePct;

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

        const commissionNette = Math.max(0, commissionBase + bonusSurvente - decom);

        results.set(vente.id, {
          venteId: vente.id,
          type: "standard",
          commissionBase,
          bonusSurvente,
          decomMontant: decom,
          commissionNette,
          montantHT: vente.montant_ht,
          isInterpolated: interpolated.isInterpolated,
        });
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
