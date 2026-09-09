 import React, { useState } from "react";
 import { format } from "date-fns";
 import { fr } from "date-fns/locale";
 import { Badge } from "@/components/ui/badge";
 import { Clock, CheckCircle2, AlertCircle } from "lucide-react";
 import { useLongPress } from "@/hooks/useLongPress";
 import { RdvContextMenu } from "@/components/planning/RdvContextMenu";
 import { RdvStatus } from "@/components/ui/status-badge";
 
 interface ProchainRdv {
   id: string;
   date_heure: string;
   client_nom: string;
   client_prenom?: string;
   client_id: string;
   type_projet: string;
   status: string;
   type_rdv: "standard" | "external_installation";
   etude_id?: string | null;
   regie_id?: string | null;
   regie_nom?: string | null;
   regie_couleur?: string | null;
   telephone?: string | null;
   adresse?: string | null;
   code_postal?: string | null;
    ville?: string | null;
    needs_reconfirmation?: boolean;
  }
  
 interface DashboardRdvCardProps {
   rdv: ProchainRdv;
   onRefresh?: () => void;
 }
 
 export function DashboardRdvCard({ rdv, onRefresh }: DashboardRdvCardProps) {
   const [contextMenuOpen, setContextMenuOpen] = useState(false);
 
   const { handlers, isPressing } = useLongPress({
     onLongPress: () => setContextMenuOpen(true),
     delay: 500,
   });
 
   const getStatusIcon = (status: string) => {
     switch (status) {
       case 'nouveau': return <Clock className="h-3 w-3 text-blue-500" />;
       case 'confirme': return <CheckCircle2 className="h-3 w-3 text-green-500" />;
       case 'annule': return <AlertCircle className="h-3 w-3 text-red-500" />;
       default: return <Clock className="h-3 w-3 text-muted-foreground" />;
     }
   };
 
   const handleStatusChange = (rdvId: string, newStatus: RdvStatus) => {
     onRefresh?.();
   };
 
   const rdvDate = new Date(rdv.date_heure);
   const now = new Date();
   const isOngoing = rdvDate <= now;
 
   return (
     <>
       <div 
          className={`flex items-center justify-between p-3 rounded-sm border cursor-pointer transition-all select-none ${
            isPressing 
              ? "bg-primary/20 scale-[0.98]" 
              : rdv.needs_reconfirmation
                ? "bg-amber-500/10 border-amber-500/40"
                : isOngoing
                  ? "bg-primary/10 border-primary/30"
                  : "bg-card border-border hover:bg-muted/40"
          }`}
          style={{ touchAction: "manipulation" }}
          {...handlers}
       >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-none w-11 text-center">
              <p className="text-xs font-semibold text-primary tabular-nums leading-tight">
                {format(rdvDate, "HH:mm")}
              </p>
              <p className="text-[9px] text-muted-foreground tabular-nums uppercase">
                {format(rdvDate, "dd/MM")}
              </p>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[13px] uppercase tracking-tight truncate">
                {rdv.client_nom}
                {rdv.needs_reconfirmation && <span className="ml-2 text-[9px] text-amber-600 dark:text-amber-400 font-bold tracking-wider">À CONFIRMER</span>}
                {isOngoing && !rdv.needs_reconfirmation && <span className="ml-2 text-[9px] text-primary font-bold tracking-wider">EN COURS</span>}
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {format(rdvDate, "EEEE d MMMM", { locale: fr })}
              </p>
            </div>
          </div>
         <div className="flex items-center gap-2">
           {rdv.regie_nom && (
             <Badge 
               variant="outline" 
               className="text-[10px] px-1.5"
               style={{ 
                 borderColor: rdv.regie_couleur || undefined,
                 color: rdv.regie_couleur || undefined,
               }}
             >
               {rdv.regie_nom}
             </Badge>
           )}
         </div>
       </div>
 
       <RdvContextMenu
         rdv={{
           id: rdv.id,
           client: rdv.client_nom,
           clientPrenom: rdv.client_prenom,
           clientId: rdv.client_id,
           time: format(rdvDate, "HH:mm"),
           date: rdvDate,
           status: rdv.status as RdvStatus,
           typeRdv: rdv.type_rdv,
           etudeId: rdv.etude_id,
           regieId: rdv.regie_id,
           regieNom: rdv.regie_nom,
           regieCouleur: rdv.regie_couleur,
           phone: rdv.telephone,
           address: rdv.adresse || undefined,
           city: rdv.ville || undefined,
           postalCode: rdv.code_postal || undefined,
         }}
         isOpen={contextMenuOpen}
         onClose={() => setContextMenuOpen(false)}
         onStatusChange={handleStatusChange}
         onRefresh={onRefresh}
       />
     </>
   );
 }