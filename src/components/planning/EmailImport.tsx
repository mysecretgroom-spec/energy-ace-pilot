import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Mail, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface EmailImportProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface ImportResult {
  success: boolean;
  action?: "created" | "updated";
  rdv_id?: string;
  client_id?: string;
  error?: string;
  parsed?: {
    nom: string;
    prenom?: string;
    adresse?: string;
    telephone?: string;
    date_heure?: string;
    type_projet?: string;
  };
}

export function EmailImport({ onSuccess, onCancel }: EmailImportProps) {
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Form state
  const [senderEmail, setSenderEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const handleImport = async () => {
    if (!user) return;
    if (!senderEmail || !body) {
      toast.error("Email expéditeur et contenu sont obligatoires");
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const response = await supabase.functions.invoke("import-rdv-email", {
        body: {
          sender_email: senderEmail,
          subject,
          body,
          user_id: user.id,
        },
      });

      if (response.error) {
        const errorData = response.error.message ? JSON.parse(response.error.message) : response.error;
        setResult({ success: false, error: errorData.error || "Erreur inconnue" });
        toast.error(errorData.error || "Erreur lors de l'import");
        return;
      }

      setResult(response.data);
      
      if (response.data.action === "created") {
        toast.success("Nouveau RDV créé avec succès");
      } else if (response.data.action === "updated") {
        toast.success("RDV existant mis à jour");
      }

      onSuccess?.();
    } catch (err: any) {
      console.error("Import error:", err);
      setResult({ success: false, error: err.message });
      toast.error("Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Importer un RDV depuis un email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          <AlertCircle className="h-4 w-4 inline mr-1" />
          L'expéditeur doit être dans votre liste d'emails autorisés (Paramètres).
        </div>

        <div className="space-y-2">
          <Label htmlFor="sender">Email expéditeur</Label>
          <Input
            id="sender"
            type="email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            placeholder="confirmateur@leadgen.fr"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Sujet</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Nouveau RDV - M. Dupont"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Contenu de l'email</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Collez ici le contenu de l'email avec les informations du RDV..."
            rows={6}
          />
        </div>

        {/* Result display */}
        {result && (
          <div
            className={`p-4 rounded-lg ${
              result.success
                ? "bg-status-signed/10 border border-status-signed/30"
                : "bg-destructive/10 border border-destructive/30"
            }`}
          >
            {result.success ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-status-signed font-medium">
                  <Check className="h-4 w-4" />
                  {result.action === "created" ? "Nouveau RDV créé" : "RDV mis à jour"}
                </div>
                {result.parsed && (
                  <div className="text-sm space-y-1">
                    <p><strong>Client :</strong> {result.parsed.prenom} {result.parsed.nom}</p>
                    {result.parsed.adresse && <p><strong>Adresse :</strong> {result.parsed.adresse}</p>}
                    {result.parsed.date_heure && (
                      <p><strong>Date :</strong> {new Date(result.parsed.date_heure).toLocaleString("fr-FR")}</p>
                    )}
                    {result.parsed.type_projet && <p><strong>Type :</strong> {result.parsed.type_projet}</p>}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                {result.error}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleImport}
            disabled={importing}
            className="flex-1 bg-gradient-hero"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Importer
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
