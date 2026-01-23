import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useHejjaMode } from "@/hooks/useHejjaMode";
import { useAuth } from "@/hooks/useAuth";
import { PinDialog } from "@/components/auth/PinDialog";
import { ShieldCheck, ShieldOff } from "lucide-react";

export function HejjaToggle() {
  const { user } = useAuth();
  const { isActive, activate, deactivate } = useHejjaMode();
  const [showPinDialog, setShowPinDialog] = useState(false);

  // Don't render if not authenticated
  if (!user) return null;

  const handleClick = () => {
    if (isActive) {
      deactivate();
    } else {
      setShowPinDialog(true);
    }
  };

  const handlePinSuccess = () => {
    activate();
  };

  return (
    <>
      <Button
        variant={isActive ? "default" : "outline"}
        size="sm"
        onClick={handleClick}
        className={`fixed bottom-24 right-4 z-50 shadow-lg rounded-full h-12 px-4 gap-2 transition-all ${
          isActive 
            ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600" 
            : "bg-background/95 backdrop-blur border-border hover:bg-muted"
        }`}
      >
        {isActive ? (
          <>
            <ShieldCheck className="h-5 w-5" />
            <span className="font-medium">HEJJA</span>
            <Badge variant="secondary" className="bg-amber-700 text-white text-xs px-1.5">
              ON
            </Badge>
          </>
        ) : (
          <>
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">HEJJA</span>
          </>
        )}
      </Button>

      <PinDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        onSuccess={handlePinSuccess}
        title="Mode HEJJA"
        description="Entrez le code PIN interne pour activer le mode HEJJA"
      />
    </>
  );
}
