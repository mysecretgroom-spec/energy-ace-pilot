import { supabase } from "@/integrations/supabase/client";

interface CommissionTier {
  tranche_min: number;
  tranche_max: number;
  taux_commission: number;
  bonus_survente: number;
}

interface CalculatedCommission {
  montant_base: number;
  taux_commission: number;
  bonus_survente: number;
  montant_commission: number;
}

export const useCommissions = () => {
  /**
   * Récupère les tranches de commission depuis la base
   */
  const fetchCommissionTiers = async (): Promise<CommissionTier[]> => {
    const { data, error } = await supabase
      .from("data_commissions")
      .select("*")
      .order("tranche_min", { ascending: true });

    if (error) {
      console.error("Erreur récupération tranches:", error);
      return [];
    }

    return data.map(tier => ({
      tranche_min: Number(tier.tranche_min),
      tranche_max: Number(tier.tranche_max),
      taux_commission: Number(tier.taux_commission),
      bonus_survente: Number(tier.bonus_survente || 0)
    }));
  };

  /**
   * Calcule la commission pour un montant de vente donné
   * @param montantVente Montant HT de la vente
   * @param prixRecommande Prix recommandé HT (pour calcul bonus survente)
   */
  const calculateCommission = async (
    montantVente: number,
    prixRecommande?: number
  ): Promise<CalculatedCommission | null> => {
    const tiers = await fetchCommissionTiers();
    
    if (tiers.length === 0) {
      // Fallback si pas de tranches définies
      return {
        montant_base: montantVente,
        taux_commission: 5,
        bonus_survente: 0,
        montant_commission: montantVente * 0.05
      };
    }

    // Trouver la tranche applicable
    const applicableTier = tiers.find(
      tier => montantVente >= tier.tranche_min && montantVente <= tier.tranche_max
    );

    if (!applicableTier) {
      // Utiliser la dernière tranche si au-delà
      const lastTier = tiers[tiers.length - 1];
      const taux = lastTier.taux_commission / 100;
      
      return {
        montant_base: montantVente,
        taux_commission: lastTier.taux_commission,
        bonus_survente: 0,
        montant_commission: montantVente * taux
      };
    }

    const taux = applicableTier.taux_commission / 100;
    let bonusSurvente = 0;

    // Calcul du bonus survente si applicable
    if (prixRecommande && montantVente > prixRecommande && applicableTier.bonus_survente > 0) {
      const surventeAmount = montantVente - prixRecommande;
      bonusSurvente = surventeAmount * (applicableTier.bonus_survente / 100);
    }

    const commissionBase = montantVente * taux;
    const montantTotal = commissionBase + bonusSurvente;

    return {
      montant_base: montantVente,
      taux_commission: applicableTier.taux_commission,
      bonus_survente: bonusSurvente,
      montant_commission: montantTotal
    };
  };

  /**
   * Crée une commission en base pour une vente
   */
  const createCommission = async (
    userId: string,
    venteId: string,
    montantVente: number,
    prixRecommande?: number
  ): Promise<boolean> => {
    const commission = await calculateCommission(montantVente, prixRecommande);
    
    if (!commission) {
      console.error("Impossible de calculer la commission");
      return false;
    }

    const { error } = await supabase.from("commissions").insert({
      user_id: userId,
      vente_id: venteId,
      montant_base: commission.montant_base,
      taux_commission: commission.taux_commission,
      bonus_survente: commission.bonus_survente,
      montant_commission: commission.montant_commission
    });

    if (error) {
      console.error("Erreur création commission:", error);
      return false;
    }

    return true;
  };

  /**
   * Récupère le résumé des commissions pour un utilisateur
   */
  const getCommissionsSummary = async (userId: string) => {
    const { data, error } = await supabase
      .from("commissions")
      .select("*, vente:ventes(montant_ttc, client:clients(nom))")
      .eq("user_id", userId)
      .order("date_calcul", { ascending: false });

    if (error) {
      console.error("Erreur récupération commissions:", error);
      return null;
    }

    const totalPayees = data
      .filter(c => c.paye)
      .reduce((sum, c) => sum + Number(c.montant_commission), 0);

    const totalEnAttente = data
      .filter(c => !c.paye)
      .reduce((sum, c) => sum + Number(c.montant_commission), 0);

    return {
      commissions: data,
      totalPayees,
      totalEnAttente,
      total: totalPayees + totalEnAttente
    };
  };

  return {
    fetchCommissionTiers,
    calculateCommission,
    createCommission,
    getCommissionsSummary
  };
};
