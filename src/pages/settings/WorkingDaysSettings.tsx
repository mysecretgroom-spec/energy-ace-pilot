import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useWorkingDays } from "@/hooks/useWorkingDays";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

const DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
];

const WorkingDaysSettings = () => {
  const { workingDays, loading, updateWorkingDays } = useWorkingDays();
  const [localDays, setLocalDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize local state when workingDays loads
  useEffect(() => {
    if (!loading && workingDays) {
      setLocalDays(workingDays);
    }
  }, [workingDays, loading]);

  // Check for changes
  useEffect(() => {
    if (!loading) {
      const changed = JSON.stringify(localDays.sort((a, b) => a - b)) !== 
                      JSON.stringify(workingDays.sort((a, b) => a - b));
      setHasChanges(changed);
    }
  }, [localDays, workingDays, loading]);

  const handleToggleDay = (dayValue: number) => {
    const isCurrentlySelected = localDays.includes(dayValue);
    
    let newDays: number[];
    if (isCurrentlySelected) {
      // Remove the day
      newDays = localDays.filter((d) => d !== dayValue);
    } else {
      // Add the day
      newDays = [...localDays, dayValue];
    }

    // Must have at least one working day
    if (newDays.length === 0) {
      toast.error("Vous devez avoir au moins un jour travaillé");
      return;
    }

    setLocalDays(newDays);
  };

  const handleSave = async () => {
    setSaving(true);
    
    // Sort days in order (Monday first: 1,2,3,4,5,6,0)
    const sortedDays = [...localDays].sort((a, b) => {
      const order = [1, 2, 3, 4, 5, 6, 0];
      return order.indexOf(a) - order.indexOf(b);
    });

    const success = await updateWorkingDays(sortedDays);
    
    setSaving(false);
    
    if (success) {
      toast.success("Jours travaillés enregistrés", {
        description: "Le planning sera mis à jour"
      });
      setHasChanges(false);
    } else {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  return (
    <MobileLayout title="Jours travaillés">
      <div className="p-4 space-y-4 max-w-lg mx-auto pb-32">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Jours travaillés</CardTitle>
            <CardDescription>
              Sélectionnez les jours que vous travaillez. Ces jours seront affichés dans la vue semaine et les autres jours seront grisés dans la vue mois.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {DAYS.map((day) => {
                  const isChecked = localDays.includes(day.value);
                  return (
                    <div
                      key={day.value}
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        isChecked 
                          ? "bg-primary/5 border-primary/30" 
                          : "bg-card hover:bg-muted/50"
                      }`}
                      onClick={() => handleToggleDay(day.value)}
                    >
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={isChecked}
                        onCheckedChange={() => handleToggleDay(day.value)}
                        className="h-5 w-5"
                      />
                      <Label
                        htmlFor={`day-${day.value}`}
                        className="flex-1 cursor-pointer text-base font-medium"
                      >
                        {day.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center px-4">
          La vue semaine n'affichera que les jours travaillés. La vue mois grisera les jours non travaillés.
        </p>
      </div>

      {/* Floating save button */}
      {hasChanges && (
        <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom)+1rem)] left-4 right-4 z-40 max-w-lg mx-auto">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 shadow-lg bg-gradient-hero gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                Enregistrer les modifications
              </>
            )}
          </Button>
        </div>
      )}
    </MobileLayout>
  );
};

export default WorkingDaysSettings;
