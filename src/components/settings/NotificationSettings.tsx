import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { MessageCircle, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface NotificationSettings {
  id?: string;
  confirmateur_phone: string;
  confirmateur_name: string;
  whatsapp_enabled: boolean;
  default_cq_time: string;
}

export const NotificationSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
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
    
    setLoading(true);
    const { data, error } = await supabase
      .from("settings_notifications")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setSettings({
        id: data.id,
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
    
    // Clean phone number (remove spaces, keep + if present)
    const cleanPhone = settings.confirmateur_phone.replace(/\s/g, "");
    
    const settingsData = {
      user_id: user.id,
      confirmateur_phone: cleanPhone,
      confirmateur_name: settings.confirmateur_name,
      whatsapp_enabled: settings.whatsapp_enabled,
      default_cq_time: settings.default_cq_time,
    };

    let error;
    if (settings.id) {
      const result = await supabase
        .from("settings_notifications")
        .update(settingsData)
        .eq("id", settings.id);
      error = result.error;
    } else {
      const result = await supabase
        .from("settings_notifications")
        .insert(settingsData);
      error = result.error;
    }

    if (error) {
      console.error("Error saving settings:", error);
      toast.error("Erreur lors de la sauvegarde");
    } else {
      toast.success("Paramètres enregistrés");
      loadSettings();
    }
    
    setSaving(false);
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
          <MessageCircle className="h-5 w-5 text-primary" />
          Envoi WhatsApp Confirmateur
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Activer l'envoi WhatsApp</Label>
            <p className="text-xs text-muted-foreground">
              Envoyer un message au confirmateur à chaque mise à jour de classification
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
            Format international avec indicatif pays (ex: +33 pour la France)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="default_cq_time">Heure par défaut du CQ (Positif)</Label>
          <Input
            id="default_cq_time"
            type="time"
            value={settings.default_cq_time}
            onChange={(e) =>
              setSettings((s) => ({ ...s, default_cq_time: e.target.value }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Heure du Contrôle Qualité prévu le lendemain (statut Positif)
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Enregistrer
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
