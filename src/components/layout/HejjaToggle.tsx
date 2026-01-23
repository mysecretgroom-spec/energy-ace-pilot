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
  const [showHeavenAnimation, setShowHeavenAnimation] = useState(false);

  const handleClick = () => {
    if (isActive) {
      // Trigger heaven animation
      setShowHeavenAnimation(true);
      
      // Gentle vibration
      if (navigator.vibrate) {
        navigator.vibrate([50, 100, 50]);
      }
      
      // Deactivate after animation starts
      setTimeout(() => {
        deactivate();
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }, 500);
      
      // Hide animation after 2 seconds
      setTimeout(() => {
        setShowHeavenAnimation(false);
      }, 2000);
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

      {/* Heaven Animation Overlay */}
      {showHeavenAnimation && (
        <div className="fixed inset-0 z-[100] pointer-events-none animate-heaven-overlay overflow-hidden">
          {/* Pure white/golden background */}
          <div className="absolute inset-0 bg-gradient-to-b from-white via-sky-100 to-amber-50" />
          
          {/* Divine light rays from top */}
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(255,215,0,0.8) 0%, rgba(255,255,200,0.4) 30%, transparent 70%)' }} />
          
          {/* Light beams */}
          {[...Array(12)].map((_, i) => (
            <div
              key={`beam-${i}`}
              className="absolute top-0 heaven-beam"
              style={{
                left: `${8 + i * 8}%`,
                width: '4px',
                height: '100%',
                animationDelay: `${i * 0.1}s`,
                transform: `rotate(${-15 + i * 2.5}deg)`,
                transformOrigin: 'top center',
              }}
            />
          ))}
          
          {/* Clouds layer - bottom */}
          {[...Array(8)].map((_, i) => (
            <div
              key={`cloud-bottom-${i}`}
              className="absolute heaven-cloud"
              style={{
                left: `${i * 14 - 5}%`,
                bottom: `${5 + Math.random() * 15}%`,
                width: `${150 + Math.random() * 100}px`,
                height: `${80 + Math.random() * 40}px`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
          
          {/* Clouds layer - middle */}
          {[...Array(6)].map((_, i) => (
            <div
              key={`cloud-mid-${i}`}
              className="absolute heaven-cloud"
              style={{
                left: `${i * 18}%`,
                top: `${30 + Math.random() * 20}%`,
                width: `${120 + Math.random() * 80}px`,
                height: `${60 + Math.random() * 30}px`,
                animationDelay: `${Math.random() * 1.5}s`,
              }}
            />
          ))}
          
          {/* Clouds layer - top */}
          {[...Array(5)].map((_, i) => (
            <div
              key={`cloud-top-${i}`}
              className="absolute heaven-cloud-bright"
              style={{
                left: `${i * 22}%`,
                top: `${10 + Math.random() * 15}%`,
                width: `${100 + Math.random() * 60}px`,
                height: `${50 + Math.random() * 25}px`,
                animationDelay: `${Math.random() * 1}s`,
              }}
            />
          ))}
          
          {/* Golden sparkles */}
          {[...Array(30)].map((_, i) => (
            <div
              key={`sparkle-${i}`}
              className="absolute heaven-sparkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
          
          {/* Floating feathers */}
          {[...Array(12)].map((_, i) => (
            <div
              key={`feather-${i}`}
              className="absolute heaven-feather"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-5%`,
                animationDelay: `${Math.random() * 1.5}s`,
                animationDuration: `${2 + Math.random() * 1}s`,
              }}
            >
              🪶
            </div>
          ))}
          
          {/* Doves */}
          <div className="absolute heaven-dove" style={{ left: '20%', top: '20%', animationDelay: '0.2s' }}>🕊️</div>
          <div className="absolute heaven-dove" style={{ left: '70%', top: '25%', animationDelay: '0.5s' }}>🕊️</div>
          <div className="absolute heaven-dove" style={{ left: '45%', top: '15%', animationDelay: '0.8s' }}>🕊️</div>
          
          {/* Central divine glow */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute w-64 h-64 rounded-full heaven-glow" />
          </div>
          
          {/* Angel emoji appearing */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-9xl animate-angel-appear drop-shadow-[0_0_60px_rgba(255,215,0,1)]">😇</span>
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
        
        /* Heaven animations */
        @keyframes heaven-overlay {
          0% { opacity: 0; }
          10% { opacity: 1; }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        @keyframes beam-shimmer {
          0%, 100% { 
            opacity: 0.3;
            transform: scaleX(1);
          }
          50% { 
            opacity: 0.8;
            transform: scaleX(1.5);
          }
        }
        
        @keyframes cloud-float {
          0%, 100% { 
            transform: translateX(0) translateY(0);
            opacity: 0.9;
          }
          50% { 
            transform: translateX(10px) translateY(-5px);
            opacity: 1;
          }
        }
        
        @keyframes sparkle-twinkle {
          0%, 100% { 
            transform: scale(0);
            opacity: 0;
          }
          50% { 
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes feather-fall {
          0% { 
            transform: translateY(0) translateX(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% { 
            transform: translateY(100vh) translateX(50px) rotate(360deg);
            opacity: 0;
          }
        }
        
        @keyframes dove-fly {
          0% { 
            transform: translateX(-50px) translateY(0) scale(0);
            opacity: 0;
          }
          20% {
            transform: translateX(0) translateY(-10px) scale(1);
            opacity: 1;
          }
          80% {
            transform: translateX(100px) translateY(-20px) scale(1);
            opacity: 1;
          }
          100% { 
            transform: translateX(150px) translateY(-30px) scale(0.5);
            opacity: 0;
          }
        }
        
        @keyframes divine-glow {
          0%, 100% { 
            transform: scale(1);
            opacity: 0.5;
            box-shadow: 0 0 60px 30px rgba(255,215,0,0.5);
          }
          50% { 
            transform: scale(1.2);
            opacity: 0.8;
            box-shadow: 0 0 100px 50px rgba(255,215,0,0.7);
          }
        }
        
        @keyframes angel-appear {
          0% { 
            transform: scale(0) translateY(50px); 
            opacity: 0;
          }
          40% { 
            transform: scale(1.5) translateY(-20px); 
            opacity: 1;
          }
          60% { 
            transform: scale(1.2) translateY(-10px); 
            opacity: 1;
          }
          80% { 
            transform: scale(1.1) translateY(-5px); 
            opacity: 1;
          }
          100% { 
            transform: scale(1) translateY(0); 
            opacity: 0;
          }
        }
        
        .animate-heaven-overlay {
          animation: heaven-overlay 2s ease-out forwards;
        }
        
        .heaven-beam {
          background: linear-gradient(to bottom,
            rgba(255,215,0,0.9) 0%,
            rgba(255,255,200,0.6) 30%,
            rgba(255,255,255,0.3) 60%,
            transparent 100%
          );
          filter: blur(3px);
          animation: beam-shimmer 1.5s ease-in-out infinite;
        }
        
        .heaven-cloud {
          background: radial-gradient(ellipse at center,
            rgba(255,255,255,1) 0%,
            rgba(255,255,255,0.9) 40%,
            rgba(240,248,255,0.6) 70%,
            transparent 100%
          );
          border-radius: 50%;
          filter: blur(8px);
          animation: cloud-float 3s ease-in-out infinite;
        }
        
        .heaven-cloud-bright {
          background: radial-gradient(ellipse at center,
            rgba(255,255,255,1) 0%,
            rgba(255,250,220,0.95) 30%,
            rgba(255,255,255,0.7) 60%,
            transparent 100%
          );
          border-radius: 50%;
          filter: blur(5px);
          animation: cloud-float 2.5s ease-in-out infinite;
        }
        
        .heaven-sparkle {
          width: 8px;
          height: 8px;
          background: radial-gradient(circle, #ffffff 0%, #ffd700 50%, transparent 100%);
          border-radius: 50%;
          animation: sparkle-twinkle 1s ease-in-out infinite;
          box-shadow: 0 0 10px #ffd700;
        }
        
        .heaven-feather {
          font-size: 24px;
          animation: feather-fall 2.5s ease-in-out forwards;
          filter: drop-shadow(0 0 5px rgba(255,255,255,0.8));
        }
        
        .heaven-dove {
          font-size: 36px;
          animation: dove-fly 2s ease-out forwards;
          filter: drop-shadow(0 0 10px rgba(255,255,255,0.9));
        }
        
        .heaven-glow {
          background: radial-gradient(circle, rgba(255,215,0,0.4) 0%, transparent 70%);
          animation: divine-glow 1.5s ease-in-out infinite;
        }
        
        .animate-angel-appear {
          animation: angel-appear 2s ease-out forwards;
        }
      `}</style>
    </>
  );
}
