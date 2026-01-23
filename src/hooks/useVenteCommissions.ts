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

interface Vente {
  id: string;
  montant_ht: number;
  montant_ttc?: number;
  puissance_kwc: number | null;
  decom_montant?: number | null;
  type_vente?: 'standard' | 'external_installation';
  regie_id?: string | null;
}

export const useVenteCommissions = (ventes: Vente[]) => {
  const [commissions, setCommissions] = useState<Map<string, CommissionData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [surventePct, setSurventePct] = useState(50);

  const calculateAllCommissions = useCallback(async () => {
    if (ventes.length === 0) return;

    setLoading(true);
    try {
      // Get unique regie IDs from ventes
      const regieIds = [...new Set(ventes.map(v => v.regie_id).filter(Boolean))] as string[];

      // Fetch all needed data in parallel
      const [globalBouquetsRes, regieBouquetsRes, regiesRes, configRes] = await Promise.all([
        supabase.from("data_prix_bouquets").select("puissance_kwc, prix_recommande, prix_max, prix_hejja, commission_fixe").eq("actif", true),
        regieIds.length > 0 
          ? supabase.from("regies_bouquets").select("puissance_kwc, prix_recommande, prix_max, prix_hejja, commission_fixe, regie_id").eq("actif", true).in("regie_id", regieIds)
          : Promise.resolve({ data: [] }),
        regieIds.length > 0
          ? supabase.from("regies").select("id, mode_calcul_commission, part_survente_pct").in("id", regieIds)
          : Promise.resolve({ data: [] }),
        supabase.from("config_commissions").select("part_survente_pct").maybeSingle(),
      ]);

      const globalBouquets: BouquetData[] = globalBouquetsRes.data || [];
      const regieBouquets: BouquetData[] = regieBouquetsRes.data || [];
      const regies: RegieConfig[] = regiesRes.data || [];
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

      const newCommissions = new Map<string, CommissionData>();

      ventes.forEach(vente => {
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

        // Find or interpolate bouquet using the shared utility
        const interpolated = interpolateBouquet(bouquetsToUse, vente.puissance_kwc);
        const prixRecommande = interpolated.prixRecommande;
        const commissionFixe = interpolated.commissionFixe;
        const isInterpolated = interpolated.isInterpolated;

        // Base commission = forfait fixe du bouquet
        const baseCommission = commissionFixe;

        // Calculate survente bonus:
        // Survente = X% × (prix vendu TTC - prix recommandé TTC) converti en HT
        let bonusSurvente = 0;
        const puissance = vente.puissance_kwc || 3;
        const tauxTVA = getTauxTVAByPuissance(puissance);
        
        // Si on a le montant TTC, l'utiliser; sinon recalculer depuis HT
        const montantTTC = vente.montant_ttc || (vente.montant_ht * (1 + tauxTVA / 100));
        
        if (prixRecommande > 0 && montantTTC > prixRecommande) {
          // Survente en TTC
          const surventeTTC = montantTTC - prixRecommande;
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
