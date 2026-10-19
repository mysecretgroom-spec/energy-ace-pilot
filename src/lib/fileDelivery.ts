import { toast } from "sonner";

/** Downloads on desktop; the OS file sheet offers Save to Files on touch devices. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function deliverFiles(files: File[], forceShare = false): Promise<void> {
  if (!files.length) return;
  const native = (forceShare || window.matchMedia("(pointer: coarse)").matches) &&
    typeof navigator.share === "function" && navigator.canShare?.({ files });
  if (!native) {
    files.forEach((file) => downloadBlob(file, file.name));
    return;
  }
  const open = async () => {
    try {
      await navigator.share({ files, title: files.length === 1 ? files[0].name : "Documents" });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      // Never open a second destination after a failed native sheet.
      toast.error("Enregistrement indisponible", {
        action: { label: "Télécharger", onClick: () => files.forEach((file) => downloadBlob(file, file.name)) },
      });
    }
  };
  if (navigator.userActivation && !navigator.userActivation.isActive) {
    // Network/PDF preparation can consume Safari's activation. This new tap restores it.
    toast("Fichier prêt à enregistrer", {
      id: "native-file-ready", duration: Infinity,
      action: { label: "Enregistrer", onClick: () => { void open(); } },
      cancel: { label: "Annuler", onClick: () => {} },
    });
    return;
  }
  await open();
}

export function deliverFile(blob: Blob, filename: string, forceShare = false): Promise<void> {
  return deliverFiles([new File([blob], filename, { type: blob.type || "application/octet-stream" })], forceShare);
}