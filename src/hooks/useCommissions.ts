import { supabase } from "@/integrations/supabase/client";
import { ttcToHT, getTauxTVAByPuissance } from "@/lib/tva";

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
  prix_recommande: number; // Prix normal TTC
  prix_hejja: number; // Prix Hejja TTC (survente = prix_hejja - prix_recommande)
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
      .select("id, nom_bouquet, puissance_kwc, prix_recommande, prix_hejja, commission_fixe, commission_pct")
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
      prix_hejja: Number(b.prix_hejja || 0),
      commission_fixe: Number(b.commission_fixe || 0),
      commission_pct: Number(b.commission_pct || 0)
    }));
  };

  /**
   * Calcule la commission pour un montant de vente donné
   * IMPORTANT: Le montant de vente est toujours saisi en TTC, on le convertit en HT pour les calculs
   * 
   * @param montantVenteTTC Montant TTC de la vente (tel que saisi par l'utilisateur)
   * @param prixRecommandeTTC Prix recommandé TTC (pour calcul bonus survente)
   * @param bouquetId ID du bouquet vendu (pour mode bouquet)
   * @param puissanceKwc Puissance en kWc (pour déterminer le taux TVA applicable)
   */
  const calculateCommission = async (
    montantVenteTTC: number,
    prixRecommandeTTC?: number,
    bouquetId?: string,
    puissanceKwc: number = 3
  ): Promise<CalculatedCommission | null> => {
    const config = await fetchConfig();
    
    // Déterminer le taux de TVA selon la puissance
    const tauxTVA = getTauxTVAByPuissance(puissanceKwc);
    
    // Convertir les montants TTC en HT pour les calculs de commission
    const montantVenteHT = ttcToHT(montantVenteTTC, tauxTVA);
    const prixRecommandeHT = prixRecommandeTTC ? ttcToHT(prixRecommandeTTC, tauxTVA) : undefined;
    
    if (config.mode_calcul === "bouquet" && bouquetId) {
      // Mode bouquet
      const bouquets = await fetchBouquetCommissions();
      const bouquet = bouquets.find(b => b.id === bouquetId);
      
      if (!bouquet) {
        console.error("Bouquet non trouvé:", bouquetId);
        return null;
      }

      // Les commissions sont calculées sur le montant HT
      const commissionBase = bouquet.commission_fixe + (montantVenteHT * (bouquet.commission_pct / 100));
      let bonusSurvente = 0;

      // Calcul de la survente sur les montants HT
      // Le prix recommandé du bouquet est stocké en HT dans la base
      const prixRecoHT = prixRecommandeHT || bouquet.prix_recommande;
      if (montantVenteHT > prixRecoHT) {
        const surventeAmountHT = montantVenteHT - prixRecoHT;
        bonusSurvente = surventeAmountHT * (config.part_survente_pct / 100);
      }

      return {
        montant_base: montantVenteHT,
        taux_commission: bouquet.commission_pct,
        bonus_survente: bonusSurvente,
        montant_commission: commissionBase + bonusSurvente,
        mode: "bouquet"
      };
    }

    // Mode pourcentage (par défaut) - calculs sur montant HT
    const tiers = await fetchCommissionTiers();
    
    if (tiers.length === 0) {
      // Fallback si pas de tranches définies
      return {
        montant_base: montantVenteHT,
        taux_commission: 5,
        bonus_survente: 0,
        montant_commission: montantVenteHT * 0.05,
        mode: "pourcentage"
      };
    }

    // Trouver la tranche applicable (basée sur le montant HT)
    const applicableTier = tiers.find(
      tier => montantVenteHT >= tier.tranche_min && montantVenteHT <= tier.tranche_max
    );

    if (!applicableTier) {
      // Utiliser la dernière tranche si au-delà
      const lastTier = tiers[tiers.length - 1];
      const taux = lastTier.taux_commission / 100;
      
      return {
        montant_base: montantVenteHT,
        taux_commission: lastTier.taux_commission,
        bonus_survente: 0,
        montant_commission: montantVenteHT * taux,
        mode: "pourcentage"
      };
    }

    const taux = applicableTier.taux_commission / 100;
    let bonusSurvente = 0;

    // Calcul du bonus survente sur le montant HT
    if (prixRecommandeHT && montantVenteHT > prixRecommandeHT) {
      const surventeAmountHT = montantVenteHT - prixRecommandeHT;
      bonusSurvente = surventeAmountHT * (config.part_survente_pct / 100);
    }

    const commissionBase = montantVenteHT * taux;
    const montantTotal = commissionBase + bonusSurvente;

    return {
      montant_base: montantVenteHT,
      taux_commission: applicableTier.taux_commission,
      bonus_survente: bonusSurvente,
      montant_commission: montantTotal,
      mode: "pourcentage"
    };
  };

  /**
   * Crée une commission en base pour une vente
   * @param userId ID de l'utilisateur
   * @param venteId ID de la vente
   * @param montantVenteTTC Montant TTC de la vente
   * @param prixRecommandeTTC Prix recommandé TTC (optionnel)
   * @param bouquetId ID du bouquet (optionnel)
   * @param puissanceKwc Puissance en kWc (pour taux TVA)
   */
  const createCommission = async (
    userId: string,
    venteId: string,
    montantVenteTTC: number,
    prixRecommandeTTC?: number,
    bouquetId?: string,
    puissanceKwc: number = 3
  ): Promise<boolean> => {
    const commission = await calculateCommission(montantVenteTTC, prixRecommandeTTC, bouquetId, puissanceKwc);
    
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
