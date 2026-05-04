import { Info, HardHat, Wrench, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StatusBadge, RdvStatus } from "@/components/ui/status-badge";

const RDV_STATUSES: { status: RdvStatus; description: string }[] = [
  { status: "nouveau", description: "RDV à venir, non encore traité" },
  { status: "reporte", description: "RDV déplacé à une autre date" },
  { status: "r2", description: "Second rendez-vous" },
  { status: "r2_prestudy", description: "R2 avec pré-étude réalisée" },
  { status: "signe", description: "Vente signée à l'issue du RDV" },
  { status: "negatif", description: "RDV terminé sans vente" },
  { status: "annule", description: "RDV annulé par le client" },
  { status: "porte", description: "Personne à la porte / pas de contact" },
];

export function PlanningLegend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Afficher la légende du planning"
        >
          <Info className="h-3.5 w-3.5" />
          Légende
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Section types spéciaux */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Types de RDV
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs px-2 py-0.5 flex items-center gap-1 rounded-full shrink-0">
                  <HardHat className="h-3 w-3" />
                  Pose
                </Badge>
                <p className="text-xs text-muted-foreground leading-snug">
                  RDV d'installation généré automatiquement depuis une vente.
                  N'a pas de statut et n'est pas comptabilisé dans les
                  statistiques de RDV.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-2 py-0.5 flex items-center gap-1 rounded-full shrink-0">
                  <Wrench className="h-3 w-3" />
                  Externe
                </Badge>
                <p className="text-xs text-muted-foreground leading-snug">
                  Installation effectuée par une régie externe.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Badge className="bg-status-r2 hover:bg-status-r2/90 text-white text-xs px-2 py-0.5 flex items-center gap-1 rounded-full shrink-0">
                  <RefreshCw className="h-3 w-3" />
                  R2
                </Badge>
                <p className="text-xs text-muted-foreground leading-snug">
                  Second rendez-vous suite à un premier contact.
                </p>
              </div>
            </div>
          </div>

          {/* Section statuts */}
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Statuts de RDV
            </h4>
            <div className="space-y-2">
              {RDV_STATUSES.map((item) => (
                <div key={item.status} className="flex items-start gap-2.5">
                  <div className="shrink-0">
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
