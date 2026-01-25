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

  // Unified pointer handler that works with both mouse and touch
  // dnd-kit uses PointerEvents which handle both - we need to pass them through
  // while also tracking for long press
  const handlePointerDown = (e: React.PointerEvent) => {
    // Track long press (works for both mouse and touch via pointer events)
    if (e.pointerType === "touch") {
      longPressHandlers.onTouchStart(e as unknown as React.TouchEvent);
    } else {
      longPressHandlers.onMouseDown(e as unknown as React.MouseEvent);
    }
    
    // Always pass to dnd-kit - it has its own activation constraints (delay/distance)
    // Long press (600ms) will trigger before touch drag (1000ms delay in sensor)
    listeners?.onPointerDown?.(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    // If long press was triggered, prevent the event from bubbling
    if (isLongPressing) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (e.pointerType === "touch") {
      longPressHandlers.onTouchEnd(e as unknown as React.TouchEvent);
    } else {
      longPressHandlers.onMouseUp(e as unknown as React.MouseEvent);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      longPressHandlers.onTouchMove(e as unknown as React.TouchEvent);
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") {
      longPressHandlers.onMouseLeave(e as unknown as React.MouseEvent);
    }
  };

  const mergedHandlers = disabled ? {} : {
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerUp,
    onPointerMove: handlePointerMove,
    onPointerLeave: handlePointerLeave,
    onContextMenu: longPressHandlers.onContextMenu,
  };

  return (
    <Card
      ref={setNodeRef}
      style={{
        ...style,
        touchAction: disabled ? undefined : "none", // Prevent browser scroll/zoom during drag
      }}
      className={cn(
        "p-1.5 transition-all duration-200 select-none",
        isDragging 
          ? "opacity-90 shadow-xl scale-105 ring-2 ring-primary cursor-grabbing" 
          : "cursor-grab hover:bg-muted/50 active:cursor-grabbing",
        isPressing && !isLongPressing && !isDragging
          ? "scale-[0.98] bg-muted/30" // Visual feedback during press
          : "",
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
