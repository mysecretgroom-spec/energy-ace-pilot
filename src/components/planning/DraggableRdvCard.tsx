import { forwardRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Clock, Wrench, RefreshCw, GripVertical, HardHat } from "lucide-react";
import { StatusBadge, RdvStatus } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { useLongPress } from "@/hooks/useLongPress";

interface DraggableRdvCardProps {
  id: string;
  time: string;
  client: string;
  status: RdvStatus;
  typeRdv: "standard" | "external_installation" | "installation";
  isR2?: boolean;
  regieNom?: string | null;
  regieCouleur?: string | null;
  commissionNette?: number;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  isHighlighted?: boolean;
  onLongPress?: () => void;
}

export const DraggableRdvCard = forwardRef<HTMLDivElement, DraggableRdvCardProps>(
  function DraggableRdvCardInner(
    {
      id,
      time,
      client,
      status,
      typeRdv,
      isR2,
      regieNom,
      regieCouleur,
      commissionNette,
      children,
      className,
      disabled = false,
      isHighlighted = false,
      onLongPress,
    },
    forwardedRef
  ) {
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
      delay: 500,
      onLongPress: () => {
        if (!disabled && onLongPress && !isHighlighted) {
          onLongPress();
        }
      },
      moveThreshold: 15,
      disabled: disabled || isHighlighted,
      vibrationDuration: 50,
      cancelOnScroll: true,
    });

    const style = {
      transform: CSS.Translate.toString(transform),
      zIndex: isDragging ? 50 : isHighlighted ? 40 : undefined,
    };

    // Create synthetic touch/mouse events from pointer events for useLongPress
    const createSyntheticTouchEvent = (e: React.PointerEvent): React.TouchEvent => ({
      ...e,
      touches: [{ clientX: e.clientX, clientY: e.clientY }] as unknown as React.TouchList,
      targetTouches: [] as unknown as React.TouchList,
      changedTouches: [] as unknown as React.TouchList,
    } as unknown as React.TouchEvent);

    const createSyntheticMouseEvent = (e: React.PointerEvent): React.MouseEvent => ({
      ...e,
      button: e.button,
      clientX: e.clientX,
      clientY: e.clientY,
    } as unknown as React.MouseEvent);

    // Unified pointer handler that works with both mouse and touch
    const handlePointerDown = (e: React.PointerEvent) => {
      if (e.pointerType === "touch") {
        longPressHandlers.onTouchStart(createSyntheticTouchEvent(e));
      } else {
        longPressHandlers.onMouseDown(createSyntheticMouseEvent(e));
      }
      listeners?.onPointerDown?.(e);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      if (e.pointerType === "touch") {
        longPressHandlers.onTouchEnd(createSyntheticTouchEvent(e));
      } else {
        longPressHandlers.onMouseUp(createSyntheticMouseEvent(e));
      }
      if (isLongPressing) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (e.pointerType === "touch") {
        longPressHandlers.onTouchMove(createSyntheticTouchEvent(e));
      }
    };

    const handlePointerCancel = () => {
      longPressHandlers.onMouseLeave({} as React.MouseEvent);
    };

    const handlePointerLeave = (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") {
        longPressHandlers.onMouseLeave(createSyntheticMouseEvent(e));
      }
    };

    const mergedHandlers = disabled ? {} : {
      onPointerDown: handlePointerDown,
      onPointerUp: handlePointerUp,
      onPointerMove: handlePointerMove,
      onPointerCancel: handlePointerCancel,
      onPointerLeave: handlePointerLeave,
      onContextMenu: longPressHandlers.onContextMenu,
    };

    // Merge refs: dnd-kit's setNodeRef + forwardedRef
    const setRefs = (node: HTMLDivElement | null) => {
      setNodeRef(node);
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    };

    return (
      <Card
        ref={setRefs}
        style={{
          ...style,
          touchAction: disabled ? undefined : (isDragging ? "none" : "manipulation"),
        }}
        className={cn(
          "p-1.5 transition-all duration-200 select-none",
          isDragging 
            ? "opacity-90 shadow-xl scale-105 ring-2 ring-primary cursor-grabbing" 
            : "cursor-grab hover:bg-muted/50 active:cursor-grabbing",
          isPressing && !isLongPressing && !isDragging
            ? "scale-[0.98] bg-muted/30"
            : "",
          isHighlighted && !isDragging
            ? "ring-2 ring-primary shadow-lg scale-[1.02]"
            : "",
          typeRdv === "installation"
            ? "halo-multicolor bg-indigo-500/5"
            : typeRdv === "external_installation"
            ? "border-l-2 border-l-amber-500 bg-amber-500/5 shadow-[0_0_12px_-2px_rgba(245,158,11,0.4)]"
            : isR2
            ? "border-l-2 border-l-status-r2 bg-status-r2/5 shadow-[0_0_12px_-2px_rgba(245,158,11,0.4)]"
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
              <Clock className={cn(
                "h-2.5 w-2.5",
                typeRdv === "installation" ? "text-indigo-500" : "text-primary"
              )} />
              <span className={cn(
                "text-[10px] font-semibold",
                typeRdv === "installation" ? "text-indigo-600 dark:text-indigo-400" : "text-primary"
              )}>
                {time}
              </span>
              {typeRdv === "installation" && (
                <HardHat className="h-2.5 w-2.5 text-indigo-500" />
              )}
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
              {typeRdv === "installation" ? (
                <span className="text-[8px] px-1.5 py-0 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/40">
                  Pose
                </span>
              ) : (
                <StatusBadge status={status} className="text-[8px] px-1 py-0" />
              )}
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
);

DraggableRdvCard.displayName = "DraggableRdvCard";
