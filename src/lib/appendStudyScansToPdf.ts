import { PDFDocument } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";
import { STUDY_SCAN_SOURCE } from "./studyScanDocument";

/** Fail explicitly rather than share an incomplete study when a saved scan is unreadable. */
export async function appendStudyScansToPdf(report: Blob, userId: string, clientId: string, etudeId: string): Promise<Blob> {
  const { data, error } = await supabase.from("documents")
    .select("id, url, nom").eq("user_id", userId).eq("client_id", clientId)
    .eq("etude_id", etudeId).eq("context_source", STUDY_SCAN_SOURCE)
    .order("created_at", { ascending: true }).order("id", { ascending: true });
  if (error) throw new Error("Impossible de charger les documents scannés de l’étude");
  if (!data?.length) return report;
  const merged = await PDFDocument.load(await report.arrayBuffer());
  for (const doc of data) {
    try {
      const response = await fetch(doc.url);
      if (!response.ok) throw new Error("Document inaccessible");
      const scan = await PDFDocument.load(await response.arrayBuffer());
      const pages = await merged.copyPages(scan, scan.getPageIndices());
      pages.forEach(page => merged.addPage(page));
    } catch {
      throw new Error(`Impossible d’intégrer le document scanné « ${doc.nom} ». Réessayez avant l’envoi.`);
    }
  }
  const bytes = await merged.save({ useObjectStreams: true });
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}