import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  ChevronRight, 
  ChevronLeft, 
  X, 
  User, 
  Building2, 
  Shield, 
  CheckCircle,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Step definitions
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  targetRoute: string;
  targetSelector?: string;
  completionCheck: () => Promise<boolean>;
  action?: () => void;
}

interface OnboardingContextType {
  isActive: boolean;
  currentStepIndex: number;
  currentStep: OnboardingStep | null;
  steps: OnboardingStep[];
  completedSteps: string[];
  start: () => void;
  next: () => void;
  previous: () => void;
  skip: () => void;
  complete: () => void;
  markStepComplete: (stepId: string) => void;
  refreshCompletionStatus: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function useInteractiveOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useInteractiveOnboarding must be used within InteractiveOnboardingProvider");
  }
  return context;
}

export function InteractiveOnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Define the onboarding steps
  const steps: OnboardingStep[] = [
    {
      id: "profile",
      title: "Votre Profil",
      description: "Complétez vos informations personnelles pour personnaliser l'application",
      icon: User,
      targetRoute: "/profil",
      targetSelector: "[data-onboarding='profile-form']",
      completionCheck: async () => {
        if (!user) return false;
        const { data } = await supabase
          .from("profiles")
          .select("first_name, last_name, phone")
          .eq("user_id", user.id)
          .maybeSingle();
        return !!(data?.first_name && data?.phone);
      },
    },
    {
      id: "regie",
      title: "Votre Régie",
      description: "Créez ou sélectionnez votre agence partenaire principale",
      icon: Building2,
      targetRoute: "/parametres/regies",
      targetSelector: "[data-onboarding='regie-list']",
      completionCheck: async () => {
        if (!user) return false;
        const { count } = await supabase
          .from("regies")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        return (count ?? 0) > 0;
      },
    },
    {
      id: "google",
      title: "Connexion Google",
      description: "Synchronisez votre agenda et vos emails automatiquement",
      icon: () => (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      ),
      targetRoute: "/parametres",
      targetSelector: "[data-onboarding='google-connect']",
      completionCheck: async () => {
        if (!user) return false;
        const { data } = await supabase
          .from("google_tokens")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        return !!data;
      },
    },
    {
      id: "security",
      title: "Sécurité",
      description: "Configurez votre code PIN et l'authentification à deux facteurs",
      icon: Shield,
      targetRoute: "/parametres/securite",
      targetSelector: "[data-onboarding='security-settings']",
      completionCheck: async () => {
        if (!user) return false;
        const { data } = await supabase
          .from("profiles")
          .select("pin_code")
          .eq("user_id", user.id)
          .maybeSingle();
        return !!data?.pin_code;
      },
    },
  ];

  const currentStep = steps[currentStepIndex] || null;

  // Check if onboarding should be shown
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const checkOnboarding = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data && !data.onboarding_completed) {
          // Check which steps are already completed
          await refreshCompletionStatus();
          setIsActive(true);
        }
      } catch (err) {
        console.warn("Onboarding check failed:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(checkOnboarding, 1500);
    return () => clearTimeout(timer);
  }, [user]);

  const refreshCompletionStatus = useCallback(async () => {
    const completed: string[] = [];
    for (const step of steps) {
      const isComplete = await step.completionCheck();
      if (isComplete) {
        completed.push(step.id);
      }
    }
    setCompletedSteps(completed);

    // Find first incomplete step
    const firstIncompleteIndex = steps.findIndex(s => !completed.includes(s.id));
    if (firstIncompleteIndex !== -1) {
      setCurrentStepIndex(firstIncompleteIndex);
    }
  }, [steps]);

  const start = useCallback(() => {
    setIsActive(true);
    setCurrentStepIndex(0);
    refreshCompletionStatus();
  }, [refreshCompletionStatus]);

  const next = useCallback(async () => {
    // Refresh completion status before moving
    await refreshCompletionStatus();
    
    if (currentStepIndex < steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      navigate(steps[nextIndex].targetRoute);
    } else {
      // All steps done
      complete();
    }
  }, [currentStepIndex, steps, navigate, refreshCompletionStatus]);

  const previous = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      navigate(steps[prevIndex].targetRoute);
    }
  }, [currentStepIndex, steps, navigate]);

  const skip = useCallback(async () => {
    // Skip current step and find next incomplete
    const nextIncompleteIndex = steps.findIndex(
      (s, i) => i > currentStepIndex && !completedSteps.includes(s.id)
    );

    if (nextIncompleteIndex !== -1) {
      setCurrentStepIndex(nextIncompleteIndex);
      navigate(steps[nextIncompleteIndex].targetRoute);
    } else {
      // All remaining steps are complete or skipped
      complete();
    }
  }, [currentStepIndex, steps, completedSteps, navigate]);

  const complete = useCallback(async () => {
    if (!user) return;

    try {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("user_id", user.id);

      setIsActive(false);
    } catch (err) {
      console.error("Error completing onboarding:", err);
    }
  }, [user]);

  const markStepComplete = useCallback((stepId: string) => {
    setCompletedSteps(prev => {
      if (prev.includes(stepId)) return prev;
      return [...prev, stepId];
    });
  }, []);

  // Navigate to current step's route when step changes
  useEffect(() => {
    if (isActive && currentStep && location.pathname !== currentStep.targetRoute) {
      navigate(currentStep.targetRoute);
    }
  }, [isActive, currentStep, navigate, location.pathname]);

  const contextValue: OnboardingContextType = {
    isActive,
    currentStepIndex,
    currentStep,
    steps,
    completedSteps,
    start,
    next,
    previous,
    skip,
    complete,
    markStepComplete,
    refreshCompletionStatus,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      {isActive && !loading && <OnboardingOverlay />}
    </OnboardingContext.Provider>
  );
}

