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
}

interface Vente {
  id: string;
  montant_ht: number;
  montant_ttc?: number;
  puissance_kwc: number | null;
  decom_montant?: number | null;
  type_vente?: 'standard' | 'external_installation';
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
      const [bouquetsRes, configRes] = await Promise.all([
        supabase.from("data_prix_bouquets").select("puissance_kwc, prix_recommande, commission_fixe").eq("actif", true),
        supabase.from("config_commissions").select("part_survente_pct").maybeSingle(),
      ]);

      const bouquets: BouquetData[] = bouquetsRes.data || [];
      const partSurventePct = configRes.data?.part_survente_pct || 50;
      setSurventePct(partSurventePct);

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

        // Find matching bouquet for this puissance
        const bouquet = bouquets.find(b => b.puissance_kwc === vente.puissance_kwc);
        const prixRecommande = bouquet?.prix_recommande || 0;
        const commissionFixe = bouquet?.commission_fixe || 0;

        // Base commission = forfait fixe du bouquet
        const baseCommission = commissionFixe;

        // Calculate survente bonus:
        // Survente = 50% × (prix vendu TTC - prix recommandé TTC) converti en HT
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
          // Appliquer le pourcentage (50%)
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
