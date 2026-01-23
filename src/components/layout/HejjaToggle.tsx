import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useHejjaMode } from "@/hooks/useHejjaMode";
import { useAuth } from "@/hooks/useAuth";
import { PinDialog } from "@/components/auth/PinDialog";

export function HejjaToggle() {
  const { user } = useAuth();
  const { isActive, activate, deactivate } = useHejjaMode();
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showFireAnimation, setShowFireAnimation] = useState(false);

  const handleClick = () => {
    if (isActive) {
      deactivate();
      // Restore light mode when deactivating
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      setShowPinDialog(true);
    }
  };

  const handlePinSuccess = () => {
    // Trigger fire animation
    setShowFireAnimation(true);
    
    // Enable dark mode
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
    
    // Activate HEJJA mode
    activate();
    
    // Hide fire animation after 1 second
    setTimeout(() => {
      setShowFireAnimation(false);
    }, 1000);
  };

  // Don't render if not authenticated
  if (!user) return null;

  return (
    <>
      {/* Fire Animation Overlay */}
      {showFireAnimation && (
        <div className="fixed inset-0 z-[100] pointer-events-none animate-fire-overlay">
          <div className="absolute inset-0 bg-gradient-to-t from-orange-600/90 via-red-500/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/50 via-orange-400/30 to-transparent animate-pulse" />
          {/* Fire particles */}
          <div className="absolute bottom-0 left-1/4 w-32 h-64 bg-gradient-to-t from-yellow-400 via-orange-500 to-transparent rounded-full blur-xl animate-fire-flicker" />
          <div className="absolute bottom-0 left-1/2 w-40 h-80 bg-gradient-to-t from-orange-500 via-red-500 to-transparent rounded-full blur-xl animate-fire-flicker-delayed" />
          <div className="absolute bottom-0 right-1/4 w-28 h-56 bg-gradient-to-t from-yellow-500 via-orange-400 to-transparent rounded-full blur-xl animate-fire-flicker" />
          {/* Devil emoji appearing */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-8xl animate-devil-appear">😈</span>
          </div>
        </div>
      )}

      <Button
        variant={isActive ? "default" : "outline"}
        size="sm"
        onClick={handleClick}
        className={`fixed bottom-24 right-4 z-50 shadow-lg rounded-full h-12 px-4 gap-2 transition-all ${
          isActive 
            ? "bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white border-red-700 shadow-red-500/30 shadow-lg" 
            : "bg-background/95 backdrop-blur border-border hover:bg-muted"
        }`}
      >
        {isActive ? (
          <>
            <span className="text-xl">😈</span>
            <span className="font-bold">HEJJA</span>
            <Badge variant="secondary" className="bg-red-900 text-white text-xs px-1.5 animate-pulse">
              🔥
            </Badge>
          </>
        ) : (
          <>
            <span className="text-xl">😇</span>
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

      {/* CSS for fire animations */}
      <style>{`
        @keyframes fire-overlay {
          0% { opacity: 0; }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        @keyframes fire-flicker {
          0%, 100% { 
            transform: scaleY(1) translateY(0); 
            opacity: 0.8;
          }
          25% { 
            transform: scaleY(1.1) translateY(-10px); 
            opacity: 1;
          }
          50% { 
            transform: scaleY(0.95) translateY(-5px); 
            opacity: 0.9;
          }
          75% { 
            transform: scaleY(1.05) translateY(-15px); 
            opacity: 1;
          }
        }
        
        @keyframes fire-flicker-delayed {
          0%, 100% { 
            transform: scaleY(1) translateY(0); 
            opacity: 0.9;
          }
          33% { 
            transform: scaleY(1.15) translateY(-20px); 
            opacity: 1;
          }
          66% { 
            transform: scaleY(0.9) translateY(-10px); 
            opacity: 0.85;
          }
        }
        
        @keyframes devil-appear {
          0% { 
            transform: scale(0) rotate(-180deg); 
            opacity: 0;
          }
          50% { 
            transform: scale(1.5) rotate(10deg); 
            opacity: 1;
          }
          70% { 
            transform: scale(1.2) rotate(-5deg); 
            opacity: 1;
          }
          100% { 
            transform: scale(1) rotate(0deg); 
            opacity: 0;
          }
        }
        
        .animate-fire-overlay {
          animation: fire-overlay 1s ease-out forwards;
        }
        
        .animate-fire-flicker {
          animation: fire-flicker 0.3s ease-in-out infinite;
        }
        
        .animate-fire-flicker-delayed {
          animation: fire-flicker-delayed 0.4s ease-in-out infinite;
          animation-delay: 0.1s;
        }
        
        .animate-devil-appear {
          animation: devil-appear 1s ease-out forwards;
        }
      `}</style>
    </>
  );
}
