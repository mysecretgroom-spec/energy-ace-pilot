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
         className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all select-none touch-none ${
           isPressing 
             ? "bg-primary/20 scale-[0.98]" 
             : isOngoing
               ? "bg-primary/10 border border-primary/30"
               : "bg-muted/50 hover:bg-muted"
         }`}
         {...handlers}
       >
         <div className="flex items-center gap-3">
           {getStatusIcon(rdv.status)}
           <div>
             <p className="font-medium text-sm">
               {rdv.client_nom}
               {isOngoing && <span className="ml-2 text-xs text-primary font-semibold">EN COURS</span>}
             </p>
             <p className="text-xs text-muted-foreground">
               {format(rdvDate, "EEEE d MMM à HH:mm", { locale: fr })}
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
           <Badge variant="outline" className="text-xs">
             {rdv.type_projet}
           </Badge>
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