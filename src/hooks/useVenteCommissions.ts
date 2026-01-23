import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTauxTVAByPuissance, ttcToHT } from "@/lib/tva";
import { findOrInterpolateBouquet as interpolateBouquet } from "@/lib/bouquetInterpolation";

interface CommissionData {
  vente_id: string;
  montant_commission: number;
  bonus_survente: number;
  decom_montant: number;
  commission_nette: number;
  taux_commission: number;
  montant_base: number;
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

interface RegieConfig {
  id: string;
  mode_calcul_commission: string;
  part_survente_pct: number;
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
  type_vente?: 'standard' | 'external_installation';
  regie_id?: string | null;
  etude_id?: string | null;
  status?: string;
}

export const useVenteCommissions = (ventes: Vente[]) => {
  const [commissions, setCommissions] = useState<Map<string, CommissionData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [surventePct, setSurventePct] = useState(50);

  const calculateAllCommissions = useCallback(async () => {
    if (ventes.length === 0) return;

    setLoading(true);
    try {
      // Get unique regie IDs and etude IDs from ventes
      const regieIds = [...new Set(ventes.map(v => v.regie_id).filter(Boolean))] as string[];
      const etudeIds = [...new Set(ventes.map(v => v.etude_id).filter(Boolean))] as string[];

      // Fetch all needed data in parallel
      const [globalBouquetsRes, regieBouquetsRes, regiesRes, configRes, etudesRes] = await Promise.all([
        supabase.from("data_prix_bouquets").select("puissance_kwc, prix_recommande, prix_max, prix_hejja, commission_fixe").eq("actif", true),
        regieIds.length > 0 
          ? supabase.from("regies_bouquets").select("puissance_kwc, prix_recommande, prix_max, prix_hejja, commission_fixe, regie_id").eq("actif", true).in("regie_id", regieIds)
          : Promise.resolve({ data: [] }),
        regieIds.length > 0
          ? supabase.from("regies").select("id, mode_calcul_commission, part_survente_pct").in("id", regieIds)
          : Promise.resolve({ data: [] }),
        supabase.from("config_commissions").select("part_survente_pct").maybeSingle(),
        // Fetch surcharges from etudes
        etudeIds.length > 0
          ? supabase.from("etudes").select("id, surcout_support, surcout_compteur, autre_surcout").in("id", etudeIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Convert to proper types - Supabase returns decimals as strings sometimes
      const globalBouquets: BouquetData[] = (globalBouquetsRes.data || []).map(b => ({
        puissance_kwc: Number(b.puissance_kwc),
        prix_recommande: Number(b.prix_recommande),
        prix_max: b.prix_max ? Number(b.prix_max) : undefined,
        prix_hejja: b.prix_hejja ? Number(b.prix_hejja) : undefined,
        commission_fixe: b.commission_fixe ? Number(b.commission_fixe) : null,
      }));
      
      const regieBouquets: (BouquetData & { regie_id?: string })[] = (regieBouquetsRes.data || []).map(b => ({
        puissance_kwc: Number(b.puissance_kwc),
        prix_recommande: Number(b.prix_recommande),
        prix_max: b.prix_max ? Number(b.prix_max) : undefined,
        prix_hejja: b.prix_hejja ? Number(b.prix_hejja) : undefined,
        commission_fixe: b.commission_fixe ? Number(b.commission_fixe) : null,
        regie_id: b.regie_id,
      }));
      
      const regies: RegieConfig[] = regiesRes.data || [];
      const etudes: EtudeSurcouts[] = etudesRes.data || [];
      const globalSurventePct = configRes.data?.part_survente_pct || 50;
      setSurventePct(globalSurventePct);

      // Create maps for quick lookup
      const regieConfigMap = new Map(regies.map(r => [r.id, r]));
      const regieBouquetsMap = new Map<string, BouquetData[]>();
      regieBouquets.forEach(b => {
        if (b.regie_id) {
          const existing = regieBouquetsMap.get(b.regie_id) || [];
          existing.push(b);
          regieBouquetsMap.set(b.regie_id, existing);
        }
      });
      
      // Map etude surcharges by etude_id
      const etudeSurcoutsMap = new Map(etudes.map(e => [e.id, e]));

      const newCommissions = new Map<string, CommissionData>();

      ventes.forEach(vente => {
        // Skip cancelled sales - they don't generate commissions
        if (vente.status === 'annule') {
          newCommissions.set(vente.id, {
            vente_id: vente.id,
            montant_commission: 0,
            bonus_survente: 0,
            decom_montant: 0,
            commission_nette: 0,
            taux_commission: 0,
            montant_base: vente.montant_ht,
            isInterpolated: false,
          });
          return;
        }
        
        // Pour les installations externes: commission = montant HT complet (c'est un tarif fixe facturé)
        if (vente.type_vente === 'external_installation') {
          const decomMontant = vente.decom_montant || 0;
          newCommissions.set(vente.id, {
            vente_id: vente.id,
            montant_commission: vente.montant_ht,
            bonus_survente: 0,
            decom_montant: decomMontant,
            commission_nette: Math.max(0, vente.montant_ht - decomMontant),
            taux_commission: 100,
            montant_base: vente.montant_ht,
            isInterpolated: false,
          });
          return;
        }

        if (!vente.puissance_kwc) {
          newCommissions.set(vente.id, {
            vente_id: vente.id,
            montant_commission: 0,
            bonus_survente: 0,
            decom_montant: 0,
            commission_nette: 0,
            taux_commission: 0,
            montant_base: vente.montant_ht,
            isInterpolated: false,
          });
          return;
        }

        // Determine which bouquets and config to use
        const regieConfig = vente.regie_id ? regieConfigMap.get(vente.regie_id) : null;
        const bouquetsToUse = vente.regie_id && regieBouquetsMap.has(vente.regie_id)
          ? regieBouquetsMap.get(vente.regie_id)!
          : globalBouquets;
        const partSurventePct = regieConfig?.part_survente_pct ?? globalSurventePct;

        // Convert vente puissance to number for safe comparison
        const puissanceKwc = Number(vente.puissance_kwc);

        // Find or interpolate bouquet using the shared utility
        const interpolated = interpolateBouquet(bouquetsToUse, puissanceKwc);
        const prixRecommande = interpolated.prixRecommande;
        const commissionFixe = interpolated.commissionFixe;
        const isInterpolated = interpolated.isInterpolated;

        // Base commission = forfait fixe du bouquet
        const baseCommission = commissionFixe;

        // Get surcharges from etude (if linked)
        // These should NOT be counted as survente - they are technical costs
        const etudeSurcouts = vente.etude_id ? etudeSurcoutsMap.get(vente.etude_id) : null;
        const totalSurcouts = etudeSurcouts 
          ? (Number(etudeSurcouts.surcout_support) || 0) + 
            (Number(etudeSurcouts.surcout_compteur) || 0) + 
            (Number(etudeSurcouts.autre_surcout) || 0)
          : 0;

        // Calculate survente bonus:
        // Survente = X% × (prix vendu TTC - surcoûts TTC - prix recommandé TTC) converti en HT
        // The surcharges are technical costs and should NOT count as survente
        let bonusSurvente = 0;
        const puissance = puissanceKwc || 3;
        const tauxTVA = getTauxTVAByPuissance(puissance);
        
        // Si on a le montant TTC, l'utiliser; sinon recalculer depuis HT
        const montantTTC = vente.montant_ttc || (vente.montant_ht * (1 + tauxTVA / 100));
        
        // Subtract surcharges from sale price before comparing to recommended price
        const montantTTCSansSurcouts = montantTTC - totalSurcouts;
        
        if (prixRecommande > 0 && montantTTCSansSurcouts > prixRecommande) {
          // Survente en TTC (sans les surcoûts)
          const surventeTTC = montantTTCSansSurcouts - prixRecommande;
          // Convertir en HT
          const surventeHT = ttcToHT(surventeTTC, tauxTVA);
          // Appliquer le pourcentage de la régie ou global
          bonusSurvente = surventeHT * (partSurventePct / 100);
        }

        // Get decom from vente
        const decomMontant = vente.decom_montant || 0;
        const commissionBrute = baseCommission + bonusSurvente;
        const commissionNette = Math.max(0, commissionBrute - decomMontant);

        newCommissions.set(vente.id, {
          vente_id: vente.id,
          montant_commission: baseCommission,
          bonus_survente: bonusSurvente,
          decom_montant: decomMontant,
          commission_nette: commissionNette,
          taux_commission: 0,
          montant_base: vente.montant_ht,
          isInterpolated,
        });
      });

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
      if (comm) {
        return total + comm.commission_nette;
      }
      return total;
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
