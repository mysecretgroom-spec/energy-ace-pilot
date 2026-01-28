import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  ChevronRight, 
  ChevronLeft, 
  User, 
  Building2, 
  Shield, 
  CheckCircle,
  Sparkles,
  Sun,
  Calendar,
  FileText,
  BarChart3,
  Bot,
  Zap,
  Flame,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileConfigStep } from "./steps/ProfileConfigStep";
import { RegieConfigStep } from "./steps/RegieConfigStep";
import { GoogleConfigStep } from "./steps/GoogleConfigStep";
import { SecurityConfigStep } from "./steps/SecurityConfigStep";

// Step definitions
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  type: "presentation" | "config";
  content?: ReactNode;
  configComponent?: React.ComponentType<{ onComplete: () => void }>;
  completionCheck?: () => Promise<boolean>;
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
  skipPresentation: () => void;
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

// Presentation content components
function WelcomeContent() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: Calendar, label: "Planning", color: "text-blue-500" },
          { icon: FileText, label: "Études", color: "text-amber-500" },
          { icon: BarChart3, label: "CRM", color: "text-purple-500" },
          { icon: Bot, label: "IA", color: "text-green-500" },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Icon className={cn("h-4 w-4", color)} />
            <span className="text-xs font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeaturesContent() {
  return (
    <div className="space-y-2">
      {[
        { icon: Calendar, title: "Planning intelligent", desc: "Gérez vos RDV avec sync Google" },
        { icon: FileText, title: "Études automatiques", desc: "Devis PV, PAC, ITE en 2 min" },
        { icon: BarChart3, title: "CRM intégré", desc: "Suivez vos ventes de A à Z" },
      ].map(({ icon: Icon, title, desc }) => (
        <div key={title} className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/30">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium">{title}</p>
            <p className="text-[10px] text-muted-foreground">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AIContent() {
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="h-4 w-4 text-green-600" />
          <span className="text-xs font-semibold text-green-700 dark:text-green-400">Assistant IA 24h/24</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Posez vos questions, obtenez des analyses et automatisez vos tâches répétitives.
        </p>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Zap className="h-3 w-3 text-amber-500" />
        <span>Accessible via le bouton chat en bas à droite</span>
      </div>
    </div>
  );
}

function HejjaContent() {
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Flame className="h-4 w-4 text-orange-600" />
          <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">Mode HEJJA</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Accès aux fonctionnalités avancées : données sensibles, prix sans plafond, mode sombre.
        </p>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Shield className="h-3 w-3 text-red-500" />
        <span>Protégé par code PIN • Bouton 🔥 en bas à gauche</span>
      </div>
    </div>
  );
}

export function InteractiveOnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Define all onboarding steps - presentation first, then config
  const steps: OnboardingStep[] = [
    // === PRESENTATION STEPS (skippable) ===
    {
      id: "welcome",
      title: "Bienvenue sur DébalePro",
      description: "L'app tout-en-un pour les commerciaux ENR",
      icon: Sun,
      type: "presentation",
      content: <WelcomeContent />,
    },
    {
      id: "features",
      title: "Fonctionnalités Clés",
      description: "Tout ce dont vous avez besoin au quotidien",
      icon: Zap,
      type: "presentation",
      content: <FeaturesContent />,
    },
    {
      id: "ai-intro",
      title: "Assistant IA",
      description: "Votre copilote intelligent",
      icon: Bot,
      type: "presentation",
      content: <AIContent />,
    },
    {
      id: "hejja-intro",
      title: "Mode Expert",
      description: "Fonctionnalités avancées",
      icon: Flame,
      type: "presentation",
      content: <HejjaContent />,
    },
    // === CONFIG STEPS (with inline forms) ===
    {
      id: "profile",
      title: "Votre Profil",
      description: "Complétez vos informations personnelles",
      icon: User,
      type: "config",
      configComponent: ProfileConfigStep,
      completionCheck: async () => {
        if (!user) return false;
        const { data } = await supabase
          .from("profiles")
          .select("first_name, phone")
          .eq("user_id", user.id)
          .maybeSingle();
        return !!(data?.first_name && data?.phone);
      },
    },
    {
      id: "regie",
      title: "Votre Régie",
      description: "Créez votre agence partenaire principale",
      icon: Building2,
      type: "config",
      configComponent: RegieConfigStep,
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
      description: "Synchronisez agenda et emails",
      icon: () => (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      ),
      type: "config",
      configComponent: GoogleConfigStep,
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
      description: "Configurez votre code PIN",
      icon: Shield,
      type: "config",
      configComponent: SecurityConfigStep,
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
  const configSteps = steps.filter(s => s.type === "config");
  const presentationSteps = steps.filter(s => s.type === "presentation");

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
      if (step.type === "config" && step.completionCheck) {
        const isComplete = await step.completionCheck();
        if (isComplete) {
          completed.push(step.id);
        }
      }
    }
    setCompletedSteps(completed);
  }, [steps]);

  const start = useCallback(() => {
    setIsActive(true);
    setCurrentStepIndex(0);
    refreshCompletionStatus();
  }, [refreshCompletionStatus]);

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

  const next = useCallback(async () => {
    const current = steps[currentStepIndex];
    
    // For config steps, verify completion before advancing
    if (current?.type === "config" && current.completionCheck) {
      const isComplete = await current.completionCheck();
      if (isComplete) {
        setCompletedSteps(prev => 
          prev.includes(current.id) ? prev : [...prev, current.id]
        );
      }
    }
    
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      complete();
    }
  }, [currentStepIndex, steps, complete]);

  const previous = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex]);

  const skipPresentation = useCallback(() => {
    const firstConfigIndex = steps.findIndex(s => s.type === "config");
    if (firstConfigIndex !== -1) {
      setCurrentStepIndex(firstConfigIndex);
    }
  }, [steps]);

  const markStepComplete = useCallback((stepId: string) => {
    setCompletedSteps(prev => {
      if (prev.includes(stepId)) return prev;
      return [...prev, stepId];
    });
  }, []);

  const contextValue: OnboardingContextType = {
    isActive,
    currentStepIndex,
    currentStep,
    steps,
    completedSteps,
    start,
    next,
    previous,
    skipPresentation,
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

// The overlay component
function OnboardingOverlay() {
  const {
    currentStep,
    currentStepIndex,
    steps,
    completedSteps,
    next,
    previous,
    skipPresentation,
    complete,
  } = useInteractiveOnboarding();

  const isPresentation = currentStep?.type === "presentation";
  const presentationSteps = steps.filter(s => s.type === "presentation");
  const configSteps = steps.filter(s => s.type === "config");
  
  const configCompletedCount = completedSteps.filter(id => 
    configSteps.some(s => s.id === id)
  ).length;
  const progress = isPresentation 
    ? ((currentStepIndex + 1) / presentationSteps.length) * 50
    : 50 + (configCompletedCount / configSteps.length) * 50;

  if (!currentStep) return null;

  const StepIcon = currentStep.icon;
  const isLastStep = currentStepIndex === steps.length - 1;
  const allConfigComplete = configSteps.every(s => completedSteps.includes(s.id));
  const ConfigComponent = currentStep.configComponent;

  const handleConfigComplete = () => {
    next();
  };

  return (
    <AnimatePresence mode="wait">
      <div className="fixed inset-0 z-[100] pointer-events-none">
        {/* Dark overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-auto bg-black/85"
        />

        {/* Main card - centered */}
        <motion.div
          key={currentStep.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={cn(
            "pointer-events-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden",
            "fixed inset-x-4 top-1/2 -translate-y-1/2",
            "sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[400px] sm:max-w-[90vw]",
            "max-h-[85vh] overflow-y-auto"
          )}
        >
          {/* Header gradient */}
          <div className="h-1.5 bg-gradient-to-r from-primary via-primary/60 to-primary" />

          <div className="p-4 sm:p-5">
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">
                {currentStepIndex + 1}/{steps.length}
              </span>
            </div>

            {/* Step header */}
            <div className="flex items-start gap-3 mb-4">
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                  isPresentation
                    ? "bg-gradient-to-br from-primary/20 to-primary/10 text-primary"
                    : completedSteps.includes(currentStep.id)
                      ? "bg-green-500/10 text-green-600"
                      : "bg-primary/10 text-primary"
                )}
              >
                {completedSteps.includes(currentStep.id) && !isPresentation ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <StepIcon className="h-5 w-5" />
                )}
              </motion.div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  {currentStep.title}
                  {isPresentation && (
                    <span className="text-[10px] font-medium text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">
                      Intro
                    </span>
                  )}
                  {!isPresentation && completedSteps.includes(currentStep.id) && (
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

            {/* Content: Presentation or Config form */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-4"
            >
              {isPresentation && currentStep.content}
              {!isPresentation && ConfigComponent && (
                <ConfigComponent onComplete={handleConfigComplete} />
              )}
            </motion.div>

            {/* Step indicators */}
            <div className="flex justify-center gap-1 mb-4">
              {presentationSteps.map((step, i) => (
                <div
                  key={step.id}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i < currentStepIndex
                      ? "bg-primary/50 w-2"
                      : i === currentStepIndex && isPresentation
                        ? "bg-primary w-4"
                        : "bg-muted w-1.5"
                  )}
                />
              ))}
              <div className="w-1" />
              {configSteps.map((step, i) => {
                const configIndex = presentationSteps.length + i;
                return (
                  <div
                    key={step.id}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      completedSteps.includes(step.id)
                        ? "bg-green-500 w-2"
                        : configIndex === currentStepIndex
                          ? "bg-primary w-4"
                          : "bg-muted w-1.5"
                    )}
                  />
                );
              })}
            </div>

            {/* Navigation - Only for presentation steps */}
            {isPresentation && (
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={skipPresentation}
                    className="h-9 px-3 text-muted-foreground touch-manipulation gap-1"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    Passer l'intro
                  </Button>

                  <Button
                    size="sm"
                    onClick={next}
                    className="h-9 px-4 gap-1 touch-manipulation active:scale-95 transition-transform"
                  >
                    Continuer
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Back button for config steps - only show if not first config step */}
            {!isPresentation && currentStepIndex > presentationSteps.length && (
              <div className="flex justify-start mt-2 pt-2 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={previous}
                  className="h-8 px-2 touch-manipulation text-muted-foreground text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                  Étape précédente
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Skip all button (bottom) */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={complete}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/50 hover:text-white/80 transition-colors pointer-events-auto touch-manipulation"
        >
          Passer toute la configuration →
        </motion.button>
      </div>
    </AnimatePresence>
  );
}
