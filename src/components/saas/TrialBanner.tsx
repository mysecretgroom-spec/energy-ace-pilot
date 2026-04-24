import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, X, ChevronDown, Check, Lock, Sparkles } from "lucide-react";
import { useState } from "react";
import { useSaasAccess } from "@/hooks/useSaasAccess";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { TRIAL_AGENT_FACTURE_LIMIT } from "@/hooks/useTrialFeatures";

interface TrialBannerProps {
  daysLeft: number;
}

export function TrialBanner({ daysLeft }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { accessState } = useSaasAccess();

  if (dismissed) return null;

  const urgent = daysLeft <= 3;
  const bgColor = urgent
    ? "bg-destructive/10 border-destructive/20"
    : "bg-primary/10 border-primary/20";
  const textColor = urgent ? "text-destructive" : "text-primary";

  const endDate = accessState?.trial_ends_at
    ? format(new Date(accessState.trial_ends_at), "d MMMM yyyy", { locale: fr })
    : null;

  const label =
    daysLeft === 0
      ? "Dernier jour d'essai gratuit !"
      : daysLeft === 1
        ? "Essai gratuit actif — plus qu'1 jour"
        : `Essai gratuit actif — ${daysLeft} jours restants`;

  return (
    <div className={`border-b ${bgColor}`}>
      <div className="px-4 py-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          aria-expanded={expanded}
        >
          <Sparkles className={`h-4 w-4 shrink-0 ${textColor}`} />
          <div className="flex flex-col min-w-0">
            <span className={`text-sm font-semibold ${textColor} truncate`}>
              {label}
            </span>
            {endDate && (
              <span className="text-[11px] text-muted-foreground truncate">
                Fin le {endDate}
              </span>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${textColor} ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <Link to="/abonnement">
            <Button size="sm" variant={urgent ? "destructive" : "default"}>
              S'abonner
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
            }}
            aria-label="Masquer"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-1 text-xs space-y-3 border-t border-border/40">
          <div>
            <p className="font-semibold text-foreground mb-1.5 flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-primary" />
              Inclus dans votre essai
            </p>
            <ul className="space-y-1 text-muted-foreground pl-5">
              <li>• Planning, RDV, clients & ventes illimités</li>
              <li>• CRM complet, pipeline & commissions</li>
              <li>• Études techniques (PV, PAC, ITE)</li>
              <li>• Scanner & gestion documentaire</li>
              <li>• Suivi financier & frais</li>
              <li>• Synchronisation Google (Agenda, Gmail)</li>
              <li>• Notifications WhatsApp client</li>
              <li>
                • Agent IA (limité à {TRIAL_AGENT_FACTURE_LIMIT} factures)
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1.5 flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              Réservé aux abonnés
            </p>
            <ul className="space-y-1 text-muted-foreground pl-5">
              <li>• Génération PDF des résultats d'étude</li>
              <li>• Mode HEJJA (prix de vente personnalisés)</li>
              <li>• Agent IA illimité</li>
            </ul>
          </div>
          <div className={`flex items-center gap-1.5 ${textColor}`}>
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium">
              {endDate
                ? `Votre essai se termine le ${endDate}`
                : `${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
