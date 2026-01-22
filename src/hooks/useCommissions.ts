import { supabase } from "@/integrations/supabase/client";

interface CommissionTier {
  tranche_min: number;
  tranche_max: number;
  taux_commission: number;
  bonus_survente: number;
}

interface BouquetCommission {
  id: string;
  nom_bouquet: string;
  puissance_kwc: number;
  prix_recommande: number;
  commission_fixe: number;
  commission_pct: number;
}

interface CommissionConfig {
  mode_calcul: "pourcentage" | "bouquet";
  part_survente_pct: number;
}

interface CalculatedCommission {
  montant_base: number;
  taux_commission: number;
  bonus_survente: number;
  montant_commission: number;
  mode: "pourcentage" | "bouquet";
}

export const useCommissions = () => {
  /**
   * Récupère la configuration des commissions
   */
  const fetchConfig = async (): Promise<CommissionConfig> => {
    const { data, error } = await supabase
      .from("config_commissions")
      .select("*")
      .limit(1)
      .single();

    if (error || !data) {
      return { mode_calcul: "pourcentage", part_survente_pct: 50 };
    }

    return {
      mode_calcul: data.mode_calcul as "pourcentage" | "bouquet",
      part_survente_pct: Number(data.part_survente_pct)
    };
  };

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
   * Récupère les commissions par bouquet
   */
  const fetchBouquetCommissions = async (): Promise<BouquetCommission[]> => {
    const { data, error } = await supabase
      .from("data_prix_bouquets")
      .select("id, nom_bouquet, puissance_kwc, prix_recommande, commission_fixe, commission_pct")
      .eq("actif", true)
      .order("puissance_kwc", { ascending: true });

    if (error) {
      console.error("Erreur récupération bouquets:", error);
      return [];
    }

    return data.map(b => ({
      id: b.id,
      nom_bouquet: b.nom_bouquet,
      puissance_kwc: Number(b.puissance_kwc),
      prix_recommande: Number(b.prix_recommande),
      commission_fixe: Number(b.commission_fixe || 0),
      commission_pct: Number(b.commission_pct || 0)
    }));
  };

  /**
   * Calcule la commission pour un montant de vente donné
   * @param montantVente Montant HT de la vente
   * @param prixRecommande Prix recommandé HT (pour calcul bonus survente)
   * @param bouquetId ID du bouquet vendu (pour mode bouquet)
   */
  const calculateCommission = async (
    montantVente: number,
    prixRecommande?: number,
    bouquetId?: string
  ): Promise<CalculatedCommission | null> => {
    const config = await fetchConfig();
    
    if (config.mode_calcul === "bouquet" && bouquetId) {
      // Mode bouquet
      const bouquets = await fetchBouquetCommissions();
      const bouquet = bouquets.find(b => b.id === bouquetId);
      
      if (!bouquet) {
        console.error("Bouquet non trouvé:", bouquetId);
        return null;
      }

      const commissionBase = bouquet.commission_fixe + (montantVente * (bouquet.commission_pct / 100));
      let bonusSurvente = 0;

      // Calcul de la survente
      const prixReco = prixRecommande || bouquet.prix_recommande;
      if (montantVente > prixReco) {
        const surventeAmount = montantVente - prixReco;
        bonusSurvente = surventeAmount * (config.part_survente_pct / 100);
      }

      return {
        montant_base: montantVente,
        taux_commission: bouquet.commission_pct,
        bonus_survente: bonusSurvente,
        montant_commission: commissionBase + bonusSurvente,
        mode: "bouquet"
      };
    }

    // Mode pourcentage (par défaut)
    const tiers = await fetchCommissionTiers();
    
    if (tiers.length === 0) {
      // Fallback si pas de tranches définies
      return {
        montant_base: montantVente,
        taux_commission: 5,
        bonus_survente: 0,
        montant_commission: montantVente * 0.05,
        mode: "pourcentage"
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
        montant_commission: montantVente * taux,
        mode: "pourcentage"
      };
    }

    const taux = applicableTier.taux_commission / 100;
    let bonusSurvente = 0;

    // Calcul du bonus survente
    if (prixRecommande && montantVente > prixRecommande) {
      const surventeAmount = montantVente - prixRecommande;
      bonusSurvente = surventeAmount * (config.part_survente_pct / 100);
    }

    const commissionBase = montantVente * taux;
    const montantTotal = commissionBase + bonusSurvente;

    return {
      montant_base: montantVente,
      taux_commission: applicableTier.taux_commission,
      bonus_survente: bonusSurvente,
      montant_commission: montantTotal,
      mode: "pourcentage"
    };
  };

  /**
   * Crée une commission en base pour une vente
   */
  const createCommission = async (
    userId: string,
    venteId: string,
    montantVente: number,
    prixRecommande?: number,
    bouquetId?: string
  ): Promise<boolean> => {
    const commission = await calculateCommission(montantVente, prixRecommande, bouquetId);
    
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
    fetchConfig,
    fetchCommissionTiers,
    fetchBouquetCommissions,
    calculateCommission,
    createCommission,
    getCommissionsSummary
  };
};
