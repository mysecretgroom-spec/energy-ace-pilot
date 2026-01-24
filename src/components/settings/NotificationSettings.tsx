import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { MessageCircle, Save, Loader2, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface NotificationSettings {
  id?: string;
  whatsapp_enabled: boolean;
  skip_whatsapp_prompt: boolean;
}

export const NotificationSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    whatsapp_enabled: true,
    skip_whatsapp_prompt: false,
  });
  const [originalSettings, setOriginalSettings] = useState<NotificationSettings>({
    whatsapp_enabled: true,
    skip_whatsapp_prompt: false,
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const loadSettings = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data } = await supabase
      .from("settings_notifications")
      .select("id, whatsapp_enabled, skip_whatsapp_prompt")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      const loadedSettings = {
        id: data.id,
        whatsapp_enabled: data.whatsapp_enabled ?? true,
        skip_whatsapp_prompt: data.skip_whatsapp_prompt ?? false,
      };
      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    
    const settingsData = {
      user_id: user.id,
      whatsapp_enabled: settings.whatsapp_enabled,
      skip_whatsapp_prompt: settings.skip_whatsapp_prompt,
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
      toast.success("Préférences enregistrées");
      setOriginalSettings({ ...settings });
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
          <Settings className="h-5 w-5 text-primary" />
          Préférences WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Activer les notifications WhatsApp</Label>
            <p className="text-xs text-muted-foreground">
              Proposer l'envoi WhatsApp lors des changements de statut
            </p>
          </div>
          <Switch
            checked={settings.whatsapp_enabled}
            onCheckedChange={(checked) =>
              setSettings((s) => ({ ...s, whatsapp_enabled: checked }))
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Ne plus demander de confirmation</Label>
            <p className="text-xs text-muted-foreground">
              Désactiver le dialogue de confirmation WhatsApp
            </p>
          </div>
          <Switch
            checked={settings.skip_whatsapp_prompt}
            onCheckedChange={(checked) =>
              setSettings((s) => ({ ...s, skip_whatsapp_prompt: checked }))
            }
          />
        </div>

        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <MessageCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
            <span>
              Le numéro WhatsApp du confirmateur est configuré dans les paramètres de chaque régie (contact principal).
            </span>
          </p>
        </div>

        <div 
          className={`transition-all duration-300 ease-out overflow-hidden ${
            hasChanges 
              ? "max-h-20 opacity-100" 
              : "max-h-0 opacity-0"
          }`}
        >
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
        </div>
      </CardContent>
    </Card>
  );
};
