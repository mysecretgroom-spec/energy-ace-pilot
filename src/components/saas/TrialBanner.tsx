import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, X } from "lucide-react";
import { useState } from "react";

interface TrialBannerProps {
  daysLeft: number;
}

export function TrialBanner({ daysLeft }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || daysLeft > 7) return null;

  const urgency = daysLeft <= 3 ? "destructive" : "default";
  const bgColor = daysLeft <= 3 
    ? "bg-destructive/10 border-destructive/20" 
    : "bg-primary/10 border-primary/20";
  const textColor = daysLeft <= 3 ? "text-destructive" : "text-primary";

  return (
    <div className={`border-b ${bgColor} px-4 py-2 flex items-center justify-between`}>
      <div className="flex items-center gap-2">
        <Clock className={`h-4 w-4 ${textColor}`} />
        <span className={`text-sm font-medium ${textColor}`}>
          {daysLeft === 0 
            ? "Dernier jour d'essai !" 
            : daysLeft === 1 
              ? "Plus qu'1 jour d'essai" 
              : `${daysLeft} jours d'essai restants`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/abonnement">
          <Button size="sm" variant={urgency === "destructive" ? "destructive" : "default"}>
            S'abonner
          </Button>
        </Link>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
