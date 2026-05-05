import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths, isSameMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface PeriodValue {
  start: Date;
  end: Date;
  /** "month" → un mois sélectionné dans la liste, "custom" → plage libre */
  mode: "month" | "custom";
  label: string;
}

export function makeMonthPeriod(date: Date): PeriodValue {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
    mode: "month",
    label: format(date, "MMMM yyyy", { locale: fr }),
  };
}

interface PeriodFilterProps {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  className?: string;
  /** Nombre de mois proposés dans la liste (par défaut 12). */
  monthsCount?: number;
}

export function PeriodFilter({
  value,
  onChange,
  className,
  monthsCount = 12,
}: PeriodFilterProps) {
  const [monthOpen, setMonthOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);

  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: monthsCount }, (_, i) => subMonths(now, i));
  }, [monthsCount]);

  const handleSelectMonth = (date: Date) => {
    onChange(makeMonthPeriod(date));
    setMonthOpen(false);
  };

  const handleSelectRange = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range?.from) return;
    const from = range.from;
    const to = range.to ?? range.from;
    onChange({
      start: from,
      end: to,
      mode: "custom",
      label: `${format(from, "d MMM", { locale: fr })} → ${format(to, "d MMM yyyy", { locale: fr })}`,
    });
    if (range.to) setRangeOpen(false);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Sélecteur de mois */}
      <Popover open={monthOpen} onOpenChange={setMonthOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 justify-between gap-2 flex-1 min-w-[140px]",
              value.mode === "month" && "border-primary/50"
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <CalendarIcon className="h-4 w-4 shrink-0" />
              <span className="truncate capitalize">
                {value.mode === "month" ? value.label : "Choisir un mois"}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandList>
              <CommandEmpty>Aucun mois</CommandEmpty>
              <CommandGroup>
                {months.map((m) => {
                  const selected = value.mode === "month" && isSameMonth(m, value.start);
                  return (
                    <CommandItem
                      key={m.toISOString()}
                      onSelect={() => handleSelectMonth(m)}
                      className={cn("capitalize", selected && "bg-accent")}
                    >
                      {format(m, "MMMM yyyy", { locale: fr })}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Sélecteur de plage personnalisée */}
      <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 justify-between gap-2 flex-1 min-w-[140px]",
              value.mode === "custom" && "border-primary/50"
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <CalendarIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {value.mode === "custom" ? value.label : "Période précise"}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={value.mode === "custom" ? { from: value.start, to: value.end } : undefined}
            onSelect={handleSelectRange}
            numberOfMonths={1}
            locale={fr}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
