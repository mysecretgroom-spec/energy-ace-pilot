import { supabase } from "@/integrations/supabase/client";
import { getPreEtudePdfBlob, type EtudeData } from "@/lib/exportEtudePdf";
import { appendStudyPhotosToPdf } from "@/lib/appendStudyPhotosToPdf";
import { appendRoofMapAnnexeToPdf } from "@/lib/appendRoofMapAnnexeToPdf";

export async function signatureStudyPdf(userId: string, etudeId?: string | null, rdvId?: string, liveData?: EtudeData): Promise<File | null> {
  let study = null;
  if (etudeId || rdvId) {
    let query = supabase.from("etudes").select("*, clients!inner(nom, prenom, adresse, ville, code_postal, telephone)").eq("user_id", userId);
    query = etudeId ? query.eq("id", etudeId) : query.eq("rdv_id", rdvId ?? "");
    const result = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (result.error) throw result.error;
    study = result.data;
  }
  if (!liveData && !study) return null;
  const { generatePdfFromEtude } = await import("@/hooks/useEtudePdfDownload");
  const generated = liveData
    ? { blob: await getPreEtudePdfBlob(liveData), pdfData: liveData }
    : await generatePdfFromEtude(study, study?.clients, "pre-etude");
  const withPhotos = study ? await appendStudyPhotosToPdf(generated.blob, userId, study.client_id, study.id) : generated.blob;
  const blob = await appendRoofMapAnnexeToPdf(withPhotos, generated.pdfData, study?.id);
  return new File([blob], "Etude_signature.pdf", { type: "application/pdf" });
}