// The overlay component that shows spotlight and tooltip
function OnboardingOverlay() {
  const {
    currentStep,
    currentStepIndex,
    steps,
    completedSteps,
    next,
    previous,
    skip,
    complete,
    refreshCompletionStatus,
  } = useInteractiveOnboarding();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isStepComplete, setIsStepComplete] = useState(false);

  // Find and highlight target element
  useEffect(() => {
    if (!currentStep?.targetSelector) {
      setTargetRect(null);
      return;
    }

    const findTarget = () => {
      const el = document.querySelector(currentStep.targetSelector!);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    };

    // Initial find
    findTarget();

    // Re-check periodically in case DOM changes
    const interval = setInterval(findTarget, 500);

    // Also listen to resize/scroll
    window.addEventListener("resize", findTarget);
    window.addEventListener("scroll", findTarget, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", findTarget);
      window.removeEventListener("scroll", findTarget, true);
    };
  }, [currentStep?.targetSelector]);

  // Check if current step is complete
  useEffect(() => {
    if (!currentStep) return;

    const checkComplete = async () => {
      const complete = await currentStep.completionCheck();
      setIsStepComplete(complete);
    };

    checkComplete();
    const interval = setInterval(checkComplete, 2000);

    return () => clearInterval(interval);
  }, [currentStep]);

  const allComplete = steps.every(s => completedSteps.includes(s.id));
  const progress = ((completedSteps.length) / steps.length) * 100;

  if (!currentStep) return null;

  const StepIcon = currentStep.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] pointer-events-none">
        {/* Dark overlay with spotlight cutout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-auto"
          style={{
            background: targetRect
              ? `radial-gradient(ellipse 400px 300px at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent 0%, rgba(0,0,0,0.75) 100%)`
              : "rgba(0,0,0,0.75)",
          }}
        />

        {/* Spotlight ring around target */}
        {targetRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute pointer-events-none"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              borderRadius: 12,
              border: "2px solid hsl(var(--primary))",
              boxShadow: "0 0 0 4px hsl(var(--primary) / 0.2), 0 0 30px hsl(var(--primary) / 0.3)",
            }}
          >
            {/* Pulsing animation */}
            <motion.div
              animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.2, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 rounded-xl border-2 border-primary"
            />
          </motion.div>
        )}

        {/* Tooltip card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={cn(
            "absolute pointer-events-auto bg-card border border-border rounded-2xl shadow-2xl p-4 sm:p-5 w-[calc(100%-2rem)] sm:w-80 max-w-sm",
            targetRect 
              ? targetRect.top > window.innerHeight / 2
                ? "bottom-auto"
                : "top-auto"
              : ""
          )}
          style={{
            left: "50%",
            transform: "translateX(-50%)",
            ...(targetRect 
              ? targetRect.top > window.innerHeight / 2
                ? { top: Math.max(16, targetRect.top - 200) }
                : { top: Math.min(window.innerHeight - 250, targetRect.bottom + 16) }
              : { bottom: 100 }
            ),
          }}
        >
          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {currentStepIndex + 1}/{steps.length}
            </span>
          </div>

          {/* Step content */}
          <div className="flex items-start gap-3 mb-4">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              isStepComplete 
                ? "bg-green-500/10 text-green-600" 
                : "bg-primary/10 text-primary"
            )}>
              {isStepComplete ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <StepIcon className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                {currentStep.title}
                {isStepComplete && (
                  <span className="text-[10px] font-medium text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded">
                    ✓ Fait
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {currentStep.description}
              </p>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex justify-center gap-1.5 mb-4">
            {steps.map((step, i) => (
              <div
                key={step.id}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  completedSteps.includes(step.id)
                    ? "bg-green-500 w-3"
                    : i === currentStepIndex
                    ? "bg-primary w-5"
                    : "bg-muted w-2"
                )}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-2">
            <div>
              {currentStepIndex > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={previous}
                  className="h-9 px-3 touch-manipulation"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Retour
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {!isStepComplete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skip}
                  className="h-9 px-3 text-muted-foreground touch-manipulation"
                >
                  Passer
                </Button>
              )}

              {isStepComplete ? (
                currentStepIndex < steps.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={next}
                    className="h-9 px-4 gap-1 touch-manipulation active:scale-95 transition-transform"
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={complete}
                    className="h-9 px-4 gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 touch-manipulation active:scale-95"
                  >
                    <Sparkles className="h-4 w-4" />
                    Terminer
                  </Button>
                )
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refreshCompletionStatus()}
                  className="h-9 px-4 gap-1 touch-manipulation"
                >
                  <ArrowRight className="h-4 w-4" />
                  Vérifier
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Skip all button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={complete}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60 hover:text-white/90 transition-colors pointer-events-auto touch-manipulation"
        >
          Passer la configuration →
        </motion.button>
      </div>
    </AnimatePresence>
  );
}
