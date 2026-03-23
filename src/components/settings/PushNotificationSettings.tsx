import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FloatingSaveButton } from "@/components/ui/floating-save-button";
import { 
  Bell, 
  BellOff, 
  Loader2, 
  Calendar, 
  TrendingUp, 
  Mail, 
  Clock,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOneSignal } from "@/hooks/useOneSignal";
import { toast } from "sonner";

interface PushPreferences {
  push_enabled: boolean;
  push_new_rdv: boolean;
  push_vente_status: boolean;
  push_rappel_rdv: boolean;
  push_gmail_import: boolean;
}

export const PushNotificationSettings = () => {
  const { user } = useAuth();
  const { 
    isInitialized, 
    isSubscribed, 
    permission, 
    requestPermission, 
    unsubscribe,
    isSupported 
  } = useOneSignal();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [preferences, setPreferences] = useState<PushPreferences>({
    push_enabled: true,
    push_new_rdv: true,
    push_vente_status: true,
    push_rappel_rdv: true,
    push_gmail_import: true,
  });
  const [originalPreferences, setOriginalPreferences] = useState<PushPreferences>({
    push_enabled: true,
    push_new_rdv: true,
    push_vente_status: true,
    push_rappel_rdv: true,
    push_gmail_import: true,
  });

  // Détecter les modifications
  const hasChanges = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);

  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("user_settings")
      .select("push_enabled, push_new_rdv, push_vente_status, push_rappel_rdv, push_gmail_import")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      const loadedPrefs = {
        push_enabled: data.push_enabled ?? true,
        push_new_rdv: data.push_new_rdv ?? true,
        push_vente_status: data.push_vente_status ?? true,
        push_rappel_rdv: data.push_rappel_rdv ?? true,
        push_gmail_import: data.push_gmail_import ?? true,
      };
      setPreferences(loadedPrefs);
      setOriginalPreferences(loadedPrefs);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);

    const { error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: user.id,
        ...preferences,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) {
      console.error("Error saving preferences:", error);
      toast.error("Erreur lors de la sauvegarde");
    } else {
      // Silent save
    }
    
    setSaving(false);
  };

  const handleEnableNotifications = async () => {
    setRequesting(true);
    try {
      const granted = await requestPermission();
      if (granted) {
        toast.success("Notifications activées !");
        setPreferences(p => ({ ...p, push_enabled: true }));
      } else {
        toast.error("Permission refusée");
      }
    } finally {
      setRequesting(false);
    }
  };

  const handleDisableNotifications = async () => {
    await unsubscribe();
    setPreferences(p => ({ ...p, push_enabled: false }));
    await handleSave();
    toast.success("Notifications désactivées");
  };

  const notificationTypes = [
    {
      key: "push_new_rdv" as const,
      label: "Nouveaux RDV",
      description: "Quand un nouveau RDV est créé manuellement",
      icon: Calendar,
    },
    {
      key: "push_gmail_import" as const,
      label: "Import Gmail",
      description: "Quand des RDV sont importés depuis Gmail",
      icon: Mail,
    },
    {
      key: "push_vente_status" as const,
      label: "Statut des ventes",
      description: "Changements de statut (signé, installé, payé)",
      icon: TrendingUp,
    },
    {
      key: "push_rappel_rdv" as const,
      label: "Rappels RDV",
      description: "Rappels avant vos rendez-vous",
      icon: Clock,
    },
  ];

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
          <Bell className="h-5 w-5 text-primary" />
          Notifications Push
        </CardTitle>
        <CardDescription>
          Recevez des alertes même quand l'application est fermée
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Section */}
        {!isSupported ? (
          <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                Non supporté
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-300">
                Les notifications push ne sont pas supportées sur ce navigateur.
              </p>
            </div>
          </div>
        ) : !isInitialized ? (
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Initialisation...</span>
          </div>
        ) : permission === "denied" ? (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <BellOff className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Notifications bloquées
              </p>
              <p className="text-xs text-red-600 dark:text-red-300">
                Vous avez bloqué les notifications. Pour les réactiver, modifiez les paramètres de votre navigateur.
              </p>
            </div>
          </div>
        ) : isSubscribed && preferences.push_enabled ? (
          <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Notifications activées
              </p>
              <p className="text-xs text-green-600 dark:text-green-300">
                Vous recevrez des alertes même quand l'app est fermée.
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDisableNotifications}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <BellOff className="h-4 w-4 mr-1" />
              Désactiver
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Activez les notifications pour recevoir des alertes instantanées.
            </p>
            <Button 
              onClick={handleEnableNotifications}
              disabled={requesting}
              className="w-full"
            >
              {requesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Activation...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-2" />
                  Activer les notifications push
                </>
              )}
            </Button>
          </div>
        )}

        {/* Notification Types - only show if enabled */}
        {isSubscribed && preferences.push_enabled && (
          <>
            <Separator />
            
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground">
                Types de notifications
              </h4>
              
              {notificationTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <div key={type.key} className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">{type.label}</Label>
                        <p className="text-xs text-muted-foreground">
                          {type.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={preferences[type.key]}
                      onCheckedChange={(checked) =>
                        setPreferences((p) => ({ ...p, [type.key]: checked }))
                      }
                    />
                  </div>
                );
              })}
            </div>

            <FloatingSaveButton
              show={hasChanges}
              saving={saving}
              onSave={handleSave}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};
