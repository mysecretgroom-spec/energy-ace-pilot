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
    // Trigger haptic vibration on mobile
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }
    
    // Trigger fire animation
    setShowFireAnimation(true);
    
    // Enable dark mode
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
    
    // Activate HEJJA mode
    activate();
    
    // Hide fire animation after 1.5 seconds
    setTimeout(() => {
      setShowFireAnimation(false);
    }, 1500);
  };

  // Don't render if not authenticated
  if (!user) return null;

  return (
    <>
      {/* Fire Animation Overlay */}
      {showFireAnimation && (
        <div className="fixed inset-0 z-[100] pointer-events-none animate-fire-overlay overflow-hidden">
          {/* Solid dark background - completely opaque */}
          <div className="absolute inset-0 bg-black" />
          <div className="absolute inset-0 bg-gradient-to-t from-red-900 via-orange-950 to-black" />
          
          {/* Realistic flame layers */}
          <div className="absolute bottom-0 left-0 right-0 h-full">
            {/* Base fire glow */}
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-orange-500/80 via-red-600/40 to-transparent" />
            
            {/* Individual flames - Layer 1 (back) */}
            <div className="absolute bottom-0 left-[5%] flame flame-1" />
            <div className="absolute bottom-0 left-[15%] flame flame-2" />
            <div className="absolute bottom-0 left-[25%] flame flame-3" />
            <div className="absolute bottom-0 left-[35%] flame flame-1" style={{ animationDelay: '0.1s' }} />
            <div className="absolute bottom-0 left-[45%] flame flame-2" style={{ animationDelay: '0.2s' }} />
            <div className="absolute bottom-0 left-[55%] flame flame-3" style={{ animationDelay: '0.15s' }} />
            <div className="absolute bottom-0 left-[65%] flame flame-1" style={{ animationDelay: '0.25s' }} />
            <div className="absolute bottom-0 left-[75%] flame flame-2" style={{ animationDelay: '0.05s' }} />
            <div className="absolute bottom-0 left-[85%] flame flame-3" style={{ animationDelay: '0.3s' }} />
            
            {/* Individual flames - Layer 2 (front, brighter) */}
            <div className="absolute bottom-0 left-[10%] flame-bright flame-1" style={{ animationDelay: '0.1s' }} />
            <div className="absolute bottom-0 left-[20%] flame-bright flame-2" style={{ animationDelay: '0.2s' }} />
            <div className="absolute bottom-0 left-[30%] flame-bright flame-3" />
            <div className="absolute bottom-0 left-[40%] flame-bright flame-1" style={{ animationDelay: '0.15s' }} />
            <div className="absolute bottom-0 left-[50%] flame-bright flame-2" style={{ animationDelay: '0.25s' }} />
            <div className="absolute bottom-0 left-[60%] flame-bright flame-3" style={{ animationDelay: '0.1s' }} />
            <div className="absolute bottom-0 left-[70%] flame-bright flame-1" style={{ animationDelay: '0.05s' }} />
            <div className="absolute bottom-0 left-[80%] flame-bright flame-2" style={{ animationDelay: '0.2s' }} />
            <div className="absolute bottom-0 left-[90%] flame-bright flame-3" style={{ animationDelay: '0.15s' }} />
            
            {/* Sparks/embers */}
            <div className="absolute bottom-20 left-[20%] ember" style={{ animationDelay: '0s' }} />
            <div className="absolute bottom-32 left-[35%] ember" style={{ animationDelay: '0.3s' }} />
            <div className="absolute bottom-24 left-[50%] ember" style={{ animationDelay: '0.1s' }} />
            <div className="absolute bottom-28 left-[65%] ember" style={{ animationDelay: '0.4s' }} />
            <div className="absolute bottom-16 left-[80%] ember" style={{ animationDelay: '0.2s' }} />
          </div>
          
          {/* Devil emoji appearing */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-8xl animate-devil-appear drop-shadow-[0_0_30px_rgba(255,100,0,0.8)]">😈</span>
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
          5% { opacity: 1; }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        @keyframes flame-dance {
          0%, 100% { 
            transform: scaleY(1) scaleX(1) translateY(0) rotate(-2deg);
          }
          25% { 
            transform: scaleY(1.2) scaleX(0.9) translateY(-10px) rotate(2deg);
          }
          50% { 
            transform: scaleY(0.9) scaleX(1.1) translateY(-5px) rotate(-1deg);
          }
          75% { 
            transform: scaleY(1.15) scaleX(0.95) translateY(-15px) rotate(1deg);
          }
        }
        
        @keyframes flame-dance-alt {
          0%, 100% { 
            transform: scaleY(1) scaleX(1) translateY(0) rotate(1deg);
          }
          33% { 
            transform: scaleY(1.25) scaleX(0.85) translateY(-12px) rotate(-2deg);
          }
          66% { 
            transform: scaleY(0.85) scaleX(1.15) translateY(-8px) rotate(2deg);
          }
        }
        
        @keyframes ember-rise {
          0% { 
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% { 
            transform: translateY(-200px) scale(0);
            opacity: 0;
          }
        }
        
        @keyframes devil-appear {
          0% { 
            transform: scale(0) rotate(-180deg); 
            opacity: 0;
          }
          40% { 
            transform: scale(1.6) rotate(15deg); 
            opacity: 1;
          }
          60% { 
            transform: scale(1.3) rotate(-8deg); 
            opacity: 1;
          }
          80% { 
            transform: scale(1.1) rotate(3deg); 
            opacity: 1;
          }
          100% { 
            transform: scale(1) rotate(0deg); 
            opacity: 0;
          }
        }
        
        .animate-fire-overlay {
          animation: fire-overlay 1.5s ease-out forwards;
        }
        
        .flame {
          width: 40px;
          height: 120px;
          background: linear-gradient(to top, 
            #ff4500 0%, 
            #ff6a00 20%, 
            #ff8c00 40%, 
            #ffa500 60%, 
            #ffcc00 80%, 
            transparent 100%
          );
          border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
          filter: blur(3px);
          animation: flame-dance 0.3s ease-in-out infinite;
          transform-origin: bottom center;
        }
        
        .flame-bright {
          width: 30px;
          height: 100px;
          background: linear-gradient(to top, 
            #fff 0%,
            #fffacd 10%,
            #ffff00 25%, 
            #ffa500 50%, 
            #ff4500 75%, 
            transparent 100%
          );
          border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
          filter: blur(2px);
          animation: flame-dance-alt 0.25s ease-in-out infinite;
          transform-origin: bottom center;
        }
        
        .flame-1 {
          height: 140px;
          width: 45px;
        }
        
        .flame-2 {
          height: 110px;
          width: 35px;
        }
        
        .flame-3 {
          height: 90px;
          width: 28px;
        }
        
        .ember {
          width: 6px;
          height: 6px;
          background: radial-gradient(circle, #ffff00 0%, #ff6600 50%, #ff0000 100%);
          border-radius: 50%;
          animation: ember-rise 1s ease-out infinite;
          filter: blur(1px);
        }
        
        .animate-devil-appear {
          animation: devil-appear 1.5s ease-out forwards;
        }
      `}</style>
    </>
  );
}
