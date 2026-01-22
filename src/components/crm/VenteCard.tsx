import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  User, 
  Calendar, 
  ChevronRight, 
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Euro,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type VenteStatus = 'en_negociation' | 'signe' | 'cq_a_faire' | 'cq_fait' | 'attente_financement' | 'envoi_pose' | 'en_installation' | 'installe' | 'attente_paiement' | 'paye' | 'annule';

interface Vente {
  id: string;
  numero_contrat: string | null;
  date_signature: string | null;
  montant_ht: number;
  montant_ttc: number;
  puissance_kwc: number | null;
  status: VenteStatus;
  client: {
    id: string;
    nom: string;
    prenom: string | null;
  } | null;
}

interface CommissionData {
  montant_commission: number;
  bonus_survente: number;
}

interface VenteCardProps {
  vente: Vente;
  commission?: CommissionData | null;
  selectionMode: boolean;
  isSelected: boolean;
  onClick: () => void;
}

const statusConfig: Record<VenteStatus, { label: string; color: string; icon: React.ReactNode }> = {
  en_negociation: { label: "En négociation", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: <Clock className="h-3 w-3" /> },
  signe: { label: "Signé", color: "bg-blue-500/10 text-blue-600 border-blue-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  cq_a_faire: { label: "CQ à faire", color: "bg-orange-500/10 text-orange-600 border-orange-200", icon: <Clock className="h-3 w-3" /> },
  cq_fait: { label: "CQ fait", color: "bg-cyan-500/10 text-cyan-600 border-cyan-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  attente_financement: { label: "Att. financement", color: "bg-yellow-500/10 text-yellow-600 border-yellow-200", icon: <Clock className="h-3 w-3" /> },
  envoi_pose: { label: "Envoi en pose", color: "bg-indigo-500/10 text-indigo-600 border-indigo-200", icon: <TrendingUp className="h-3 w-3" /> },
  en_installation: { label: "En installation", color: "bg-purple-500/10 text-purple-600 border-purple-200", icon: <TrendingUp className="h-3 w-3" /> },
  installe: { label: "Posé", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  attente_paiement: { label: "Att. paiement", color: "bg-pink-500/10 text-pink-600 border-pink-200", icon: <Clock className="h-3 w-3" /> },
  paye: { label: "Payé", color: "bg-green-500/10 text-green-600 border-green-200", icon: <Euro className="h-3 w-3" /> },
  annule: { label: "Annulé", color: "bg-red-500/10 text-red-600 border-red-200", icon: <XCircle className="h-3 w-3" /> }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(amount);
};

export const VenteCard = ({ vente, commission, selectionMode, isSelected, onClick }: VenteCardProps) => {
  const config = statusConfig[vente.status];
  const totalCommission = commission ? commission.montant_commission + commission.bonus_survente : 0;

  return (
    <Card 
      className={`cursor-pointer hover:bg-muted/50 transition-colors relative ${isSelected ? "border-primary bg-primary/5" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {selectionMode && (
              <Checkbox checked={isSelected} className="mr-1" />
            )}
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {vente.client?.nom} {vente.client?.prenom || ""}
            </span>
          </div>
          <Badge className={`${config.color} flex items-center gap-1`}>
            {config.icon}
            {config.label}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-lg font-bold text-primary">
              {formatCurrency(vente.montant_ttc)}
            </p>
            <div className="flex items-center gap-2">
              {vente.puissance_kwc && (
                <span className="text-xs text-muted-foreground">
                  {vente.puissance_kwc} kWc
                </span>
              )}
              {totalCommission > 0 && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-200">
                  Com: {formatCurrency(totalCommission)}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right space-y-1">
            {vente.date_signature && (
              <p className="text-xs flex items-center gap-1 text-muted-foreground justify-end">
                <Calendar className="h-3 w-3" />
                {format(new Date(vente.date_signature), "d MMM yyyy", { locale: fr })}
              </p>
            )}
            {vente.numero_contrat && (
              <p className="text-xs text-muted-foreground">
                {vente.numero_contrat}
              </p>
            )}
          </div>
        </div>

        {!selectionMode && (
          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        )}
      </CardContent>
    </Card>
  );
};
