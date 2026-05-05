import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  X,
  Building2,
  CalendarPlus,
  FileSearch,
  FileSignature,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const STORAGE_KEY = "onboarding_checklist_dismissed_v1";
const COLLAPSED_KEY = "onboarding_checklist_collapsed_v1";

interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  done: boolean;
}

export function OnboardingChecklist() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  });

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const { data: progress } = useQuery({
    queryKey: ["onboarding-progress", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const uid = user.id;

      const [regies, bouquets, rdvs, etudes, ventes] = await Promise.all([
        supabase.from("regies").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("bouquets").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("rdv").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("etudes").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("ventes").select("id", { count: "exact", head: true }).eq("user_id", uid),
      ]);

      return {
        hasRegie: (regies.count || 0) > 0,
        hasBouquet: (bouquets.count || 0) > 0,
        hasRdv: (rdvs.count || 0) > 0,
        hasEtude: (etudes.count || 0) > 0,
        hasVente: (ventes.count || 0) > 0,
      };
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  if (dismissed || !progress) return null;

  const steps: ChecklistStep[] = [
    {
      id: "regie",
      title: "Créer une régie",
      description: "Ajoute ta première régie (agence) pour démarrer.",
      icon: Building2,
      to: "/parametres",
      done: progress.hasRegie,
    },
    {
      id: "bouquet",
      title: "Configurer les tarifs",
      description: "Renseigne au moins un bouquet de prix dans la régie.",
      icon: Sparkles,
      to: "/parametres",
      done: progress.hasBouquet,
    },
    {
      id: "rdv",
      title: "Ajouter un premier RDV",
      description: "Crée un RDV manuellement ou importe via Gmail.",
      icon: CalendarPlus,
      to: "/planning",
      done: progress.hasRdv,
    },
    {
      id: "etude",
      title: "Lancer une étude",
      description: "Réalise ta première étude depuis un RDV.",
      icon: FileSearch,
      to: "/planning",
      done: progress.hasEtude,
    },
    {
      id: "vente",
      title: "Enregistrer une vente",
      description: "Signe ton premier dossier depuis le CRM.",
      icon: FileSignature,
      to: "/crm",
      done: progress.hasVente,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = doneCount === total;
  const pct = Math.round((doneCount / total) * 100);

  if (allDone) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <Card className="shadow-card border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex-1 text-left flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-display font-semibold text-foreground text-sm">
                Prise en main · {doneCount}/{total}
              </h3>
              <p className="text-xs text-muted-foreground">
                Quelques étapes pour démarrer en douceur
              </p>
            </div>
            {collapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 -mt-1 -mr-1"
            onClick={handleDismiss}
            aria-label="Masquer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Progress value={pct} className="h-1.5" />

        {!collapsed && (
          <ul className="space-y-1.5 pt-1">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.id}>
                  <Link
                    to={step.to}
                    className={`flex items-center gap-3 rounded-lg p-2 transition-colors ${
                      step.done
                        ? "opacity-60"
                        : "hover:bg-primary/5 active:bg-primary/10"
                    }`}
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          step.done
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {step.title}
                      </p>
                      {!step.done && (
                        <p className="text-xs text-muted-foreground truncate">
                          {step.description}
                        </p>
                      )}
                    </div>
                    {!step.done && (
                      <Icon className="h-4 w-4 text-primary/70 flex-shrink-0" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
