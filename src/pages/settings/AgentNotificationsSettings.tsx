import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Bot, Bell, CalendarClock, TrendingUp, Brain, MessageCircle } from "lucide-react";
import { FloatingSaveButton } from "@/components/ui/floating-save-button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AgentSettings {
  rdv_prep_enabled: boolean;
  rdv_prep_minutes_before: number;
  rdv_prep_whatsapp: boolean;
  pipeline_alerts_enabled: boolean;
  pipeline_stale_days: number;
  coaching_enabled: boolean;
  daily_briefing_whatsapp: boolean;
}

const DEFAULT_SETTINGS: AgentSettings = {
  rdv_prep_enabled: true,
  rdv_prep_minutes_before: 60,
  rdv_prep_whatsapp: true,
  pipeline_alerts_enabled: true,
  pipeline_stale_days: 5,
  coaching_enabled: true,
  daily_briefing_whatsapp: true,
};

const AgentNotificationsSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS);
  const [original, setOriginal] = useState<AgentSettings>(DEFAULT_SETTINGS);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(original);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("user_settings")
        .select("rdv_prep_enabled, rdv_prep_minutes_before, rdv_prep_whatsapp, pipeline_alerts_enabled, pipeline_stale_days, coaching_enabled, daily_briefing_whatsapp")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        const loaded: AgentSettings = {
          rdv_prep_enabled: data.rdv_prep_enabled ?? true,
          rdv_prep_minutes_before: data.rdv_prep_minutes_before ?? 60,
          rdv_prep_whatsapp: data.rdv_prep_whatsapp ?? true,
          pipeline_alerts_enabled: data.pipeline_alerts_enabled ?? true,
          pipeline_stale_days: data.pipeline_stale_days ?? 5,
          coaching_enabled: data.coaching_enabled ?? true,
          daily_briefing_whatsapp: data.daily_briefing_whatsapp ?? true,
        };
        setSettings(loaded);
        setOriginal(loaded);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("user_settings")
      .update({
        rdv_prep_enabled: settings.rdv_prep_enabled,
        rdv_prep_minutes_before: settings.rdv_prep_minutes_before,
        rdv_prep_whatsapp: settings.rdv_prep_whatsapp,
        pipeline_alerts_enabled: settings.pipeline_alerts_enabled,
        pipeline_stale_days: settings.pipeline_stale_days,
        coaching_enabled: settings.coaching_enabled,
        daily_briefing_whatsapp: settings.daily_briefing_whatsapp,
      })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      // Silent save
      setOriginal({ ...settings });
    }
    setSaving(false);
  };

  const update = <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  if (loading) {
    return (
      <MobileLayout title="Notifications Agent" showBackButton>
        <div className="p-4 flex items-center justify-center h-40">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Notifications Agent" showBackButton>
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-green-500/10">
            <Bot className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Messages proactifs</h2>
            <p className="text-xs text-muted-foreground">L'agent vous contacte automatiquement par WhatsApp</p>
          </div>
        </div>

        {/* Briefing quotidien */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Briefing quotidien
            </CardTitle>
            <CardDescription className="text-xs">
              Résumé matinal de vos RDV et tâches du jour
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Envoyer par WhatsApp</Label>
              <Switch
                checked={settings.daily_briefing_whatsapp}
                onCheckedChange={(v) => update("daily_briefing_whatsapp", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Préparation RDV */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-blue-600" />
              Préparation RDV
            </CardTitle>
            <CardDescription className="text-xs">
              Brief automatique avant chaque RDV : client, conso, docs manquants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Activer</Label>
              <Switch
                checked={settings.rdv_prep_enabled}
                onCheckedChange={(v) => update("rdv_prep_enabled", v)}
              />
            </div>
            {settings.rdv_prep_enabled && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Délai avant RDV</Label>
                  <Select
                    value={String(settings.rdv_prep_minutes_before)}
                    onValueChange={(v) => update("rdv_prep_minutes_before", parseInt(v))}
                  >
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="60">1 heure</SelectItem>
                      <SelectItem value="120">2 heures</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Envoyer par WhatsApp</Label>
                  <Switch
                    checked={settings.rdv_prep_whatsapp}
                    onCheckedChange={(v) => update("rdv_prep_whatsapp", v)}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Suivi pipeline */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-600" />
              Suivi pipeline
            </CardTitle>
            <CardDescription className="text-xs">
              Alertes pour dossiers bloqués trop longtemps dans une étape
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Activer les alertes</Label>
              <Switch
                checked={settings.pipeline_alerts_enabled}
                onCheckedChange={(v) => update("pipeline_alerts_enabled", v)}
              />
            </div>
            {settings.pipeline_alerts_enabled && (
              <div className="flex items-center justify-between">
                <Label className="text-sm">Seuil d'alerte</Label>
                <Select
                  value={String(settings.pipeline_stale_days)}
                  onValueChange={(v) => update("pipeline_stale_days", parseInt(v))}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 jours</SelectItem>
                    <SelectItem value="5">5 jours</SelectItem>
                    <SelectItem value="7">7 jours</SelectItem>
                    <SelectItem value="10">10 jours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coaching */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-600" />
              Coaching performance
            </CardTitle>
            <CardDescription className="text-xs">
              Analyse de vos stats et conseils personnalisés via l'agent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Activer le coaching</Label>
              <Switch
                checked={settings.coaching_enabled}
                onCheckedChange={(v) => update("coaching_enabled", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <MessageCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
            <span>
              L'agent utilise votre numéro de profil pour envoyer les messages WhatsApp. Assurez-vous qu'il est renseigné dans votre profil.
            </span>
          </p>
        </div>

        <FloatingSaveButton
          show={hasChanges}
          saving={saving}
          onSave={handleSave}
        />
      </div>
    </MobileLayout>
  );
};

export default AgentNotificationsSettings;
