import { supabase } from "@/integrations/supabase/client";

interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted_address?: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!address || address.trim().length < 5) {
    return null;
  }

  try {
    const response = await supabase.functions.invoke("geocode-address", {
      body: { address },
    });

    if (response.error || !response.data) {
      console.warn("Geocoding failed for address:", address);
      return null;
    }

    return {
      latitude: response.data.latitude,
      longitude: response.data.longitude,
      formatted_address: response.data.formatted_address,
    };
  } catch (err) {
    console.error("Geocoding error:", err);
    return null;
  }
}

export async function geocodeAndUpdateClient(clientId: string, address: string) {
  const coords = await geocodeAddress(address);
  if (!coords) return null;

  const { error } = await supabase
    .from("clients")
    .update({
      latitude: coords.latitude,
      longitude: coords.longitude,
    })
    .eq("id", clientId);

  if (error) {
    console.error("Error updating client coordinates:", error);
    return null;
  }

  return coords;
}

export async function geocodeAndUpdateRdv(rdvId: string, address: string) {
  const coords = await geocodeAddress(address);
  if (!coords) return null;

  const { error } = await supabase
    .from("rdv")
    .update({
      latitude: coords.latitude,
      longitude: coords.longitude,
    })
    .eq("id", rdvId);

  if (error) {
    console.error("Error updating RDV coordinates:", error);
    return null;
  }

  return coords;
}
