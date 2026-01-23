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
          {/* Solid dark background */}
          <div className="absolute inset-0 bg-black" />
          
          {/* Intense inferno glow layers */}
          <div className="absolute inset-0 bg-gradient-to-t from-orange-600 via-red-700 to-black animate-pulse" />
          <div className="absolute inset-0 bg-gradient-radial from-yellow-500/40 via-orange-600/30 to-transparent" style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(255,200,0,0.6) 0%, rgba(255,100,0,0.4) 30%, rgba(200,0,0,0.3) 60%, transparent 100%)' }} />
          
          {/* Full screen inferno */}
          <div className="absolute inset-0">
            {/* Giant flames covering entire screen */}
            {[...Array(20)].map((_, i) => (
              <div
                key={`giant-${i}`}
                className="absolute bottom-0 inferno-flame"
                style={{
                  left: `${i * 5}%`,
                  width: `${60 + Math.random() * 40}px`,
                  height: `${window.innerHeight * 0.7 + Math.random() * window.innerHeight * 0.3}px`,
                  animationDelay: `${Math.random() * 0.3}s`,
                }}
              />
            ))}
            
            {/* Medium flames layer */}
            {[...Array(30)].map((_, i) => (
              <div
                key={`medium-${i}`}
                className="absolute bottom-0 inferno-flame-bright"
                style={{
                  left: `${i * 3.3}%`,
                  width: `${40 + Math.random() * 30}px`,
                  height: `${window.innerHeight * 0.5 + Math.random() * window.innerHeight * 0.4}px`,
                  animationDelay: `${Math.random() * 0.2}s`,
                }}
              />
            ))}
            
            {/* Front intense flames */}
            {[...Array(25)].map((_, i) => (
              <div
                key={`front-${i}`}
                className="absolute bottom-0 inferno-flame-white"
                style={{
                  left: `${i * 4}%`,
                  width: `${30 + Math.random() * 25}px`,
                  height: `${window.innerHeight * 0.3 + Math.random() * window.innerHeight * 0.3}px`,
                  animationDelay: `${Math.random() * 0.15}s`,
                }}
              />
            ))}
            
            {/* Flying embers everywhere */}
            {[...Array(40)].map((_, i) => (
              <div
                key={`ember-${i}`}
                className="absolute inferno-ember"
                style={{
                  left: `${Math.random() * 100}%`,
                  bottom: `${Math.random() * 30}%`,
                  animationDelay: `${Math.random() * 1}s`,
                  animationDuration: `${0.8 + Math.random() * 0.7}s`,
                }}
              />
            ))}
            
            {/* Smoke rising */}
            {[...Array(15)].map((_, i) => (
              <div
                key={`smoke-${i}`}
                className="absolute inferno-smoke"
                style={{
                  left: `${i * 7}%`,
                  bottom: '40%',
                  animationDelay: `${Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
          
          {/* Heat distortion overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-500/20 to-yellow-500/30 animate-pulse" />
          
          {/* Devil emoji appearing */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-9xl animate-devil-appear drop-shadow-[0_0_60px_rgba(255,50,0,1)]">😈</span>
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

      {/* CSS for inferno animations */}
      <style>{`
        @keyframes fire-overlay {
          0% { opacity: 0; }
          5% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        @keyframes inferno-dance {
          0%, 100% { 
            transform: scaleY(1) scaleX(1) translateX(0) rotate(-3deg);
            filter: brightness(1);
          }
          15% { 
            transform: scaleY(1.15) scaleX(0.85) translateX(-5px) rotate(2deg);
            filter: brightness(1.2);
          }
          30% { 
            transform: scaleY(0.9) scaleX(1.1) translateX(3px) rotate(-1deg);
            filter: brightness(0.9);
          }
          45% { 
            transform: scaleY(1.2) scaleX(0.9) translateX(-2px) rotate(3deg);
            filter: brightness(1.3);
          }
          60% { 
            transform: scaleY(0.95) scaleX(1.05) translateX(4px) rotate(-2deg);
            filter: brightness(1.1);
          }
          75% { 
            transform: scaleY(1.1) scaleX(0.95) translateX(-3px) rotate(1deg);
            filter: brightness(1.15);
          }
        }
        
        @keyframes ember-fly {
          0% { 
            transform: translateY(0) translateX(0) scale(1);
            opacity: 1;
          }
          50% {
            transform: translateY(-40vh) translateX(20px) scale(0.8);
            opacity: 0.8;
          }
          100% { 
            transform: translateY(-80vh) translateX(-10px) scale(0.2);
            opacity: 0;
          }
        }
        
        @keyframes smoke-rise {
          0% { 
            transform: translateY(0) scale(1);
            opacity: 0.4;
          }
          100% { 
            transform: translateY(-60vh) scale(3);
            opacity: 0;
          }
        }
        
        @keyframes devil-appear {
          0% { 
            transform: scale(0) rotate(-180deg); 
            opacity: 0;
          }
          30% { 
            transform: scale(2) rotate(20deg); 
            opacity: 1;
          }
          50% { 
            transform: scale(1.5) rotate(-10deg); 
            opacity: 1;
          }
          70% { 
            transform: scale(1.2) rotate(5deg); 
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
        
        .inferno-flame {
          background: linear-gradient(to top, 
            #ff2200 0%, 
            #ff4400 15%,
            #ff6600 30%, 
            #ff8800 45%,
            #ffaa00 60%, 
            #ffcc00 75%,
            #ffee00 90%,
            transparent 100%
          );
          border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
          filter: blur(8px);
          animation: inferno-dance 0.15s ease-in-out infinite;
          transform-origin: bottom center;
          opacity: 0.9;
        }
        
        .inferno-flame-bright {
          background: linear-gradient(to top, 
            #ff6600 0%,
            #ff8800 20%,
            #ffaa00 40%, 
            #ffcc00 60%,
            #ffee00 80%, 
            transparent 100%
          );
          border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
          filter: blur(5px);
          animation: inferno-dance 0.12s ease-in-out infinite reverse;
          transform-origin: bottom center;
          opacity: 0.95;
        }
        
        .inferno-flame-white {
          background: linear-gradient(to top, 
            #ffffff 0%,
            #ffffcc 15%,
            #ffff66 30%, 
            #ffee00 50%,
            #ffaa00 70%, 
            #ff6600 85%,
            transparent 100%
          );
          border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
          filter: blur(3px);
          animation: inferno-dance 0.1s ease-in-out infinite;
          transform-origin: bottom center;
        }
        
        .inferno-ember {
          width: 8px;
          height: 8px;
          background: radial-gradient(circle, #ffffff 0%, #ffff00 30%, #ff6600 60%, #ff0000 100%);
          border-radius: 50%;
          animation: ember-fly 1.2s ease-out infinite;
          filter: blur(1px);
          box-shadow: 0 0 10px #ff6600, 0 0 20px #ff3300;
        }
        
        .inferno-smoke {
          width: 80px;
          height: 80px;
          background: radial-gradient(circle, rgba(50,50,50,0.6) 0%, transparent 70%);
          border-radius: 50%;
          animation: smoke-rise 3s ease-out infinite;
          filter: blur(10px);
        }
        
        .animate-devil-appear {
          animation: devil-appear 1.5s ease-out forwards;
        }
      `}</style>
    </>
  );
}
