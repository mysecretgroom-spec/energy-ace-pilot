import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useInteractiveOnboarding } from "./InteractiveOnboarding";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, X, User, Building2, Mail, Shield, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MissingItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const DISMISS_KEY = "onboarding_banner_dismissed_until";

export function OnboardingBanner() {
  const { user } = useAuth();
  const { start, isActive } = useInteractiveOnboarding();
  const [missing, setMissing] = useState<MissingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    // Check session-level dismissal (snooze 24h)
    try {
      const until = localStorage.getItem(DISMISS_KEY);
      if (until && Date.now() < parseInt(until, 10)) {
        setDismissed(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!user || isActive) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const checkConfig = async () => {
      try {
        const [profileRes, regieRes, googleRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("first_name, phone, onboarding_completed")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("regies")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("google_tokens")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const items: MissingItem[] = [];
        const profile = profileRes.data;
        setOnboardingCompleted(profile?.onboarding_completed ?? false);

        if (!profile?.first_name || !profile?.phone) {
          items.push({ id: "profile", label: "Profil", icon: User });
        }
        if ((regieRes.count ?? 0) === 0) {
          items.push({ id: "regie", label: "Régie", icon: Building2 });
        }
        if (!googleRes.data) {
          items.push({ id: "google", label: "Google", icon: Mail });
        }

        setMissing(items);
      } catch (err) {
        console.warn("[OnboardingBanner] check failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    checkConfig();
    return () => {
      cancelled = true;
    };
  }, [user, isActive]);

  const handleSnooze = () => {
    try {
      // snooze for 24h
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    } catch {}
    setDismissed(true);
  };

  if (loading || dismissed || isActive) return null;
  if (missing.length === 0) return null;

  const isResume = onboardingCompleted === false;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-primary/20",
          "bg-gradient-to-br from-primary/10 via-primary/5 to-background",
          "shadow-sm"
        )}
      >
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">
                    {isResume ? "Terminez votre configuration" : "Finalisez votre profil"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {missing.length === 1
                      ? "Il reste une étape pour profiter pleinement de l'app."
                      : `${missing.length} étapes à compléter pour démarrer sereinement.`}
                  </p>
                </div>
                <button
                  onClick={handleSnooze}
                  className="shrink-0 -mr-1 -mt-1 p-1 rounded-md hover:bg-muted/60 text-muted-foreground"
                  aria-label="Reporter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Missing items chips */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {missing.map((item) => {
                  const Icon = item.icon;
                  return (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background/80 border border-border text-[11px] font-medium text-foreground"
                    >
                      <Icon className="h-3 w-3 text-primary" />
                      {item.label}
                    </span>
                  );
                })}
              </div>

              <Button
                onClick={start}
                size="sm"
                className="mt-3 h-9 w-full sm:w-auto gap-1.5 touch-manipulation active:scale-[0.98] transition-transform"
              >
                {isResume ? "Reprendre" : "Commencer"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
