import { useState } from "react";
import { SwipeableVenteCard } from "./SwipeableVenteCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import {
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Building2,
} from "lucide-react";

type VenteStatus = 'en_negociation' | 'signe' | 'cq_a_faire' | 'cq_fait' | 'attente_financement' | 'envoi_pose' | 'en_installation' | 'installe' | 'attente_paiement' | 'paye' | 'annule' | 'refus_financement';

interface Regie {
  id: string;
  nom: string;
  couleur: string;
  is_hejja: boolean;
}

interface Vente {
  id: string;
  numero_contrat: string | null;
  date_signature: string | null;
  montant_ht: number;
  montant_ttc: number;
  puissance_kwc: number | null;
  status: VenteStatus;
  type_vente: 'standard' | 'external_installation';
  notes: string | null;
  created_at: string;
  decom_montant?: number | null;
  decom_raison?: string | null;
  regie_id?: string | null;
  etude_id?: string | null;
  is_retape?: boolean;
  client: {
    id: string;
    nom: string;
    prenom: string | null;
  } | null;
}

// Status display order (active ventes)
const STATUS_ORDER: VenteStatus[] = [
  'signe',
  'cq_a_faire',
  'cq_fait',
  'attente_financement',
  'envoi_pose',
  'en_installation',
  'installe',
  'attente_paiement',
];

const STATUS_LABELS: Record<VenteStatus, string> = {
  en_negociation: 'En négociation',
  signe: 'Signé',
  cq_a_faire: 'CQ à faire',
  cq_fait: 'CQ fait',
  attente_financement: 'Attente financement',
  envoi_pose: 'Envoi pose',
  en_installation: 'En installation',
  installe: 'Installé',
  attente_paiement: 'Attente paiement',
  paye: 'Payé',
  annule: 'Annulé',
  refus_financement: 'Refus financement',
};

interface VentesGroupedListProps {
  ventes: Vente[];
  regies: Regie[];
  selectedVenteIds: string[];
  selectionMode: boolean;
  onCardClick: (vente: Vente) => void;
  getCommission: (venteId: string) => any;
  onRefresh: () => void;
  isLoading: boolean;
}

export function VentesGroupedList({
  ventes,
  regies,
  selectedVenteIds,
  selectionMode,
  onCardClick,
  getCommission,
  onRefresh,
  isLoading,
}: VentesGroupedListProps) {
  const [payeOpen, setPayeOpen] = useState(false);
  const [annuleOpen, setAnnuleOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (ventes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Aucune vente</p>
        </CardContent>
      </Card>
    );
  }

  // Split ventes into 3 buckets
  const activeVentes = ventes.filter(v => v.status !== 'paye' && v.status !== 'annule' && v.status !== 'refus_financement');
  const payeVentes = ventes.filter(v => v.status === 'paye');
  const annuleVentes = ventes.filter(v => v.status === 'annule' || v.status === 'refus_financement');

  // Group active ventes by regie
  const regieGroups = new Map<string | null, Vente[]>();
  activeVentes.forEach(v => {
    const key = v.regie_id || null;
    if (!regieGroups.has(key)) regieGroups.set(key, []);
    regieGroups.get(key)!.push(v);
  });

  // Sort groups: known regies first (alphabetically), then "Sans régie"
  // Sort groups by most recent sale date (newest first)
  const getLatestDate = (ventes: Vente[]) => {
    return ventes.reduce((latest, v) => {
      const d = v.date_signature || v.created_at;
      return d > latest ? d : latest;
    }, "");
  };

  const sortedRegieKeys = Array.from(regieGroups.keys()).sort((a, b) => {
    const latestA = getLatestDate(regieGroups.get(a) || []);
    const latestB = getLatestDate(regieGroups.get(b) || []);
    return latestB.localeCompare(latestA);
  });

  // Sort ventes within each group by status order
  const sortByStatus = (list: Vente[]) => {
    return [...list].sort((a, b) => {
      const ia = STATUS_ORDER.indexOf(a.status);
      const ib = STATUS_ORDER.indexOf(b.status);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  };

  const renderCard = (vente: Vente) => (
    <SwipeableVenteCard
      key={vente.id}
      vente={vente}
      commission={getCommission(vente.id)}
      regies={regies}
      selectionMode={selectionMode}
      isSelected={selectedVenteIds.includes(vente.id)}
      onClick={() => onCardClick(vente)}
      onRefresh={onRefresh}
    />
  );

  const multipleRegies = sortedRegieKeys.length > 1 || (sortedRegieKeys.length === 1 && sortedRegieKeys[0] !== null);

  return (
    <div className="space-y-4">
      {/* Active ventes grouped by régie */}
      {sortedRegieKeys.map(regieId => {
        const regie = regieId ? regies.find(r => r.id === regieId) : null;
        const groupVentes = sortByStatus(regieGroups.get(regieId) || []);
        if (!regie) return null;

        return (
          <div key={regie.id} className="space-y-2">
            {multipleRegies && (
              <div className="flex items-center gap-2 pt-2">
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: regie.couleur }}
                />
                <span className="text-sm font-semibold text-foreground">
                  {regie.nom}
                </span>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {groupVentes.length}
                </Badge>
              </div>
            )}

            {/* Vente cards */}
            <div className="space-y-2">
              {groupVentes.map(renderCard)}
            </div>
          </div>
        );
      })}

      {payeVentes.length > 0 && (
        <Collapsible open={payeOpen} onOpenChange={setPayeOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center gap-3 pt-4 pb-1 cursor-pointer group">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 group-hover:text-foreground transition-colors">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Payées ({payeVentes.length})
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${payeOpen ? 'rotate-180' : ''}`} />
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 pt-2">
              {payeVentes.map(renderCard)}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Annulées collapsible */}
      {annuleVentes.length > 0 && (
        <Collapsible open={annuleOpen} onOpenChange={setAnnuleOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center gap-3 pt-4 pb-1 cursor-pointer group">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 group-hover:text-foreground transition-colors">
                <XCircle className="h-3.5 w-3.5 text-destructive/60" />
                Annulées ({annuleVentes.length})
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${annuleOpen ? 'rotate-180' : ''}`} />
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 pt-2 opacity-75">
              {annuleVentes.map(renderCard)}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
