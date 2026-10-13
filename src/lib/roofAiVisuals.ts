import { supabase } from "@/integrations/supabase/client";

export const PANEL_WIDTH_M = 1.13;
export const PANEL_HEIGHT_M = 2.095;

/** Taille d'un panneau en pixels de l'image satellite rendue (Web Mercator). */
export function panelPixelSize(lat: number, zoom: number, cssWidth: number, imageWidth: number) {
  const mppCss = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  const mpp = (mppCss * cssWidth) / imageWidth;
  return { w: Math.max(1, Math.round(PANEL_WIDTH_M / mpp)), h: Math.max(1, Math.round(PANEL_HEIGHT_M / mpp)) };
}

export interface AiVisuals {
  satellite: string | null;
  photo: string | null;
  nbPanneaux: number | null;
}

export async function fetchLatestAiVisuals(etudeId: string): Promise<AiVisuals> {
  const { data } = await supabase
    .from("documents")
    .select("url, context_source, metadata, created_at")
    .eq("etude_id", etudeId)
    .in("context_source", ["simulation_ia_satellite", "simulation_ia_photo"])
    .order("created_at", { ascending: false })
    .limit(10);
  const sat = data?.find((d) => d.context_source === "simulation_ia_satellite");
  const pho = data?.find((d) => d.context_source === "simulation_ia_photo");
  const meta = ((sat ?? pho)?.metadata ?? {}) as { nb_panneaux?: number };
  return { satellite: sat?.url ?? null, photo: pho?.url ?? null, nbPanneaux: meta.nb_panneaux ?? null };
}
