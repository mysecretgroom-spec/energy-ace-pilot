import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Save, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Template {
  classification: string;
  template_text: string;
  is_active: boolean;
}

const CLASSIFICATIONS = [
  { key: "positif", label: "✅ POSITIF", color: "bg-green-500" },
  { key: "negatif", label: "❌ NÉGATIF", color: "bg-red-500" },
  { key: "r2", label: "🔄 R2 - Second RDV", color: "bg-blue-500" },
  { key: "r2_prestudy", label: "📋 R2 Pré-étude", color: "bg-purple-500" },
  { key: "attente", label: "⏳ En attente", color: "bg-yellow-500" },
  { key: "annule", label: "🚫 Annulé", color: "bg-gray-500" },
];

// Default templates with placeholders
const DEFAULT_TEMPLATES: Record<string, string> = {
  positif: `📋 *MISE À JOUR DOSSIER*

👤 Client: *{{client_name}}*
📅 Date: {{date}}
📊 Statut: ✅ POSITIF

🎉 Excellent ! Le client est intéressé et prêt à avancer.

📞 *CQ prévu:*
{{cq_date}}

{{comment}}

---
_Envoyé depuis DébalePro_`,

  negatif: `📋 *MISE À JOUR DOSSIER*

👤 Client: *{{client_name}}*
📅 Date: {{date}}
📊 Statut: ❌ NÉGATIF

Le client n'est pas intéressé pour le moment.

{{comment}}

---
_Envoyé depuis DébalePro_`,

  r2: `📋 *MISE À JOUR DOSSIER*

👤 Client: *{{client_name}}*
📅 Date: {{date}}
📊 Statut: 🔄 R2 - Second RDV

📆 *RDV R2 prévu:*
{{r2_date}}

{{comment}}

---
_Envoyé depuis DébalePro_`,

  r2_prestudy: `📋 *MISE À JOUR DOSSIER*

👤 Client: *{{client_name}}*
📅 Date: {{date}}
📊 Statut: 📋 R2 Pré-étude

📆 *RDV R2 prévu:*
{{r2_date}}

Une pré-étude sera effectuée avant le second rendez-vous.

{{comment}}

---
_Envoyé depuis DébalePro_`,

  attente: `📋 *MISE À JOUR DOSSIER*

👤 Client: *{{client_name}}*
📅 Date: {{date}}
📊 Statut: ⏳ En attente

Le dossier est en attente de décision du client.

{{comment}}

---
_Envoyé depuis DébalePro_`,

  annule: `📋 *MISE À JOUR DOSSIER*

👤 Client: *{{client_name}}*
📅 Date: {{date}}
📊 Statut: 🚫 Annulé

Le rendez-vous a été annulé.

{{comment}}

---
_Envoyé depuis DébalePro_`,
};

export const WhatsAppTemplates = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, Template>>({});

  useEffect(() => {
    loadTemplates();
  }, [user]);

  const loadTemplates = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error loading templates:", error);
    }

    // Initialize templates with defaults, overriding with saved ones
    const loadedTemplates: Record<string, Template> = {};
    CLASSIFICATIONS.forEach(({ key }) => {
      const saved = data?.find((t) => t.classification === key);
      loadedTemplates[key] = {
        classification: key,
        template_text: saved?.template_text || DEFAULT_TEMPLATES[key],
        is_active: saved?.is_active ?? true,
      };
    });

    setTemplates(loadedTemplates);
    setLoading(false);
  };

  const handleSave = async (classification: string) => {
    if (!user) return;

    setSaving(classification);
    const template = templates[classification];

    const { error } = await supabase.from("whatsapp_templates").upsert(
      {
        user_id: user.id,
        classification,
        template_text: template.template_text,
        is_active: template.is_active,
      },
      { onConflict: "user_id,classification" }
    );

    if (error) {
      console.error("Error saving template:", error);
      toast.error("Erreur lors de la sauvegarde");
    } else {
      // Silent save
    }

    setSaving(null);
  };

  const handleReset = (classification: string) => {
    setTemplates((prev) => ({
      ...prev,
      [classification]: {
        ...prev[classification],
        template_text: DEFAULT_TEMPLATES[classification],
      },
    }));
  };

  const handleChange = (classification: string, text: string) => {
    setTemplates((prev) => ({
      ...prev,
      [classification]: {
        ...prev[classification],
        template_text: text,
      },
    }));
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          Modèles de Messages WhatsApp
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Personnalisez les messages envoyés pour chaque statut. Variables disponibles:
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline">{"{{client_name}}"}</Badge>
          <Badge variant="outline">{"{{date}}"}</Badge>
          <Badge variant="outline">{"{{r2_date}}"}</Badge>
          <Badge variant="outline">{"{{cq_date}}"}</Badge>
          <Badge variant="outline">{"{{comment}}"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {CLASSIFICATIONS.map(({ key, label, color }) => (
          <div key={key} className="space-y-2 border-b pb-4 last:border-b-0">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${color}`} />
                {label}
              </Label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReset(key)}
                  title="Réinitialiser"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSave(key)}
                  disabled={saving === key}
                >
                  {saving === key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Textarea
              value={templates[key]?.template_text || ""}
              onChange={(e) => handleChange(key, e.target.value)}
              rows={8}
              className="font-mono text-sm"
              placeholder="Saisissez votre modèle de message..."
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
