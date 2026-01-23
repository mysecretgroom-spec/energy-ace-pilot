import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Clock, Wrench, RefreshCw, GripVertical } from "lucide-react";
import { StatusBadge, RdvStatus } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

interface DraggableRdvCardProps {
  id: string;
  time: string;
  client: string;
  status: RdvStatus;
  typeRdv: "standard" | "external_installation";
  isR2?: boolean;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function DraggableRdvCard({
  id,
  time,
  client,
  status,
  typeRdv,
  isR2,
  children,
  className,
  disabled = false,
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

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : undefined,
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
        typeRdv === "external_installation"
          ? "border-l-2 border-l-amber-500 bg-amber-500/5"
          : isR2
          ? "border-l-2 border-l-status-r2 bg-status-r2/5"
          : "",
        className
      )}
      {...attributes}
      {...listeners}
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
          <div className="mt-0.5">
            <StatusBadge status={status} className="text-[8px] px-1 py-0" />
          </div>
        </>
      )}
    </Card>
  );
}
