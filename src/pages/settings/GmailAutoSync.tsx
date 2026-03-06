import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingSaveButton } from "@/components/ui/floating-save-button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ArrowLeft, Mail, Clock, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface UserSettings {
  gmail_sync_enabled: boolean;
  gmail_sync_interval_minutes: number;
  gmail_last_auto_sync: string | null;
}

export default function GmailAutoSync() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    gmail_sync_enabled: false,
    gmail_sync_interval_minutes: 15,
    gmail_last_auto_sync: null
  });
  const [originalSettings, setOriginalSettings] = useState<UserSettings>({
    gmail_sync_enabled: false,
    gmail_sync_interval_minutes: 15,
    gmail_last_auto_sync: null
  });
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [hasAuthorizedEmails, setHasAuthorizedEmails] = useState(false);

  // Détecter les modifications
  const hasChanges = settings.gmail_sync_enabled !== originalSettings.gmail_sync_enabled ||
    settings.gmail_sync_interval_minutes !== originalSettings.gmail_sync_interval_minutes;

  useEffect(() => {
    if (user) {
      loadSettings();
      checkPrerequisites();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select("gmail_sync_enabled, gmail_sync_interval_minutes, gmail_last_auto_sync")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
        setOriginalSettings(data);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkPrerequisites = async () => {
    if (!user) return;

    try {
      // Check Google connection
      const { data: googleToken } = await supabase
        .from("google_tokens")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      setIsGoogleConnected(!!googleToken);

      // Check authorized emails
      const { data: emails } = await supabase
        .from("emails_autorises")
        .select("id")
        .eq("user_id", user.id)
        .eq("actif", true)
        .limit(1);

      setHasAuthorizedEmails(!!emails?.length);
    } catch (error) {
      console.error("Error checking prerequisites:", error);
    }
  };

  const saveSettings = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_settings")
        .upsert({
          user_id: user.id,
          gmail_sync_enabled: settings.gmail_sync_enabled,
          gmail_sync_interval_minutes: settings.gmail_sync_interval_minutes
        }, {
          onConflict: "user_id"
        });

      if (error) throw error;

      // Silent save
      setOriginalSettings({ ...settings });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const canEnable = isGoogleConnected && hasAuthorizedEmails;

  if (loading) {
    return (
      <MobileLayout title="Sync Gmail Auto" showBackButton>
        <div className="p-4 pb-8 space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Sync Gmail Auto" showBackButton>
      <div className="p-4 pb-24 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/parametres")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Synchronisation Gmail</h1>
            <p className="text-sm text-muted-foreground">Import automatique des RDV</p>
          </div>
        </div>

        {/* Prerequisites */}
        {!canEnable && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Prérequis manquants :</p>
                  <ul className="space-y-1">
                    {!isGoogleConnected && (
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 bg-amber-500 rounded-full" />
                        <span>Connectez votre compte Google</span>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="h-auto p-0 text-primary"
                          onClick={() => navigate("/parametres")}
                        >
                          Connecter
                        </Button>
                      </li>
                    )}
                    {!hasAuthorizedEmails && (
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 bg-amber-500 rounded-full" />
                        <span>Configurez les emails autorisés</span>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="h-auto p-0 text-primary"
                          onClick={() => navigate("/parametres/regies")}
                        >
                          Configurer
                        </Button>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Settings */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Synchronisation automatique</CardTitle>
                  <CardDescription>
                    Importe automatiquement les RDV depuis Gmail
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={settings.gmail_sync_enabled}
                onCheckedChange={(checked) => setSettings(prev => ({ 
                  ...prev, 
                  gmail_sync_enabled: checked 
                }))}
                disabled={!canEnable}
              />
            </div>
          </CardHeader>
          
          {settings.gmail_sync_enabled && canEnable && (
            <CardContent className="space-y-6 pt-0">
              {/* Interval Slider */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Intervalle de synchronisation
                  </Label>
                  <Badge variant="secondary" className="font-mono">
                    {settings.gmail_sync_interval_minutes} min
                  </Badge>
                </div>
                <Slider
                  value={[settings.gmail_sync_interval_minutes]}
                  onValueChange={([value]) => setSettings(prev => ({
                    ...prev,
                    gmail_sync_interval_minutes: value
                  }))}
                  min={5}
                  max={60}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5 min</span>
                  <span>30 min</span>
                  <span>60 min</span>
                </div>
              </div>

              {/* Last Sync Info */}
              {settings.gmail_last_auto_sync && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>
                    Dernière sync auto : {format(new Date(settings.gmail_last_auto_sync), "dd MMM à HH:mm", { locale: fr })}
                  </span>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 text-sm">
              <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1 text-muted-foreground">
                <p>
                  Le système vérifie automatiquement votre boîte Gmail à l'intervalle défini 
                  et importe les emails provenant des expéditeurs autorisés.
                </p>
                <p>
                  Seuls les emails des 7 derniers jours non encore traités sont importés.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <FloatingSaveButton
        show={hasChanges && canEnable}
        saving={saving}
        onSave={saveSettings}
      />
    </MobileLayout>
  );
}
