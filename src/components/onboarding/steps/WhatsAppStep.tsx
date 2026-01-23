import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { MessageCircle, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function WhatsAppStep() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    confirmateur_phone: "",
    confirmateur_name: "",
    whatsapp_enabled: true,
    default_cq_time: "10:00",
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("settings_notifications")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setSettings({
        confirmateur_phone: data.confirmateur_phone || "",
        confirmateur_name: data.confirmateur_name || "",
        whatsapp_enabled: data.whatsapp_enabled ?? true,
        default_cq_time: data.default_cq_time || "10:00",
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setSaved(false);

    const cleanPhone = settings.confirmateur_phone.replace(/\s/g, "");

    const { error } = await supabase.from("settings_notifications").upsert(
      {
        user_id: user.id,
        confirmateur_phone: cleanPhone,
        confirmateur_name: settings.confirmateur_name,
        whatsapp_enabled: settings.whatsapp_enabled,
        default_cq_time: settings.default_cq_time,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      setSaved(true);
      toast.success("Paramètres WhatsApp enregistrés");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto w-14 h-14 rounded-xl bg-green-500/10 flex items-center justify-center mb-4">
          <MessageCircle className="h-7 w-7 text-green-600" />
        </div>
        <h2 className="text-xl font-bold">Configuration WhatsApp</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Recevez les mises à jour de vos RDV directement sur WhatsApp
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <Label className="text-sm font-medium">Activer WhatsApp</Label>
            <p className="text-xs text-muted-foreground">
              Notifications au confirmateur
            </p>
          </div>
          <Switch
            checked={settings.whatsapp_enabled}
            onCheckedChange={(checked) =>
              setSettings((s) => ({ ...s, whatsapp_enabled: checked }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmateur_name">Nom du confirmateur</Label>
          <Input
            id="confirmateur_name"
            placeholder="Ex: Jean Dupont"
            value={settings.confirmateur_name}
            onChange={(e) =>
              setSettings((s) => ({ ...s, confirmateur_name: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmateur_phone">Numéro WhatsApp</Label>
          <Input
            id="confirmateur_phone"
            type="tel"
            placeholder="Ex: +33612345678"
            value={settings.confirmateur_phone}
            onChange={(e) =>
              setSettings((s) => ({ ...s, confirmateur_phone: e.target.value }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Format international avec indicatif pays
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="default_cq_time">Heure CQ par défaut</Label>
          <Input
            id="default_cq_time"
            type="time"
            value={settings.default_cq_time}
            onChange={(e) =>
              setSettings((s) => ({ ...s, default_cq_time: e.target.value }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Heure du contrôle qualité (statut Positif)
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full"
          variant={saved ? "outline" : "default"}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : saved ? (
            <Check className="h-4 w-4 mr-2 text-green-600" />
          ) : null}
          {saved ? "Enregistré ✓" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
