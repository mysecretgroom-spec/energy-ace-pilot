import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Clock, Save, Loader2 } from "lucide-react";

const VentesSettings = () => {
  const { user } = useAuth();
  const [transitionWeeks, setTransitionWeeks] = useState(2);
  const [originalTransitionWeeks, setOriginalTransitionWeeks] = useState(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const hasChanges = transitionWeeks !== originalTransitionWeeks;

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select("vente_auto_transition_weeks")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const weeks = data.vente_auto_transition_weeks || 2;
        setTransitionWeeks(weeks);
        setOriginalTransitionWeeks(weeks);
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
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

      if (error) throw error;

      toast.success("Paramètres enregistrés");
      setOriginalTransitionWeeks(transitionWeeks);
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
      <div className="p-4 space-y-6 pb-8">
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
      </div>

      {/* Fixed bottom bar with save button */}
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 z-50 transition-all duration-300 ease-out ${
          hasChanges 
            ? "translate-y-0 opacity-100" 
            : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </MobileLayout>
  );
};

export default VentesSettings;
