import { etudeRef } from "@/lib/offline/etudeQueries";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Types pour les données de référence PAC
export interface IsolationLevel {
  id: string;
  niveau_isolation: string;
  label: string;
  coefficient_deperdition: number;
  besoins_kwh_m2_an: number;
  description: string | null;
}

export interface CopData {
  id: string;
  pac_subtype: string;
  temperature_exterieure: number;
  cop_moyen: number;
}

export interface PuissancePac {
  id: string;
  pac_subtype: string;
  surface_min: number;
  surface_max: number;
  puissance_recommandee: number;
}

export interface EnergiePrix {
  id: string;
  type_energie: string;
  prix_kwh: number;
  unite: string;
  pouvoir_calorifique_kwh: number | null;
  description: string | null;
}

export interface ZoneClimatique {
  id: string;
  department_code: string;
  department_name: string;
  zone_climatique: string;
  dju_base18: number;
}

export interface AidePac {
  id: string;
  code: string;
  nom: string;
  type_aide: string;
  profil_revenus: string | null;
  pac_subtype: string | null;
  montant_fixe: number | null;
  montant_plafond: number | null;
  conditions: string | null;
}

// Types pour les données de référence ITE
export interface MurIte {
  id: string;
  type_mur: string;
  epaisseur_cm: number | null;
  r_initial: number;
  u_initial: number;
  description: string | null;
}

export interface IsolantIte {
  id: string;
  type_isolant: string;
  lambda: number;
  prix_m2: number;
  description: string | null;
}

export interface FinitionIte {
  id: string;
  type_finition: string;
  prix_m2: number;
  description: string | null;
}

export interface EconomieIte {
  id: string;
  gain_r_min: number;
  gain_r_max: number;
  economie_chauffage_pct: number;
  zone_climatique: string | null;
  description: string | null;
}

export interface AideIte {
  id: string;
  code: string;
  nom: string;
  type_aide: string;
  profil_revenus: string | null;
  montant_m2: number | null;
  montant_plafond: number | null;
  surface_min: number | null;
  conditions: string | null;
}

interface UseEtudeReferenceDataReturn {
  // PAC
  isolationLevels: IsolationLevel[];
  copData: CopData[];
  puissancesPac: PuissancePac[];
  energiesPrix: EnergiePrix[];
  zonesClimatiques: ZoneClimatique[];
  aidesPac: AidePac[];
  // ITE
  mursIte: MurIte[];
  isolantsIte: IsolantIte[];
  finitionsIte: FinitionIte[];
  economiesIte: EconomieIte[];
  aidesIte: AideIte[];
  // State
  loading: boolean;
  error: string | null;
  // Helpers
  getCopForTemperature: (subtype: string, temperature: number) => number;
  getRecommendedPuissance: (subtype: string, surface: number) => number;
  getEnergiePrix: (typeEnergie: string) => number;
  getZoneClimatique: (departmentCode: string) => ZoneClimatique | undefined;
  getMurRInitial: (typeMur: string) => number;
  getIsolantLambda: (typeIsolant: string) => number;
  getFinitionPrix: (typeFinition: string) => number;
  getEconomieChaufPct: (gainR: number, zone?: string) => number;
  calculateTotalAidesPac: (subtype: string, profilRevenus?: string) => number;
  calculateTotalAidesIte: (surface: number, profilRevenus?: string) => number;
}

