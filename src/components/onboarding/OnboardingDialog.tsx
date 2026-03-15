import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronLeft, X, Sparkles, CheckCircle } from "lucide-react";

import { WelcomeStep } from "./steps/WelcomeStep";
import { FeaturesStep } from "./steps/FeaturesStep";
import { SettingsStep } from "./steps/SettingsStep";
import { AgentInstructionsStep } from "./steps/AgentInstructionsStep";
import { HejjaModeStep } from "./steps/HejjaModeStep";
import { WhatsAppStep } from "./steps/WhatsAppStep";
import { GoogleStep } from "./steps/GoogleStep";
import { DataConfigStep } from "./steps/DataConfigStep";
import { CompletionStep } from "./steps/CompletionStep";

const STEPS = [
  { id: "welcome", label: "Bienvenue", required: false },
  { id: "features", label: "Fonctionnalités", required: false },
  { id: "settings", label: "Paramètres", required: false },
  { id: "agent", label: "Agent IA", required: false },
  { id: "hejja", label: "Mode HEJJA", required: false },
  { id: "whatsapp", label: "WhatsApp", required: false },
  { id: "google", label: "Google", required: false },
  { id: "data", label: "Données", required: false },
  { id: "complete", label: "Terminé", required: false },
];

export function OnboardingDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Delay 2s to ensure app is fully loaded first
    const timeoutId = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data && !data.onboarding_completed) {
          setOpen(true);
        }
      } catch (err) {
        console.warn("Onboarding check failed:", err);
      } finally {
        setLoading(false);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [user]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    try {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("user_id", user.id);

      setOpen(false);
    } catch (err) {
      console.error("Error completing onboarding:", err);
    }
  };

  const handleSkip = async () => {
    await handleComplete();
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  if (loading || !user) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-lg p-0 gap-0 overflow-hidden max-h-[85dvh] sm:max-h-[85vh] w-[calc(100%-2rem)] sm:w-full rounded-2xl sm:rounded-xl top-[50%] translate-y-[-50%]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header with progress - compact on mobile */}
        <div className="relative px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 bg-gradient-to-b from-primary/5 to-transparent">
          {/* Step indicator - smaller on mobile */}
          <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-2 sm:mb-4">
            {STEPS.map((step, index) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  "h-1 sm:h-1.5 rounded-full transition-all duration-300 touch-manipulation",
                  index === currentStep
                    ? "bg-primary w-6 sm:w-8"
                    : index < currentStep
                    ? "bg-primary/60 w-2 sm:w-3"
                    : "bg-muted w-2 sm:w-3"
                )}
              />
            ))}
          </div>
          
          {/* Step label */}
          <div className="text-center">
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">
              {currentStep + 1}/{STEPS.length} • {STEPS[currentStep].label}
            </span>
          </div>
        </div>

        {/* Step content - optimized scroll for mobile */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 overflow-y-auto max-h-[55vh] sm:max-h-[60vh] overscroll-contain">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {currentStep === 0 && <WelcomeStep />}
              {currentStep === 1 && <FeaturesStep />}
              {currentStep === 2 && <SettingsStep />}
              {currentStep === 3 && <AgentInstructionsStep />}
              {currentStep === 4 && <HejjaModeStep />}
              {currentStep === 5 && <WhatsAppStep />}
              {currentStep === 6 && <GoogleStep />}
              {currentStep === 7 && <DataConfigStep />}
              {currentStep === 8 && <CompletionStep />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation - touch-friendly on mobile */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-t bg-muted/20 gap-2">
          <div className="min-w-0">
            {currentStep > 0 && currentStep < STEPS.length - 1 && (
              <Button 
                variant="ghost" 
                onClick={handlePrevious}
                className="gap-1 h-10 sm:h-9 px-2 sm:px-3 touch-manipulation"
                size="sm"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Retour</span>
              </Button>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {currentStep < STEPS.length - 1 && currentStep > 0 && (
              <Button 
                variant="ghost" 
                onClick={handleSkip} 
                className="text-muted-foreground h-10 sm:h-9 px-3 touch-manipulation"
                size="sm"
              >
                Passer
              </Button>
            )}
            {currentStep < STEPS.length - 1 ? (
              <Button 
                onClick={handleNext} 
                className="gap-1 h-10 sm:h-9 px-4 sm:px-3 touch-manipulation active:scale-95 transition-transform"
                size="sm"
              >
                {currentStep === 0 ? "Commencer" : "Suivant"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleComplete} 
                className="gap-2 h-10 sm:h-9 px-4 sm:px-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 touch-manipulation active:scale-95 transition-transform"
                size="sm"
              >
                <Sparkles className="h-4 w-4" />
                C'est parti !
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
