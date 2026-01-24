import { useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { RdvStatus } from "@/components/ui/status-badge";
import { Wrench, RefreshCw } from "lucide-react";

interface RdvData {
  id: string;
  time: string;
  date: Date;
  client: string;
  clientId: string;
  status: RdvStatus;
  type: string;
  typeRdv: 'standard' | 'external_installation';
  isR2?: boolean;
  etudeId?: string | null;
}

interface MonthCalendarViewProps {
  currentDate: Date;
  rdvList: RdvData[];
  onDayClick?: (date: Date) => void;
}

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function MonthCalendarView({
  currentDate,
  rdvList,
  onDayClick,
}: MonthCalendarViewProps) {
  // Calculate calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentDate]);

  // Group RDVs by day
  const rdvsByDay = useMemo(() => {
    const grouped: Record<string, RdvData[]> = {};
    rdvList.forEach((rdv) => {
      const key = format(rdv.date, "yyyy-MM-dd");
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(rdv);
    });
    return grouped;
  }, [rdvList]);

  const today = new Date();

  // Split days into weeks (rows of 7)
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  const getStatusColor = (rdvs: RdvData[]) => {
    if (rdvs.some((r) => r.status === "signe")) return "bg-green-500";
    if (rdvs.some((r) => r.status === "negatif" || r.status === "annule"))
      return "bg-red-500";
    if (rdvs.some((r) => r.isR2)) return "bg-status-r2";
    if (rdvs.some((r) => r.typeRdv === "external_installation"))
      return "bg-amber-500";
    return "bg-primary";
  };

  return (
    <div className="space-y-1">
      {/* Day names header */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="text-center py-2 text-xs font-semibold text-muted-foreground"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7 gap-1">
          {week.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayRdvs = rdvsByDay[dayKey] || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, today);
            const hasRdvs = dayRdvs.length > 0;
            const hasInstallation = dayRdvs.some(
              (r) => r.typeRdv === "external_installation"
            );
            const hasR2 = dayRdvs.some((r) => r.isR2);

            return (
              <div
                key={dayKey}
                onClick={() => onDayClick?.(day)}
                className={`
                  min-h-[60px] p-1 rounded-lg border cursor-pointer transition-all duration-150 
                  active:scale-[0.97] active:bg-primary/20
                  ${
                    isToday
                      ? "border-primary bg-primary/5 ring-1 ring-primary hover:bg-primary/10"
                      : isCurrentMonth
                      ? "border-border bg-card hover:bg-muted/50"
                      : "border-border/50 bg-muted/30 hover:bg-muted/50"
                  }
                `}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-medium ${
                      isToday
                        ? "text-primary font-bold"
                        : isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {hasRdvs && (
                    <div className="flex gap-0.5">
                      {hasInstallation && (
                        <Wrench className="h-2.5 w-2.5 text-amber-500" />
                      )}
                      {hasR2 && (
                        <RefreshCw className="h-2.5 w-2.5 text-status-r2" />
                      )}
                    </div>
                  )}
                </div>

                {/* RDV indicators */}
                {hasRdvs && (
                  <div className="space-y-0.5">
                    {dayRdvs.length <= 2 ? (
                      dayRdvs.map((rdv) => (
                        <div
                          key={rdv.id}
                          className={`text-[9px] px-1 py-0.5 rounded truncate select-none ${
                            rdv.typeRdv === "external_installation"
                              ? "bg-amber-500/20 text-amber-700"
                              : rdv.isR2
                              ? "bg-status-r2/20 text-status-r2"
                              : "bg-primary/20 text-primary"
                          }`}
                        >
                          {rdv.time} {rdv.client.split(" ")[0]}
                        </div>
                      ))
                    ) : (
                      <Badge
                        variant="secondary"
                        className={`text-[9px] h-4 w-full justify-center ${getStatusColor(
                          dayRdvs
                        )} text-white`}
                      >
                        {dayRdvs.length} RDV
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
