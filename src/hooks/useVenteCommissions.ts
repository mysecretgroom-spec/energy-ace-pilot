import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CommissionData {
  vente_id: string;
  montant_commission: number;
  bonus_survente: number;
  taux_commission: number;
  montant_base: number;
}

interface BouquetData {
  puissance_kwc: number;
  prix_hejja: number | null;
  prix_recommande: number;
}

interface CommissionTier {
  tranche_min: number;
  tranche_max: number;
  taux_commission: number;
}

interface Vente {
  id: string;
  montant_ht: number;
  puissance_kwc: number | null;
}

export const useVenteCommissions = (ventes: Vente[]) => {
  const [commissions, setCommissions] = useState<Map<string, CommissionData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [surventePct, setSurventePct] = useState(50);

  const calculateAllCommissions = useCallback(async () => {
    if (ventes.length === 0) return;

    setLoading(true);
    try {
      // Fetch all needed data in parallel
      const [tiersRes, bouquetsRes, configRes] = await Promise.all([
        supabase.from("data_commissions").select("*").order("tranche_min"),
        supabase.from("data_prix_bouquets").select("puissance_kwc, prix_hejja, prix_recommande").eq("actif", true),
        supabase.from("config_commissions").select("part_survente_pct").maybeSingle(),
      ]);

      const tiers: CommissionTier[] = tiersRes.data || [];
      const bouquets: BouquetData[] = bouquetsRes.data || [];
      const partSurventePct = configRes.data?.part_survente_pct || 50;
      setSurventePct(partSurventePct);

      const newCommissions = new Map<string, CommissionData>();

      ventes.forEach(vente => {
        if (!vente.puissance_kwc) {
          newCommissions.set(vente.id, {
            vente_id: vente.id,
            montant_commission: 0,
            bonus_survente: 0,
            taux_commission: 0,
            montant_base: vente.montant_ht,
          });
          return;
        }

        // Find matching bouquet for this puissance
        const bouquet = bouquets.find(b => b.puissance_kwc === vente.puissance_kwc);
        const prixHejja = bouquet?.prix_hejja || 0;
        const prixRecommande = bouquet?.prix_recommande || 0;

        // Find applicable commission tier based on montant_ht
        const tier = tiers.find(
          t => vente.montant_ht >= t.tranche_min && vente.montant_ht <= t.tranche_max
        ) || tiers[tiers.length - 1];

        const tauxCommission = tier?.taux_commission || 0;
        const baseCommission = vente.montant_ht * (tauxCommission / 100);

        // Calculate survente bonus (50% of HT difference between sale price and prix recommandé)
        let bonusSurvente = 0;
        if (prixRecommande > 0 && vente.montant_ht > prixRecommande) {
          const surventeBase = vente.montant_ht - prixRecommande;
          bonusSurvente = surventeBase * (partSurventePct / 100);
        }

        newCommissions.set(vente.id, {
          vente_id: vente.id,
          montant_commission: baseCommission,
          bonus_survente: bonusSurvente,
          taux_commission: tauxCommission,
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
        return total + comm.montant_commission + comm.bonus_survente;
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