export const useEtudeReferenceData = (): UseEtudeReferenceDataReturn => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // PAC data
  const [isolationLevels, setIsolationLevels] = useState<IsolationLevel[]>([]);
  const [copData, setCopData] = useState<CopData[]>([]);
  const [puissancesPac, setPuissancesPac] = useState<PuissancePac[]>([]);
  const [energiesPrix, setEnergiesPrix] = useState<EnergiePrix[]>([]);
  const [zonesClimatiques, setZonesClimatiques] = useState<ZoneClimatique[]>([]);
  const [aidesPac, setAidesPac] = useState<AidePac[]>([]);
  
  // ITE data
  const [mursIte, setMursIte] = useState<MurIte[]>([]);
  const [isolantsIte, setIsolantsIte] = useState<IsolantIte[]>([]);
  const [finitionsIte, setFinitionsIte] = useState<FinitionIte[]>([]);
  const [economiesIte, setEconomiesIte] = useState<EconomieIte[]>([]);
  const [aidesIte, setAidesIte] = useState<AideIte[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load all reference data in parallel
      const [
        isolationRes,
        copRes,
        puissancesRes,
        energiesRes,
        zonesRes,
        aidesPacRes,
        mursRes,
        isolantsRes,
        finitionsRes,
        economiesRes,
        aidesIteRes,
      ] = await Promise.all([
        etudeRef.pacIsolation(),
        etudeRef.pacCop(),
        etudeRef.pacPuissances(),
        etudeRef.energiesPrix(),
        etudeRef.zones(),
        etudeRef.aidesPac(),
        etudeRef.iteMurs(),
        etudeRef.iteIsolants(),
        etudeRef.iteFinitions(),
        etudeRef.iteEconomies(),
        etudeRef.aidesIte(),
      ]);

      if (isolationRes.data) setIsolationLevels(isolationRes.data as IsolationLevel[]);
      if (copRes.data) setCopData(copRes.data as CopData[]);
      if (puissancesRes.data) setPuissancesPac(puissancesRes.data as PuissancePac[]);
      if (energiesRes.data) setEnergiesPrix(energiesRes.data as EnergiePrix[]);
      if (zonesRes.data) setZonesClimatiques(zonesRes.data as ZoneClimatique[]);
      if (aidesPacRes.data) setAidesPac(aidesPacRes.data as AidePac[]);
      if (mursRes.data) setMursIte(mursRes.data as MurIte[]);
      if (isolantsRes.data) setIsolantsIte(isolantsRes.data as IsolantIte[]);
      if (finitionsRes.data) setFinitionsIte(finitionsRes.data as FinitionIte[]);
      if (economiesRes.data) setEconomiesIte(economiesRes.data as EconomieIte[]);
      if (aidesIteRes.data) setAidesIte(aidesIteRes.data as AideIte[]);
    } catch (err) {
      setError("Erreur lors du chargement des données de référence");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // === Helper functions PAC ===
  
  const getCopForTemperature = (subtype: string, temperature: number): number => {
    const filtered = copData.filter(c => c.pac_subtype === subtype);
    if (filtered.length === 0) return 3.5; // Default COP
    
    // Find closest temperature
    const sorted = filtered.sort((a, b) => 
      Math.abs(a.temperature_exterieure - temperature) - Math.abs(b.temperature_exterieure - temperature)
    );
    
    // If exact match, return it
    const exact = filtered.find(c => c.temperature_exterieure === temperature);
    if (exact) return exact.cop_moyen;
    
    // Interpolate between two closest values
    const below = filtered.filter(c => c.temperature_exterieure <= temperature).pop();
    const above = filtered.find(c => c.temperature_exterieure > temperature);
    
    if (!below) return above?.cop_moyen || 3.5;
    if (!above) return below.cop_moyen;
    
    // Linear interpolation
    const ratio = (temperature - below.temperature_exterieure) / (above.temperature_exterieure - below.temperature_exterieure);
    return below.cop_moyen + ratio * (above.cop_moyen - below.cop_moyen);
  };

  const getRecommendedPuissance = (subtype: string, surface: number): number => {
    const match = puissancesPac.find(p => 
      p.pac_subtype === subtype && 
      surface >= p.surface_min && 
      surface <= p.surface_max
    );
    return match?.puissance_recommandee || Math.round(surface * 0.07); // ~70W/m² par défaut
  };

  const getEnergiePrix = (typeEnergie: string): number => {
    const energie = energiesPrix.find(e => 
      e.type_energie.toLowerCase() === typeEnergie.toLowerCase()
    );
    return energie?.prix_kwh || 0.15;
  };

  const getZoneClimatique = (departmentCode: string): ZoneClimatique | undefined => {
    return zonesClimatiques.find(z => z.department_code === departmentCode);
  };

  const calculateTotalAidesPac = (subtype: string, profilRevenus?: string): number => {
    let total = 0;
    aidesPac.forEach(aide => {
      // Vérifier compatibilité subtype
      if (aide.pac_subtype && aide.pac_subtype !== subtype) return;
      // Vérifier compatibilité profil revenus (using MPR color codes: bleu, jaune, violet, rose)
      if (aide.profil_revenus && profilRevenus && aide.profil_revenus !== profilRevenus) return;
      // Rose = non éligible MPR
      if (profilRevenus === "rose" && aide.type_aide === "mpr") return;
      
      if (aide.montant_fixe) {
        total += aide.montant_fixe;
      }
    });
    return total;
  };

  // === Helper functions ITE ===
  
  const getMurRInitial = (typeMur: string): number => {
    const mur = mursIte.find(m => m.type_mur === typeMur);
    return mur?.r_initial || 0.3;
  };

  const getIsolantLambda = (typeIsolant: string): number => {
    const isolant = isolantsIte.find(i => i.type_isolant === typeIsolant);
    return isolant?.lambda || 0.038;
  };

  const getFinitionPrix = (typeFinition: string): number => {
    const finition = finitionsIte.find(f => f.type_finition === typeFinition);
    return finition?.prix_m2 || 40;
  };

  const getEconomieChaufPct = (gainR: number, zone?: string): number => {
    // Filter by zone if provided
    let filtered = economiesIte;
    if (zone) {
      const zoneFiltered = economiesIte.filter(e => e.zone_climatique === zone);
      if (zoneFiltered.length > 0) filtered = zoneFiltered;
    }
    
    // Find matching gain R range
    const match = filtered.find(e => gainR >= e.gain_r_min && gainR < e.gain_r_max);
    return match?.economie_chauffage_pct || 25; // Default 25%
  };

  const calculateTotalAidesIte = (surface: number, profilRevenus?: string): number => {
    let total = 0;
    aidesIte.forEach(aide => {
      // Vérifier surface min
      if (aide.surface_min && surface < aide.surface_min) return;
      // Vérifier compatibilité profil revenus
      if (aide.profil_revenus && profilRevenus && aide.profil_revenus !== profilRevenus) return;
      
      if (aide.montant_m2) {
        const montant = aide.montant_m2 * surface;
        const montantFinal = aide.montant_plafond ? Math.min(montant, aide.montant_plafond) : montant;
        total += montantFinal;
      }
    });
    return total;
  };

  return {
    // Data
    isolationLevels,
    copData,
    puissancesPac,
    energiesPrix,
    zonesClimatiques,
    aidesPac,
    mursIte,
    isolantsIte,
    finitionsIte,
    economiesIte,
    aidesIte,
    // State
    loading,
    error,
    // Helpers
    getCopForTemperature,
    getRecommendedPuissance,
    getEnergiePrix,
    getZoneClimatique,
    getMurRInitial,
    getIsolantLambda,
    getFinitionPrix,
    getEconomieChaufPct,
    calculateTotalAidesPac,
    calculateTotalAidesIte,
  };
};
