import { useMemo, useState } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RdvStatus } from "@/components/ui/status-badge";
import { RdvQuickActions } from "./RdvQuickActions";
import { DraggableRdvCard } from "./DraggableRdvCard";
import { DroppableDay } from "./DroppableDay";
import { TimePickerDialog } from "./TimePickerDialog";
import { RdvContextMenu } from "./RdvContextMenu";
import { useDragAndDropRdv } from "@/hooks/useDragAndDropRdv";

interface RdvData {
  id: string;
  time: string;
  date: Date;
  client: string;
  clientPrenom?: string;
  clientId: string;
  phone?: string | null;
  address?: string;
  city?: string;
  postalCode?: string;
  status: RdvStatus;
  type: string;
  typeRdv: 'standard' | 'external_installation';
  isR2?: boolean;
  etudeId?: string | null;
  regieId?: string | null;
  regieNom?: string | null;
  regieCouleur?: string | null;
}

interface WeekCalendarViewProps {
  currentDate: Date;
  rdvList: RdvData[];
  onRdvClick?: (rdv: RdvData) => void;
  onDayClick?: (date: Date) => void;
  onStatusChange?: (rdvId: string, newStatus: RdvStatus) => void;
  onRefresh?: () => void;
}

interface PendingDrop {
  rdv: RdvData;
  targetDate: Date;
}

export function WeekCalendarView({ 
  currentDate, 
  rdvList, 
  onRdvClick, 
  onDayClick,
  onStatusChange,
  onRefresh 
}: WeekCalendarViewProps) {
  const [activeRdv, setActiveRdv] = useState<RdvData | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [contextMenuRdv, setContextMenuRdv] = useState<RdvData | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  // Configure sensors for both pointer and touch
  // Long press triggers at 800ms, so we set touch delay higher to let long press win
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 10, // Requires 10px movement to start drag
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 1000, // Must hold 1s before drag starts - longer than long press (800ms)
      tolerance: 8,
    },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const { handleDrop } = useDragAndDropRdv({
    onSuccess: onRefresh,
  });

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

  const handleDragStart = (event: DragStartEvent) => {
    const rdvId = event.active.id as string;
    const rdv = rdvList.find((r) => r.id === rdvId);
    if (rdv) {
      setActiveRdv(rdv);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const currentActiveRdv = activeRdv;
    setActiveRdv(null);

    if (!over || !currentActiveRdv) return;

    // Get the target date from the droppable data
    const targetDate = over.data.current?.date as Date;
    
    if (!targetDate) return;

    // Check if the date actually changed
    if (isSameDay(currentActiveRdv.date, targetDate)) return;

    // Store the pending drop and open time picker
    setPendingDrop({ rdv: currentActiveRdv, targetDate });
    setTimePickerOpen(true);
  };

  const handleTimeConfirm = (newTime: string) => {
    if (!pendingDrop) return;

    handleDrop(
      pendingDrop.rdv.id,
      pendingDrop.rdv.time,
      pendingDrop.targetDate,
      newTime,
      pendingDrop.rdv.client
    );

    setPendingDrop(null);
  };

  const handleTimePickerClose = (open: boolean) => {
    setTimePickerOpen(open);
    if (!open) {
      setPendingDrop(null);
    }
  };

  const handleLongPress = (rdv: RdvData) => {
    setContextMenuRdv(rdv);
    setContextMenuOpen(true);
  };

  const handleContextMenuClose = () => {
    setContextMenuOpen(false);
    setContextMenuRdv(null);
  };

  const handleContextMenuMove = () => {
    if (contextMenuRdv) {
      setPendingDrop({ rdv: contextMenuRdv, targetDate: contextMenuRdv.date });
      setTimePickerOpen(true);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const isToday = isSameDay(day, today);
          const dayKey = format(day, "yyyy-MM-dd");
          const dayRdvs = rdvsByDay[dayKey] || [];

          return (
            <DroppableDay
              key={dayKey}
              id={dayKey}
              date={day}
              isToday={isToday}
            >
              {/* Day header - clickable */}
              <button
                onClick={() => onDayClick?.(day)}
                className={`w-full px-2 py-1.5 text-center border-b transition-all duration-150 active:scale-[0.97] active:bg-primary/20 ${
                  isToday 
                    ? "bg-primary/10 hover:bg-primary/15" 
                    : "bg-muted/50 hover:bg-muted"
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
              </button>

              {/* RDVs for this day */}
              <ScrollArea className="flex-1 p-1">
                <div className="space-y-1">
                  {dayRdvs.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center py-2">
                      —
                    </p>
                  ) : (
                    dayRdvs.map((rdv) => (
                      <RdvQuickActions
                        key={rdv.id}
                        rdvId={rdv.id}
                        clientId={rdv.clientId}
                        clientName={rdv.client}
                        clientPhone={rdv.phone}
                        time={rdv.time}
                        address={rdv.address || ""}
                        city={rdv.city}
                        postalCode={rdv.postalCode}
                        currentStatus={rdv.status}
                        etudeId={rdv.etudeId}
                        regieId={rdv.regieId}
                        onStatusChange={(newStatus) => onStatusChange?.(rdv.id, newStatus)}
                      >
                        <DraggableRdvCard
                          id={rdv.id}
                          time={rdv.time}
                          client={rdv.client}
                          status={rdv.status}
                          typeRdv={rdv.typeRdv}
                          isR2={rdv.isR2}
                          regieNom={rdv.regieNom}
                          regieCouleur={rdv.regieCouleur}
                          isHighlighted={contextMenuRdv?.id === rdv.id}
                          onLongPress={() => handleLongPress(rdv)}
                        />
                      </RdvQuickActions>
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
            </DroppableDay>
          );
        })}
      </div>

      {/* Drag overlay for visual feedback */}
      <DragOverlay>
        {activeRdv && (
          <div className="opacity-90 shadow-2xl">
            <DraggableRdvCard
              id={activeRdv.id}
              time={activeRdv.time}
              client={activeRdv.client}
              status={activeRdv.status}
              typeRdv={activeRdv.typeRdv}
              isR2={activeRdv.isR2}
              regieNom={activeRdv.regieNom}
              regieCouleur={activeRdv.regieCouleur}
              disabled
              className="bg-card border-2 border-primary"
            />
          </div>
        )}
      </DragOverlay>

      {/* Time picker dialog */}
      {pendingDrop && (
        <TimePickerDialog
          open={timePickerOpen}
          onOpenChange={handleTimePickerClose}
          currentTime={pendingDrop.rdv.time}
          targetDate={pendingDrop.targetDate}
          clientName={pendingDrop.rdv.client}
          onConfirm={handleTimeConfirm}
        />
      )}

      {/* Context menu for long-press */}
      {contextMenuRdv && (
        <RdvContextMenu
          rdv={contextMenuRdv}
          isOpen={contextMenuOpen}
          onClose={handleContextMenuClose}
          onStatusChange={onStatusChange}
          onMoveRequest={handleContextMenuMove}
          onRefresh={onRefresh}
        />
      )}
    </DndContext>
  );
}
