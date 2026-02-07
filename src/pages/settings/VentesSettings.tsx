import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FloatingSaveButton } from "@/components/ui/floating-save-button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Clock, Bell, Building2 } from "lucide-react";

const VentesSettings = () => {
  const { user } = useAuth();
  const [transitionWeeks, setTransitionWeeks] = useState(2);
  const [relanceEnabled, setRelanceEnabled] = useState(false);
  const [relanceDelayDays, setRelanceDelayDays] = useState(14);
  const [weeklyRecapEnabled, setWeeklyRecapEnabled] = useState(true);

  const [original, setOriginal] = useState({
    transitionWeeks: 2,
    relanceEnabled: false,
    relanceDelayDays: 14,
    weeklyRecapEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const hasChanges = 
    transitionWeeks !== original.transitionWeeks ||
    relanceEnabled !== original.relanceEnabled ||
    relanceDelayDays !== original.relanceDelayDays ||
    weeklyRecapEnabled !== original.weeklyRecapEnabled;

  useEffect(() => {
    if (user) fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select("vente_auto_transition_weeks, relance_paiement_enabled, relance_paiement_delay_days, weekly_recap_enabled")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const vals = {
          transitionWeeks: data.vente_auto_transition_weeks || 2,
          relanceEnabled: data.relance_paiement_enabled || false,
          relanceDelayDays: data.relance_paiement_delay_days || 14,
          weeklyRecapEnabled: data.weekly_recap_enabled ?? true,
        };
        setTransitionWeeks(vals.transitionWeeks);
        setRelanceEnabled(vals.relanceEnabled);
        setRelanceDelayDays(vals.relanceDelayDays);
        setWeeklyRecapEnabled(vals.weeklyRecapEnabled);
        setOriginal(vals);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_settings")
        .upsert({
          user_id: user.id,
          vente_auto_transition_weeks: transitionWeeks,
          relance_paiement_enabled: relanceEnabled,
          relance_paiement_delay_days: relanceDelayDays,
          weekly_recap_enabled: weeklyRecapEnabled,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (error) throw error;
      toast.success("Paramètres enregistrés");
      setOriginal({ transitionWeeks, relanceEnabled, relanceDelayDays, weeklyRecapEnabled });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MobileLayout title="Paramètres Ventes" showBackButton>
        <div className="p-4 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Paramètres Ventes" showBackButton>
      <div className="p-4 space-y-6 pb-24">
        {/* Transition automatique */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-primary" />
              Transition automatique des statuts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transitionWeeks">
                Délai avant passage de "Posé" à "Attente paiement"
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="transitionWeeks"
                  type="number"
                  min={1}
                  max={52}
                  value={transitionWeeks}
                  onChange={(e) => setTransitionWeeks(parseInt(e.target.value) || 2)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">semaine(s)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Après ce délai, les ventes au statut "Posé" passeront automatiquement 
                à "En attente de paiement" si elles ont une date d'installation renseignée.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Relance paiement régie */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-amber-500" />
              Relance paiement régie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Activer les relances</Label>
                <p className="text-xs text-muted-foreground">
                  Notification automatique quand les régies tardent à payer
                </p>
              </div>
              <Switch
                checked={relanceEnabled}
                onCheckedChange={setRelanceEnabled}
              />
            </div>
            {relanceEnabled && (
              <div className="space-y-2">
                <Label htmlFor="relanceDelay">
                  Délai avant relance
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="relanceDelay"
                    type="number"
                    min={7}
                    max={90}
                    value={relanceDelayDays}
                    onChange={(e) => setRelanceDelayDays(parseInt(e.target.value) || 14)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">jours</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Vous recevrez une notification listant les ventes en attente de paiement 
                  depuis plus de ce délai, groupées par régie.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Récap hebdomadaire */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5 text-primary" />
              Récap hebdomadaire
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Activer le récap vendredi</Label>
                <p className="text-xs text-muted-foreground">
                  Chaque vendredi à 13h, recevez un bilan de votre semaine 
                  (RDV, ventes, CA, taux de transformation)
                </p>
              </div>
              <Switch
                checked={weeklyRecapEnabled}
                onCheckedChange={setWeeklyRecapEnabled}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <FloatingSaveButton
        show={hasChanges}
        saving={saving}
        onSave={handleSave}
      />
    </MobileLayout>
  );
};

export default VentesSettings;
