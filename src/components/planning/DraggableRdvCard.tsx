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

  const { handlers: longPressHandlers } = useLongPress({
    delay: 1500,
    onLongPress: () => {
      if (!disabled && onLongPress) {
        onLongPress();
      }
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : isHighlighted ? 40 : undefined,
  };

  // Merge dnd-kit listeners with long-press handlers
  const mergedHandlers = disabled ? {} : {
    ...listeners,
    onTouchStart: (e: React.TouchEvent) => {
      longPressHandlers.onTouchStart(e);
      listeners?.onPointerDown?.(e as unknown as React.PointerEvent);
    },
    onTouchEnd: longPressHandlers.onTouchEnd,
    onTouchMove: longPressHandlers.onTouchMove,
    onMouseDown: (e: React.MouseEvent) => {
      longPressHandlers.onMouseDown(e);
      listeners?.onPointerDown?.(e as unknown as React.PointerEvent);
    },
    onMouseUp: longPressHandlers.onMouseUp,
    onMouseLeave: longPressHandlers.onMouseLeave,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-1.5 transition-all duration-200",
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
