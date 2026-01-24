import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Clock, Wrench, RefreshCw, GripVertical } from "lucide-react";
import { StatusBadge, RdvStatus } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { useLongPress } from "@/hooks/useLongPress";

interface DraggableRdvCardProps {
  id: string;
  time: string;
  client: string;
  status: RdvStatus;
  typeRdv: "standard" | "external_installation";
  isR2?: boolean;
  regieNom?: string | null;
  regieCouleur?: string | null;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  isHighlighted?: boolean;
  onLongPress?: () => void;
}

export function DraggableRdvCard({
  id,
  time,
  client,
  status,
  typeRdv,
  isR2,
  regieNom,
  regieCouleur,
  children,
  className,
  disabled = false,
  isHighlighted = false,
  onLongPress,
}: DraggableRdvCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled,
    data: {
      id,
      time,
      client,
      status,
      typeRdv,
      isR2,
    },
  });

  const { handlers: longPressHandlers, isLongPressing, isPressing } = useLongPress({
    delay: 600, // Faster trigger - before drag (dnd-kit TouchSensor has 1000ms delay)
    onLongPress: () => {
      if (!disabled && onLongPress && !isHighlighted) {
        onLongPress();
      }
    },
    moveThreshold: 8,
    disabled: disabled || isHighlighted, // Disable long press when menu is already open
    vibrationDuration: 50,
    cancelOnScroll: true,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : isHighlighted ? 40 : undefined,
  };

  // Handle touch events - prioritize long press detection
  const handleTouchStart = (e: React.TouchEvent) => {
    longPressHandlers.onTouchStart(e);
    // Don't trigger dnd-kit pointer down immediately - let long press timer start
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // If long press was triggered, prevent default behavior
    if (isLongPressing) {
      e.preventDefault();
      e.stopPropagation();
    }
    longPressHandlers.onTouchEnd(e);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    longPressHandlers.onTouchMove(e);
  };

  // For mouse, we can use dnd-kit listeners directly but still track long press
  const handleMouseDown = (e: React.MouseEvent) => {
    longPressHandlers.onMouseDown(e);
    listeners?.onPointerDown?.(e as unknown as React.PointerEvent);
  };

  const mergedHandlers = disabled ? {} : {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove,
    onMouseDown: handleMouseDown,
    onMouseUp: longPressHandlers.onMouseUp,
    onMouseLeave: longPressHandlers.onMouseLeave,
    onContextMenu: longPressHandlers.onContextMenu,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-1.5 transition-all duration-200 select-none",
        isDragging 
          ? "opacity-90 shadow-xl scale-105 ring-2 ring-primary cursor-grabbing" 
          : "cursor-grab hover:bg-muted/50 active:cursor-grabbing",
        isHighlighted && !isDragging
          ? "ring-2 ring-primary shadow-lg scale-[1.02]"
          : "",
        typeRdv === "external_installation"
          ? "border-l-2 border-l-amber-500 bg-amber-500/5"
          : isR2
          ? "border-l-2 border-l-status-r2 bg-status-r2/5"
          : "",
        className
      )}
      {...attributes}
      {...mergedHandlers}
    >
      {children || (
        <>
          <div className="flex items-center gap-1 mb-0.5">
            <GripVertical className="h-2.5 w-2.5 text-muted-foreground/50" />
            <Clock className="h-2.5 w-2.5 text-primary" />
            <span className="text-[10px] font-semibold text-primary">
              {time}
            </span>
            {typeRdv === "external_installation" && (
              <Wrench className="h-2.5 w-2.5 text-amber-500" />
            )}
            {isR2 && (
              <RefreshCw className="h-2.5 w-2.5 text-status-r2" />
            )}
          </div>
          <p className="text-[10px] font-medium text-foreground truncate">
            {client}
          </p>
          <div className="mt-0.5 flex items-center gap-1 flex-wrap">
            <StatusBadge status={status} className="text-[8px] px-1 py-0" />
            {regieNom && (
              <span 
                className="text-[8px] px-1.5 py-0 rounded-full border truncate max-w-[60px]"
                style={{ 
                  backgroundColor: regieCouleur ? `${regieCouleur}15` : undefined,
                  color: regieCouleur || undefined,
                  borderColor: regieCouleur ? `${regieCouleur}40` : undefined,
                }}
                title={regieNom}
              >
                {regieNom}
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
