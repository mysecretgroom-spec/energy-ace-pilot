import { Button } from "@/components/ui/button";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingSaveButtonProps {
  show: boolean;
  saving: boolean;
  onSave: () => void;
  onReset?: () => void;
  saveLabel?: string;
  resetLabel?: string;
  className?: string;
}

export const FloatingSaveButton = ({
  show,
  saving,
  onSave,
  onReset,
  saveLabel = "Enregistrer",
  resetLabel = "Annuler",
  className,
}: FloatingSaveButtonProps) => {
  return (
    <div
      className={cn(
        "fixed bottom-[5.5rem] sm:bottom-24 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t shadow-lg transition-all duration-300 ease-out z-[65] safe-bottom",
        show
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0 pointer-events-none",
        className
      )}
    >
      {onReset ? (
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={onReset}
            disabled={saving}
          >
            <RotateCcw className="h-4 w-4" />
            {resetLabel}
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saveLabel}
          </Button>
        </div>
      ) : (
        <Button
          className="w-full max-w-lg mx-auto flex gap-2"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saveLabel}
        </Button>
      )}
    </div>
  );
};
