import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import { WelcomeStep } from "./steps/WelcomeStep";
import { WhatsAppStep } from "./steps/WhatsAppStep";
import { GoogleStep } from "./steps/GoogleStep";
import { DataConfigStep } from "./steps/DataConfigStep";
import { CompletionStep } from "./steps/CompletionStep";

const STEPS = [
  { id: "welcome", label: "Bienvenue" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "google", label: "Google" },
  { id: "data", label: "Données" },
  { id: "complete", label: "Terminé" },
];

export function OnboardingDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Delay onboarding check to not block initial render
    if (!user) {
      setLoading(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      checkOnboardingStatus();
    }, 1000); // Wait 1 second after mount

    return () => clearTimeout(timeoutId);
  }, [user]);

  const checkOnboardingStatus = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Use Promise.race for timeout
      const fetchPromise = supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), 5000)
      );

      const result = await Promise.race([fetchPromise, timeoutPromise]) as any;
      
      if (result.error) {
        console.error("Error checking onboarding status:", result.error);
        setLoading(false);
        return;
      }

      // Show onboarding if not completed
      if (result.data && !result.data.onboarding_completed) {
        setOpen(true);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

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
        className="max-w-lg p-0 gap-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Progress bar */}
        <div className="px-6 pt-6">
          <Progress value={progress} className="h-1.5" />
          <div className="flex justify-between mt-2">
            {STEPS.map((step, index) => (
              <span
                key={step.id}
                className={`text-xs transition-colors ${
                  index <= currentStep
                    ? "text-primary font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="px-6 py-8 min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {currentStep === 0 && <WelcomeStep />}
              {currentStep === 1 && <WhatsAppStep />}
              {currentStep === 2 && <GoogleStep />}
              {currentStep === 3 && <DataConfigStep />}
              {currentStep === 4 && <CompletionStep />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="px-6 pb-6 flex items-center justify-between border-t pt-4 bg-muted/30">
          <div>
            {currentStep > 0 && currentStep < STEPS.length - 1 && (
              <Button variant="ghost" onClick={handlePrevious}>
                Précédent
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {currentStep < STEPS.length - 1 && (
              <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
                Passer
              </Button>
            )}
            {currentStep < STEPS.length - 1 ? (
              <Button onClick={handleNext}>
                Suivant
              </Button>
            ) : (
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                Commencer !
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
