import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface DroppableDayProps {
  id: string;
  date: Date;
  children: React.ReactNode;
  className?: string;
  isToday?: boolean;
}

export function DroppableDay({
  id,
  date,
  children,
  className,
  isToday,
}: DroppableDayProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id,
    data: { date },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-h-[120px] rounded-lg border transition-all duration-200",
        isToday
          ? "border-primary bg-primary/5"
          : "border-border bg-card",
        isOver && active && "ring-2 ring-primary bg-primary/10 border-primary",
        className
      )}
    >
      {children}
    </div>
  );
}
