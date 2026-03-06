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
      // Silent save
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header - compact on mobile */}
      <div className="text-center">
        <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-green-500/10 flex items-center justify-center mb-2 sm:mb-4">
          <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7 text-green-600" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold">Config WhatsApp</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
          Notifications RDV sur WhatsApp
        </p>
      </div>

      {/* Form - compact on mobile */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-md sm:rounded-lg bg-muted/50">
          <div>
            <Label className="text-xs sm:text-sm font-medium">Activer WhatsApp</Label>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Notifications confirmateur
            </p>
          </div>
          <Switch
            checked={settings.whatsapp_enabled}
            onCheckedChange={(checked) =>
              setSettings((s) => ({ ...s, whatsapp_enabled: checked }))
            }
          />
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="confirmateur_name" className="text-xs sm:text-sm">Nom confirmateur</Label>
          <Input
            id="confirmateur_name"
            placeholder="Ex: Jean Dupont"
            value={settings.confirmateur_name}
            onChange={(e) =>
              setSettings((s) => ({ ...s, confirmateur_name: e.target.value }))
            }
            className="h-9 sm:h-10 text-sm"
          />
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="confirmateur_phone" className="text-xs sm:text-sm">Numéro WhatsApp</Label>
          <Input
            id="confirmateur_phone"
            type="tel"
            placeholder="+33612345678"
            value={settings.confirmateur_phone}
            onChange={(e) =>
              setSettings((s) => ({ ...s, confirmateur_phone: e.target.value }))
            }
            className="h-9 sm:h-10 text-sm"
          />
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="default_cq_time" className="text-xs sm:text-sm">Heure CQ</Label>
          <Input
            id="default_cq_time"
            type="time"
            value={settings.default_cq_time}
            onChange={(e) =>
              setSettings((s) => ({ ...s, default_cq_time: e.target.value }))
            }
            className="h-9 sm:h-10 text-sm"
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-10 sm:h-11 touch-manipulation active:scale-[0.98] transition-transform"
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
