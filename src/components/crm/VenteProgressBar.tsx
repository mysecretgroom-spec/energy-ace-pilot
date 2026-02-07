import { cn } from "@/lib/utils";

type VenteStatus = 'en_negociation' | 'signe' | 'cq_a_faire' | 'cq_fait' | 'attente_financement' | 'envoi_pose' | 'en_installation' | 'installe' | 'attente_paiement' | 'paye' | 'annule';

const PIPELINE_STEPS: { status: VenteStatus; label: string }[] = [
  { status: "signe", label: "Signé" },
  { status: "cq_a_faire", label: "CQ" },
  { status: "attente_financement", label: "Finance" },
  { status: "envoi_pose", label: "Pose" },
  { status: "installe", label: "Posé" },
  { status: "paye", label: "Payé" },
];

interface VenteProgressBarProps {
  status: VenteStatus;
  className?: string;
}

export function VenteProgressBar({ status, className }: VenteProgressBarProps) {
  if (status === "annule" || status === "en_negociation") return null;

  // Map combined statuses to pipeline index
  const getStepIndex = (s: VenteStatus): number => {
    switch (s) {
      case "signe": return 0;
      case "cq_a_faire":
      case "cq_fait": return 1;
      case "attente_financement": return 2;
      case "envoi_pose":
      case "en_installation": return 3;
      case "installe":
      case "attente_paiement": return 4;
      case "paye": return 5;
      default: return -1;
    }
  };

  const currentStep = getStepIndex(status);
  if (currentStep < 0) return null;

  const progressPct = ((currentStep + 1) / PIPELINE_STEPS.length) * 100;

  return (
    <div className={cn("space-y-1", className)}>
      {/* Bar */}
      <div className="relative h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-green-500 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      {/* Step dots */}
      <div className="flex justify-between">
        {PIPELINE_STEPS.map((step, i) => (
          <div key={step.status} className="flex flex-col items-center">
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                i <= currentStep ? "bg-primary" : "bg-muted-foreground/30"
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
