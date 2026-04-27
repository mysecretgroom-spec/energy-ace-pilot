import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Info, ChevronDown, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import {
  VENTE_STATUS_LABELS,
  CANCELLATION_STATUSES,
  type VenteStatus,
} from "@/lib/venteStatusConfig";

interface VenteForLegend {
  id: string;
  status: string;
}

interface RegieStatusLegendProps {
  ventes: VenteForLegend[];
}

/** Statuts inclus dans le pipeline & calculs CA/Commissions */
const INCLUDED_STATUSES: { status: VenteStatus; group: "signes" | "poses" | "payes" }[] = [
  { status: "signe", group: "signes" },
  { status: "cq_a_faire", group: "signes" },
  { status: "cq_fait", group: "signes" },
  { status: "attente_financement", group: "signes" },
  { status: "envoi_pose", group: "poses" },
  { status: "en_installation", group: "poses" },
  { status: "installe", group: "poses" },
  { status: "attente_paiement", group: "poses" },
  { status: "paye", group: "payes" },
];

/** Statuts non encore comptabilisés (en amont du pipeline) */
const PENDING_STATUSES: VenteStatus[] = ["en_negociation"];

const groupColors = {
  signes: "bg-blue-500/10 text-blue-700 border-blue-200",
  poses: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  payes: "bg-green-500/10 text-green-700 border-green-200",
};

const groupLabels = {
  signes: "Signées",
  poses: "Posées",
  payes: "Payées",
};

export const RegieStatusLegend = ({ ventes }: RegieStatusLegendProps) => {
  const [open, setOpen] = useState(false);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    ventes.forEach((v) => {
      map[v.status] = (map[v.status] || 0) + 1;
    });
    return map;
  }, [ventes]);

  const includedCount = INCLUDED_STATUSES.reduce(
    (sum, s) => sum + (counts[s.status] || 0),
    0,
  );
  const excludedCount = CANCELLATION_STATUSES.reduce(
    (sum, s) => sum + (counts[s] || 0),
    0,
  );
  const pendingCount = PENDING_STATUSES.reduce(
    (sum, s) => sum + (counts[s] || 0),
    0,
  );

  return (
    <Card className="border-primary/20">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-accent/30 transition-colors">
            <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Quels dossiers sont comptés ?
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              />
            </CardTitle>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {includedCount} inclus
              </Badge>
              {pendingCount > 0 && (
                <Badge className="bg-amber-500/10 text-amber-700 border-amber-200">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {pendingCount} en amont
                </Badge>
              )}
              {excludedCount > 0 && (
                <Badge className="bg-red-500/10 text-red-700 border-red-200">
                  <XCircle className="h-3 w-3 mr-1" />
                  {excludedCount} exclus
                </Badge>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Inclus */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-emerald-700">
                  Inclus dans l'état des lieux
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Ces statuts comptent dans le CA, le pipeline et les commissions de la régie.
              </p>
              <ul className="space-y-1.5">
                {INCLUDED_STATUSES.map(({ status, group }) => {
                  const count = counts[status] || 0;
                  return (
                    <li
                      key={status}
                      className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-accent/30"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${groupColors[group]}`}>
                          {groupLabels[group]}
                        </span>
                        <span className="truncate">{VENTE_STATUS_LABELS[status]}</span>
                      </div>
                      <span className={`font-medium tabular-nums ${count > 0 ? "text-foreground" : "text-muted-foreground/50"}`}>
                        {count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* En amont (non comptés) */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-amber-700">
                  Pas encore dans le pipeline
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Dossier en cours, pas encore signé. N'apparaît pas tant qu'il n'est pas
                passé au statut <span className="font-medium">Signé</span>.
              </p>
              <ul className="space-y-1.5">
                {PENDING_STATUSES.map((status) => {
                  const count = counts[status] || 0;
                  return (
                    <li
                      key={status}
                      className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-accent/30"
                    >
                      <span className="truncate">{VENTE_STATUS_LABELS[status]}</span>
                      <span className={`font-medium tabular-nums ${count > 0 ? "text-foreground" : "text-muted-foreground/50"}`}>
                        {count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Exclus */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <h3 className="text-sm font-semibold text-red-700">
                  Exclus de l'état des lieux
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Ces statuts d'annulation ne comptent ni dans le CA, ni dans les
                commissions, ni dans le pipeline (visible uniquement dans la ligne
                « Annulées »).
              </p>
              <ul className="space-y-1.5">
                {CANCELLATION_STATUSES.map((status) => {
                  const count = counts[status] || 0;
                  return (
                    <li
                      key={status}
                      className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-accent/30"
                    >
                      <span className="truncate text-muted-foreground">
                        {VENTE_STATUS_LABELS[status]}
                      </span>
                      <span className={`font-medium tabular-nums ${count > 0 ? "text-red-600" : "text-muted-foreground/50"}`}>
                        {count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Note finale */}
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">Un dossier ne s'affiche pas ?</span>{" "}
                Vérifie qu'il est bien rattaché à cette régie et que son statut figure dans
                la liste « Inclus ». Les dossiers annulés ou en négociation sont volontairement
                masqués des indicateurs principaux.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
