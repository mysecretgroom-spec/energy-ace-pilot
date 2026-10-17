import { useState } from "react";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddDocumentFlow } from "@/components/scanner/AddDocumentFlow";
import { useToast } from "@/hooks/use-toast";

export function StudyScanButton({ clientId, etudeId, className, onSaved }: {
  clientId: string; etudeId: string | null; className?: string; onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  return <>
    <Button type="button" variant="outline" className={className} disabled={!etudeId} onClick={() => setOpen(true)}>
      <ScanLine className="h-4 w-4 mr-2" />Scanner les documents
    </Button>
    {open && etudeId && <AddDocumentFlow isOpen startWithCamera context="client_docs" relatedClientId={clientId}
      relatedEtudeId={etudeId} onCancel={() => setOpen(false)} onSuccess={() => {
        setOpen(false);
        toast({ title: "Documents ajoutés à l’étude", description: "Ils seront inclus dans le PDF envoyé." });
        onSaved?.();
      }} />}
  </>;
}