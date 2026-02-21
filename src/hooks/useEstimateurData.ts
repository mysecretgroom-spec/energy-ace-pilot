import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Fetch all reference data needed by the ConsumptionEstimator */
export function useEstimateurData() {
  const isolationQuery = useQuery({
    queryKey: ["data_pac_isolation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_pac_isolation")
        .select("niveau_isolation, label, besoins_kwh_m2_an, coefficient_deperdition, description")
        .eq("actif", true)
        .order("ordre");
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const energiesPrixQuery = useQuery({
    queryKey: ["data_energies_prix"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_energies_prix")
        .select("type_energie, prix_kwh, pouvoir_calorifique_kwh, unite")
        .eq("actif", true);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const copQuery = useQuery({
    queryKey: ["data_pac_cop"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_pac_cop")
        .select("pac_subtype, temperature_exterieure, cop_moyen")
        .eq("actif", true)
        .order("pac_subtype")
        .order("temperature_exterieure");
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const coefficientsQuery = useQuery({
    queryKey: ["data_estimateur_coefficients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_estimateur_coefficients")
        .select("*")
        .eq("actif", true);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = isolationQuery.isLoading || energiesPrixQuery.isLoading || copQuery.isLoading || coefficientsQuery.isLoading;

  // Build lookup helpers
  const isolationLevels = (isolationQuery.data || []).map(i => ({
    value: i.niveau_isolation,
    label: i.label,
    besoins_kwh_m2: i.besoins_kwh_m2_an,
    description: i.description,
  }));

  // Energy prices: map type_energie → prix_kwh
  const prixEnergies: Record<string, number> = {};
  (energiesPrixQuery.data || []).forEach(e => {
    prixEnergies[e.type_energie] = e.prix_kwh;
  });

  // COP: average COP per PAC subtype (use 7°C as reference)
  const copBySubtype: Record<string, number> = {};
  (copQuery.data || []).forEach(c => {
    if (c.temperature_exterieure === 7) {
      copBySubtype[c.pac_subtype] = c.cop_moyen;
    }
  });

  // Coefficients: map code → valeur
  const coefficients: Record<string, number> = {};
  (coefficientsQuery.data || []).forEach(c => {
    coefficients[c.code] = c.valeur;
  });

  return {
    isLoading,
    isolationLevels,
    prixEnergies,
    copBySubtype,
    coefficients,
  };
}
