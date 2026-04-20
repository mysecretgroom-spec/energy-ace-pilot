import { useState } from "react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { GmailSyncOptions } from "@/hooks/useGmailSync";

type PeriodType = "3" | "7" | "14" | "30" | "custom";

interface GmailSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSync: (options: GmailSyncOptions) => Promise<void>;
  syncing: boolean;
}

export function GmailSyncDialog({
  open,
  onOpenChange,
  onSync,
  syncing,
}: GmailSyncDialogProps) {
  const [periodType, setPeriodType] = useState<PeriodType>("7");
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());

  const handleSync = async () => {
    let options: GmailSyncOptions = {};

    if (periodType === "custom" && fromDate && toDate) {
      // Format dates as YYYY/MM/DD for Gmail API
      options = {
        fromDate: format(fromDate, "yyyy/MM/dd"),
        toDate: format(toDate, "yyyy/MM/dd"),
      };
    } else {
      options = { days: parseInt(periodType) };
    }

    await onSync(options);
    onOpenChange(false);
  };

  const periodOptions = [
    { value: "3", label: "3 derniers jours" },
    { value: "7", label: "7 derniers jours" },
    { value: "14", label: "14 derniers jours" },
    { value: "30", label: "30 derniers jours" },
    { value: "custom", label: "Période personnalisée" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Synchroniser Gmail
          </DialogTitle>
          <DialogDescription>
            Choisissez la période de recherche pour importer les RDV depuis vos emails.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Période de recherche</Label>
            <RadioGroup
              value={periodType}
              onValueChange={(value) => setPeriodType(value as PeriodType)}
              className="space-y-2"
            >
              {periodOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={`period-${option.value}`} />
                  <Label
                    htmlFor={`period-${option.value}`}
                    className="font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {periodType === "custom" && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label>Du</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !fromDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {fromDate ? (
                        format(fromDate, "dd/MM/yyyy", { locale: fr })
                      ) : (
                        <span>Date début</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={fromDate}
                      onSelect={setFromDate}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Au</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !toDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {toDate ? (
                        format(toDate, "dd/MM/yyyy", { locale: fr })
                      ) : (
                        <span>Date fin</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={toDate}
                      onSelect={setToDate}
                      disabled={(date) =>
                        date > new Date() || (fromDate ? date < fromDate : false)
                      }
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSync}
            disabled={syncing || (periodType === "custom" && (!fromDate || !toDate))}
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Synchronisation...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Synchroniser
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
