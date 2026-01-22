import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Euro,
  User,
  Clock,
  CheckCircle2,
  TrendingUp,
  XCircle,
  GripVertical,
} from "lucide-react";

type VenteStatus = 'en_negociation' | 'signe' | 'en_installation' | 'installe' | 'paye' | 'annule';

interface Vente {
  id: string;
  numero_contrat: string | null;
  date_signature: string | null;
  montant_ht: number;
  montant_ttc: number;
  puissance_kwc: number | null;
  status: VenteStatus;
  notes: string | null;
  created_at: string;
  client: {
    id: string;
    nom: string;
    prenom: string | null;
  } | null;
}

interface PipelineKanbanProps {
  ventes: Vente[];
  onRefresh: () => void;
}

const pipelineColumns: { status: VenteStatus; label: string; color: string; bgColor: string; icon: React.ReactNode }[] = [
  { 
    status: 'en_negociation', 
    label: 'Négociation', 
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10 border-blue-200',
    icon: <Clock className="h-4 w-4" />
  },
  { 
    status: 'signe', 
    label: 'Signé', 
    color: 'text-green-600',
    bgColor: 'bg-green-500/10 border-green-200',
    icon: <CheckCircle2 className="h-4 w-4" />
  },
  { 
    status: 'en_installation', 
    label: 'Installation', 
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10 border-amber-200',
    icon: <TrendingUp className="h-4 w-4" />
  },
  { 
    status: 'installe', 
    label: 'Installé', 
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10 border-purple-200',
    icon: <CheckCircle2 className="h-4 w-4" />
  },
  { 
    status: 'paye', 
    label: 'Payé', 
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10 border-emerald-200',
    icon: <Euro className="h-4 w-4" />
  },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(amount);
};

export function PipelineKanban({ ventes, onRefresh }: PipelineKanbanProps) {
  const navigate = useNavigate();

  const handleDragStart = (e: React.DragEvent, venteId: string) => {
    e.dataTransfer.setData("venteId", venteId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: VenteStatus) => {
    e.preventDefault();
    const venteId = e.dataTransfer.getData("venteId");
    
    if (!venteId) return;

    try {
      const { error } = await supabase
        .from("ventes")
        .update({ status: newStatus })
        .eq("id", venteId);

      if (error) throw error;
      
      toast.success("Statut mis à jour");
      onRefresh();
    } catch (error) {
      console.error("Erreur mise à jour:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const getVentesByStatus = (status: VenteStatus) => {
    return ventes.filter(v => v.status === status);
  };

  const getColumnTotal = (status: VenteStatus) => {
    return getVentesByStatus(status).reduce((sum, v) => sum + v.montant_ttc, 0);
  };

  // Filter out cancelled sales for the pipeline
  const activeVentes = ventes.filter(v => v.status !== 'annule');
  const cancelledVentes = ventes.filter(v => v.status === 'annule');

  return (
    <div className="space-y-4">
      {/* Pipeline Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Pipeline actif</p>
            <p className="text-lg font-bold">{activeVentes.length} ventes</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Valeur totale</p>
            <p className="text-lg font-bold">{formatCurrency(activeVentes.reduce((sum, v) => sum + v.montant_ttc, 0))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4" style={{ minWidth: "max-content" }}>
          {pipelineColumns.map((column) => {
            const columnVentes = getVentesByStatus(column.status);
            const columnTotal = getColumnTotal(column.status);
            
            return (
              <div
                key={column.status}
                className="w-64 flex-shrink-0"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.status)}
              >
                <Card className={`${column.bgColor} border`}>
                  <CardHeader className="p-3 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={column.color}>{column.icon}</span>
                        <CardTitle className={`text-sm font-medium ${column.color}`}>
                          {column.label}
                        </CardTitle>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {columnVentes.length}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(columnTotal)}
                    </p>
                  </CardHeader>
                  <CardContent className="p-2 pt-0 space-y-2 min-h-[200px]">
                    {columnVentes.length === 0 ? (
                      <div className="h-24 flex items-center justify-center border-2 border-dashed border-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Glissez ici</p>
                      </div>
                    ) : (
                      columnVentes.map((vente) => (
                        <Card
                          key={vente.id}
                          className="bg-background cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                          draggable
                          onDragStart={(e) => handleDragStart(e, vente.id)}
                          onClick={() => navigate(`/ventes/${vente.id}`)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 mb-1">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <p className="text-sm font-medium truncate">
                                    {vente.client?.nom} {vente.client?.prenom || ""}
                                  </p>
                                </div>
                                <p className="text-sm font-bold text-primary">
                                  {formatCurrency(vente.montant_ttc)}
                                </p>
                                {vente.puissance_kwc && (
                                  <p className="text-xs text-muted-foreground">
                                    {vente.puissance_kwc} kWc
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Cancelled sales */}
      {cancelledVentes.length > 0 && (
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Ventes annulées ({cancelledVentes.length})
            </h3>
          </div>
          <div className="grid gap-2">
            {cancelledVentes.slice(0, 3).map((vente) => (
              <Card 
                key={vente.id} 
                className="bg-red-500/5 border-red-200 opacity-60 cursor-pointer hover:opacity-80"
                onClick={() => navigate(`/ventes/${vente.id}`)}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <span className="text-sm">
                    {vente.client?.nom} {vente.client?.prenom || ""}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(vente.montant_ttc)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
