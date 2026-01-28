import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useWorkingDays } from "@/hooks/useWorkingDays";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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

  const handleToggleDay = async (dayValue: number) => {
    const isCurrentlyWorking = workingDays.includes(dayValue);
    
    let newWorkingDays: number[];
    if (isCurrentlyWorking) {
      // Remove the day
      newWorkingDays = workingDays.filter((d) => d !== dayValue);
    } else {
      // Add the day and sort
      newWorkingDays = [...workingDays, dayValue].sort((a, b) => {
        // Sort with Monday first (1,2,3,4,5,6,0)
        const order = [1, 2, 3, 4, 5, 6, 0];
        return order.indexOf(a) - order.indexOf(b);
      });
    }

    // Must have at least one working day
    if (newWorkingDays.length === 0) {
      toast.error("Vous devez avoir au moins un jour travaillé");
      return;
    }

    await updateWorkingDays(newWorkingDays);
    toast.success("Jours travaillés mis à jour");
  };

  return (
    <MobileLayout title="Jours travaillés">
      <div className="p-4 space-y-4 max-w-lg mx-auto">
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
                  const isChecked = workingDays.includes(day.value);
                  return (
                    <div
                      key={day.value}
                      className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
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
          💡 La vue semaine n'affichera que les jours travaillés. La vue mois grisera les jours non travaillés.
        </p>
      </div>
    </MobileLayout>
  );
};

export default WorkingDaysSettings;
