import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, CalendarIcon } from "lucide-react";

interface TimePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTime: string;
  targetDate: Date;
  clientName: string;
  onConfirm: (newTime: string) => void;
  /** Called when date+time are confirmed; if provided, date picker is shown */
  onConfirmWithDate?: (newDate: Date, newTime: string) => void;
  /** Allow changing the date (used from context menu move) */
  allowDateChange?: boolean;
}

// Generate time slots from 08:00 to 20:00 in 30-minute intervals
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 8; hour <= 20; hour++) {
    slots.push(`${hour.toString().padStart(2, "0")}:00`);
    if (hour < 20) {
      slots.push(`${hour.toString().padStart(2, "0")}:30`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

export function TimePickerDialog({
  open,
  onOpenChange,
  currentTime,
  targetDate,
  clientName,
  onConfirm,
  onConfirmWithDate,
  allowDateChange = false,
}: TimePickerDialogProps) {
  const [selectedTime, setSelectedTime] = useState(currentTime);
  const [selectedDate, setSelectedDate] = useState<Date>(targetDate);

  const handleConfirm = () => {
    if (onConfirmWithDate) {
      onConfirmWithDate(selectedDate, selectedTime);
    } else {
      onConfirm(selectedTime);
    }
    onOpenChange(false);
  };

  const handleKeepTime = () => {
    if (onConfirmWithDate) {
      onConfirmWithDate(selectedDate, currentTime);
    } else {
      onConfirm(currentTime);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Déplacer le RDV
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{clientName}</span>
            {!allowDateChange && (
              <>
                <br />
                Déplacé au{" "}
                <span className="font-medium text-foreground">
                  {format(targetDate, "EEEE d MMMM", { locale: fr })}
                </span>
              </>
            )}
          </div>

          {/* Date picker - shown when allowDateChange */}
          {allowDateChange && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                Nouvelle date
              </label>
              <div className="flex justify-center border rounded-lg p-1">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  locale={fr}
                  className="pointer-events-auto"
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Nouvelle heure</label>
            <Select value={selectedTime} onValueChange={setSelectedTime}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une heure" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {TIME_SLOTS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                    {time === currentTime && (
                      <span className="ml-2 text-muted-foreground">
                        (actuel)
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleKeepTime} className="w-full sm:w-auto">
            Garder {currentTime}
          </Button>
          <Button onClick={handleConfirm} className="w-full sm:w-auto">
            Confirmer {selectedTime}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
