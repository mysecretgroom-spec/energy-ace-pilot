import { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Camera, FilePlus2, Loader2, FolderUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWhatsAppNotification } from "@/hooks/useWhatsAppNotification";
import { AddDocumentFlow } from "@/components/scanner/AddDocumentFlow";
import { uploadDocumentToStorage } from "@/components/scanner/services/uploadService";
import { studyScanAssociation } from "@/lib/studyScanDocument";

interface Props {
  rdvId: string;
  clientId: string;
  clientName: string;
  clientPrenom?: string;
  etudeId?: string | null;
  regieId?: string | null;
}

const stamp = () => {
  const d = new Date();
  return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
};

/** Convertit une photo ou un PDF importé en PDF, pour qu'il rejoigne le dossier d'étude partagé. */
async function toPdf(file: File): Promise<Blob> {
  const bytes = await file.arrayBuffer();
  if (file.type === "application/pdf") {
    await PDFDocument.load(bytes); // rejette les PDF illisibles avant l'ajout au dossier
    return new Blob([bytes], { type: "application/pdf" });
  }
  const doc = await PDFDocument.create();
  const img = file.type === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  const page = doc.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  return new Blob([(await doc.save()) as unknown as BlobPart], { type: "application/pdf" });
}

/** Actions de complément de dossier, visibles seulement si le client a déjà une étude. */
export function ClientDossierQuickActions({ rdvId, clientId, clientName, clientPrenom, etudeId, regieId }: Props) {
  const { user } = useAuth();
  const { sendWhatsAppNotification } = useWhatsAppNotification();
  const [studyId, setStudyId] = useState<string | null>(etudeId ?? null);
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState<"import" | "send" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (etudeId || !user) return;
    supabase.from("etudes").select("id").eq("user_id", user.id).eq("client_id", clientId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setStudyId(data?.id ?? null));
  }, [etudeId, clientId, user]);

  if (!studyId || !user) return null;

  const handleImport = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy("import");
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        const pdf = await toPdf(file);
        const url = await uploadDocumentToStorage(pdf, user.id, "client_docs");
        const base = file.name.replace(/\.[^.]+$/, "");
        const { error } = await supabase.from("documents").insert([{
          user_id: user.id, client_id: clientId, type_document: "autre" as never,
          nom: `${base} ${stamp()}`, url, mime_type: "application/pdf", taille_bytes: pdf.size,
          ...studyScanAssociation(studyId),
        }]);
        if (error) throw error;
        ok++;
      } catch (e) {
        console.error("[Dossier] import", e);
        toast.error(`« ${file.name} » n'a pas pu être ajouté (formats acceptés : PDF, JPEG, PNG)`);
      }
    }
    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
    if (ok) toast.success(`${ok} document${ok > 1 ? "s" : ""} ajouté${ok > 1 ? "s" : ""} au dossier`);
  };

  const handleSend = async () => {
    setBusy("send");
    try {
      const sent = await sendWhatsAppNotification({
        clientName, clientPrenom, classification: "positif", userId: user.id, regieId, etudeId: studyId, rdvId,
      });
      if (!sent) toast.error("Envoi du dossier impossible");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi du dossier impossible");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Compléter le dossier</p>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" className="h-14 flex-col gap-1" onClick={() => setScanOpen(true)} disabled={!!busy}>
          <Camera className="h-5 w-5" /><span className="text-xs">Scanner</span>
        </Button>
        <Button variant="outline" className="h-14 flex-col gap-1" onClick={() => inputRef.current?.click()} disabled={!!busy}>
          {busy === "import" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FilePlus2 className="h-5 w-5" />}
          <span className="text-xs">Importer</span>
        </Button>
        <Button className="h-14 flex-col gap-1" onClick={handleSend} disabled={!!busy}>
          {busy === "send" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FolderUp className="h-5 w-5" />}
          <span className="text-xs">Envoyer dossier</span>
        </Button>
      </div>
      <input ref={inputRef} type="file" multiple accept="application/pdf,image/jpeg,image/png" className="hidden"
        onChange={(e) => handleImport(e.target.files)} />
      {scanOpen && (
        <AddDocumentFlow isOpen={scanOpen} context="client_docs" relatedClientId={clientId} relatedEtudeId={studyId}
          startWithCamera onSuccess={() => { setScanOpen(false); toast.success("Scan ajouté au dossier"); }}
          onCancel={() => setScanOpen(false)} />
      )}
    </div>
  );
}
