import { useMemo } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, Wrench, RefreshCw } from "lucide-react";
import { StatusBadge, RdvStatus } from "@/components/ui/status-badge";

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

interface WeekCalendarViewProps {
  currentDate: Date;
  rdvList: RdvData[];
  onRdvClick?: (rdv: RdvData) => void;
}

export function WeekCalendarView({ currentDate, rdvList, onRdvClick }: WeekCalendarViewProps) {
  // Get Monday of the current week
  const weekStart = useMemo(() => {
    return startOfWeek(currentDate, { weekStartsOn: 1 });
  }, [currentDate]);

  // Generate 7 days of the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Group RDVs by day
  const rdvsByDay = useMemo(() => {
    const grouped: Record<string, RdvData[]> = {};
    weekDays.forEach((day) => {
      const key = format(day, "yyyy-MM-dd");
      grouped[key] = rdvList.filter((rdv) => isSameDay(rdv.date, day));
    });
    return grouped;
  }, [weekDays, rdvList]);

  const today = new Date();

  return (
    <div className="grid grid-cols-7 gap-1">
      {/* Header row with day names */}
      {weekDays.map((day) => {
        const isToday = isSameDay(day, today);
        const dayKey = format(day, "yyyy-MM-dd");
        const dayRdvs = rdvsByDay[dayKey] || [];

        return (
          <div
            key={dayKey}
            className={`flex flex-col min-h-[120px] rounded-lg border ${
              isToday
                ? "border-primary bg-primary/5"
                : "border-border bg-card"
            }`}
          >
            {/* Day header */}
            <div
              className={`px-2 py-1.5 text-center border-b ${
                isToday ? "bg-primary/10" : "bg-muted/50"
              }`}
            >
              <p className="text-[10px] font-medium text-muted-foreground uppercase">
                {format(day, "EEE", { locale: fr })}
              </p>
              <p
                className={`text-sm font-bold ${
                  isToday ? "text-primary" : "text-foreground"
                }`}
              >
                {format(day, "d")}
              </p>
            </div>

            {/* RDVs for this day */}
            <ScrollArea className="flex-1 p-1">
              <div className="space-y-1">
                {dayRdvs.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-2">
                    —
                  </p>
                ) : (
                  dayRdvs.map((rdv) => (
                    <Card
                      key={rdv.id}
                      onClick={() => onRdvClick?.(rdv)}
                      className={`p-1.5 cursor-pointer hover:bg-muted/50 transition-colors ${
                        rdv.typeRdv === "external_installation"
                          ? "border-l-2 border-l-amber-500 bg-amber-500/5"
                          : rdv.isR2
                          ? "border-l-2 border-l-status-r2 bg-status-r2/5"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <Clock className="h-2.5 w-2.5 text-primary" />
                        <span className="text-[10px] font-semibold text-primary">
                          {rdv.time}
                        </span>
                        {rdv.typeRdv === "external_installation" && (
                          <Wrench className="h-2.5 w-2.5 text-amber-500" />
                        )}
                        {rdv.isR2 && (
                          <RefreshCw className="h-2.5 w-2.5 text-status-r2" />
                        )}
                      </div>
                      <p className="text-[10px] font-medium text-foreground truncate">
                        {rdv.client}
                      </p>
                      <div className="mt-0.5">
                        <StatusBadge status={rdv.status} className="text-[8px] px-1 py-0" />
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* RDV count badge */}
            {dayRdvs.length > 0 && (
              <div className="px-1 pb-1 text-center">
                <Badge variant="secondary" className="text-[9px] h-4 px-1">
                  {dayRdvs.length} RDV
                </Badge>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
