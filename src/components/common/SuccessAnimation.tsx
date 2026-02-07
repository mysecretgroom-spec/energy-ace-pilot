import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticSuccess } from "@/lib/haptics";

interface SuccessAnimationProps {
  show: boolean;
  message?: string;
  onComplete?: () => void;
  duration?: number;
}

export function SuccessAnimation({
  show,
  message = "Succès",
  onComplete,
  duration = 1500,
}: SuccessAnimationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      hapticSuccess();
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onComplete]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
      <div className={cn(
        "flex flex-col items-center gap-3 p-6 rounded-2xl bg-background/95 backdrop-blur-sm border shadow-2xl",
        "animate-scale-in"
      )}>
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-green-500 animate-scale-in" />
        </div>
        <p className="text-sm font-semibold text-foreground">{message}</p>
      </div>
    </div>
  );
}
