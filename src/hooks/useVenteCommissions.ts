import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTauxTVAByPuissance, ttcToHT } from "@/lib/tva";

interface CommissionData {
  vente_id: string;
  montant_commission: number;
  bonus_survente: number;
  decom_montant: number;
  commission_nette: number;
  taux_commission: number;
  montant_base: number;
}

interface BouquetData {
  puissance_kwc: number;
  prix_recommande: number;     // TTC
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

// Helper function to find or interpolate bouquet
const findOrInterpolateBouquet = (
  bouquets: BouquetData[],
  targetPuissance: number
): { prixRecommande: number; commissionFixe: number } => {
  // First try exact match
  const exactMatch = bouquets.find(b => b.puissance_kwc === targetPuissance);
  if (exactMatch) {
    return {
      prixRecommande: exactMatch.prix_recommande,
      commissionFixe: exactMatch.commission_fixe || 0,
    };
  }

  const sortedBouquets = [...bouquets].sort((a, b) => a.puissance_kwc - b.puissance_kwc);

  // Special case for 3.5 kWc: use 4kWc and subtract 500€
  if (targetPuissance === 3.5) {
    const bouquet4kwc = sortedBouquets.find(b => b.puissance_kwc === 4);
    if (bouquet4kwc) {
      return {
        prixRecommande: bouquet4kwc.prix_recommande - 500,
        commissionFixe: bouquet4kwc.commission_fixe || 0,
      };
    }
  }

  // Find the nearest lower bouquet and add 1000€ per kWc difference
  const lowerBouquet = sortedBouquets.filter(b => b.puissance_kwc < targetPuissance).pop();
  const upperBouquet = sortedBouquets.find(b => b.puissance_kwc > targetPuissance);

  if (lowerBouquet) {
    const diffKwc = targetPuissance - lowerBouquet.puissance_kwc;
    return {
      prixRecommande: lowerBouquet.prix_recommande + (diffKwc * 1000),
      commissionFixe: lowerBouquet.commission_fixe || 0,
    };
  } else if (upperBouquet) {
    // If no lower bouquet exists, use upper and subtract
    const diffKwc = upperBouquet.puissance_kwc - targetPuissance;
    return {
      prixRecommande: upperBouquet.prix_recommande - (diffKwc * 1000),
      commissionFixe: upperBouquet.commission_fixe || 0,
    };
  }

  return { prixRecommande: 0, commissionFixe: 0 };
};

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
        supabase.from("data_prix_bouquets").select("puissance_kwc, prix_recommande, commission_fixe").eq("actif", true),
        regieIds.length > 0 
          ? supabase.from("regies_bouquets").select("puissance_kwc, prix_recommande, commission_fixe, regie_id").eq("actif", true).in("regie_id", regieIds)
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
            taux_commission: 100, // 100% car c'est un forfait
            montant_base: vente.montant_ht,
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
          });
          return;
        }

        // Determine which bouquets and config to use
        const regieConfig = vente.regie_id ? regieConfigMap.get(vente.regie_id) : null;
        const bouquetsToUse = vente.regie_id && regieBouquetsMap.has(vente.regie_id)
          ? regieBouquetsMap.get(vente.regie_id)!
          : globalBouquets;
        const partSurventePct = regieConfig?.part_survente_pct ?? globalSurventePct;

        // Find or interpolate bouquet
        const { prixRecommande, commissionFixe } = findOrInterpolateBouquet(bouquetsToUse, vente.puissance_kwc);

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
          taux_commission: 0, // Non utilisé avec commission fixe
          montant_base: vente.montant_ht,
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
