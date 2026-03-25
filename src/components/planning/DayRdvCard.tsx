import { Clock, MapPin, FileText, Wrench, RefreshCw, Car, Building2, Copy, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge, RdvStatus } from "@/components/ui/status-badge";
import { RdvActions } from "./RdvActions";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { SwipeableRdvCard } from "@/components/common/SwipeableRdvCard";

interface DayRdvCardProps {
  rdv: {
    id: string;
    date: Date;
    time: string;
    duration: string;
    client: string;
    clientId: string;
    phone?: string | null;
    address?: string;
    city?: string;
    postalCode?: string;
    status: RdvStatus;
    type: string;
    typeRdv: 'standard' | 'external_installation';
    isR2?: boolean;
    r2Type?: string | null;
    etudeId?: string | null;
    alert?: boolean;
    distance?: string;
    travelTime?: string;
    latitude?: number;
    longitude?: number;
    regieId?: string | null;
    regieNom?: string | null;
    regieCouleur?: string | null;
    isDuplicateClient?: boolean;
    needsReconfirmation?: boolean;
  };
  index: number;
  onRefresh: () => void;
  onBeforeNavigate?: () => void;
}

export function DayRdvCard({ rdv, index, onRefresh, onBeforeNavigate }: DayRdvCardProps) {
  const navigate = useNavigate();

  const isExternalInstallation = rdv.typeRdv === 'external_installation';
  const isR2 = rdv.isR2;

  const handleNavigate = (path: string) => {
    onBeforeNavigate?.();
    navigate(path);
  };

    return (
    <SwipeableRdvCard
      phone={rdv.phone}
      address={rdv.address}
      postalCode={rdv.postalCode}
      city={rdv.city}
      rdvId={rdv.id}
      clientId={rdv.clientId}
    >
    <div 
      className="relative animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Ligne de trajet entre les RDV */}
      {index > 0 && rdv.travelTime && rdv.distance && (
        <div 
          className={cn(
            "flex items-center justify-center gap-4 py-2.5 mb-3 rounded-xl border border-dashed transition-all duration-300",
            rdv.alert 
              ? "border-secondary bg-secondary/10 shadow-sm" 
              : "border-muted-foreground/20 bg-muted/20"
          )}
        >
          <Car className={cn(
            "h-4 w-4 transition-colors",
            rdv.alert ? "text-secondary" : "text-muted-foreground"
          )} />
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-semibold",
              rdv.alert ? "text-secondary" : "text-foreground"
            )}>
              {rdv.travelTime}
            </span>
            <span className="text-muted-foreground/50">•</span>
            <span className={cn(
              "text-sm font-medium",
              rdv.alert ? "text-secondary" : "text-muted-foreground"
            )}>
              {rdv.distance}
            </span>
          </div>
          {rdv.alert && (
            <span className="text-secondary text-sm animate-pulse">⚠️</span>
          )}
        </div>
      )}

      <Card
        className={cn(
          "shadow-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5",
          rdv.needsReconfirmation && "ring-2 ring-amber-400 border-amber-400",
          isExternalInstallation && "border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-500/5 to-transparent shadow-[0_0_15px_-3px_rgba(245,158,11,0.4)]",
          isR2 && "border-l-4 border-l-status-r2 bg-gradient-to-r from-status-r2/5 to-transparent shadow-[0_0_15px_-3px_rgba(245,158,11,0.4)]",
          rdv.alert && !isExternalInstallation && !isR2 && "border-l-4 border-l-secondary bg-gradient-to-r from-secondary/5 to-transparent"
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            {/* Contenu principal */}
            <div className="flex-1 space-y-3">
              {/* Badges spéciaux */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Badge à confirmer */}
                {rdv.needsReconfirmation && (
                  <Badge className="bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs px-2.5 py-1 flex items-center gap-1.5 rounded-full shadow-sm animate-pulse">
                    <ShieldAlert className="h-3 w-3" />
                    À confirmer
                  </Badge>
                )}
                
                {rdv.regieNom && (
                  <Badge 
                    className="text-xs px-2 py-0.5 flex items-center gap-1 rounded-full"
                    style={{ 
                      backgroundColor: rdv.regieCouleur ? `${rdv.regieCouleur}20` : undefined,
                      color: rdv.regieCouleur || undefined,
                      borderColor: rdv.regieCouleur ? `${rdv.regieCouleur}50` : undefined,
                      borderWidth: '1px',
                    }}
                  >
                    <Building2 className="h-3 w-3" />
                    {rdv.regieNom}
                  </Badge>
                )}
                
                {isExternalInstallation && (
                  <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-2.5 py-1 flex items-center gap-1.5 rounded-full shadow-sm">
                    <Wrench className="h-3 w-3" />
                    Installation Externe
                  </Badge>
                )}

                {rdv.isDuplicateClient && (
                  <Badge variant="outline" className="text-xs px-2 py-0.5 flex items-center gap-1 rounded-full border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400">
                    <Copy className="h-3 w-3" />
                    Doublon client
                  </Badge>
                )}
                
                {isR2 && (
                  <>
                    <Badge className="bg-status-r2 hover:bg-status-r2/90 text-white text-xs px-2.5 py-1 flex items-center gap-1.5 rounded-full shadow-sm">
                      <RefreshCw className="h-3 w-3" />
                      {rdv.r2Type === "r2_prestudy" ? "R2 Pré-étude" : "R2"}
                    </Badge>
                    {rdv.etudeId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs hover:bg-status-r2/10 text-status-r2"
                        onClick={() => handleNavigate(`/etude/edit?etude=${rdv.etudeId}&client=${rdv.clientId}`)}
                      >
                        <FileText className="h-3 w-3 mr-1.5" />
                        Voir étude
                      </Button>
                    )}
                  </>
                )}
              </div>
              
              {/* Heure, durée et statut */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                  isR2 
                    ? "bg-status-r2/10 text-status-r2" 
                    : "bg-primary/10 text-primary"
                )}>
                  <Clock className="h-4 w-4" />
                  <span className="font-bold text-base">{rdv.time}</span>
                </div>
                <span className="text-sm text-muted-foreground font-medium">
                  {rdv.duration}
                </span>
                <StatusBadge status={rdv.status} />
              </div>

              {/* Client et type */}
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-foreground leading-tight">
                  {rdv.client}
                </h3>
                <p className="text-sm text-muted-foreground font-medium">
                  {rdv.type}
                </p>
              </div>

              {/* Adresse complète */}
              <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-2.5">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-primary/70" />
                <span className="leading-relaxed">
                  {[rdv.address, rdv.postalCode, rdv.city]
                    .filter(Boolean)
                    .join(", ") || "Adresse non renseignée"}
                </span>
              </div>

              {/* Alerte trajet */}
              {rdv.alert && (
                <div className="flex items-center gap-2 text-sm text-secondary font-medium bg-secondary/10 rounded-lg px-3 py-2">
                  <span className="animate-pulse">⚠️</span>
                  <span>Trajet long - Prévoir du temps</span>
                </div>
              )}
            </div>

            <div className="flex-shrink-0">
              <RdvActions
                rdvId={rdv.id}
                clientId={rdv.clientId}
                clientPhone={rdv.phone || undefined}
                clientName={rdv.client}
                address={rdv.address}
                city={rdv.city}
                postalCode={rdv.postalCode}
                latitude={rdv.latitude}
                longitude={rdv.longitude}
                typeRdv={rdv.typeRdv}
                currentStatus={rdv.status}
                etudeId={rdv.etudeId}
                regieId={rdv.regieId}
                regieNom={rdv.regieNom}
                regieCouleur={rdv.regieCouleur}
                rdvDate={rdv.date.toISOString().split("T")[0]}
                onRefresh={onRefresh}
                onBeforeNavigate={onBeforeNavigate}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </SwipeableRdvCard>
  );
}
