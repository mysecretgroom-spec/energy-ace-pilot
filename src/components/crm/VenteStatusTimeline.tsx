import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface StatusEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  en_negociation: "En négociation",
  signe: "Signé",
  cq_a_faire: "CQ à faire",
  cq_fait: "CQ fait",
  attente_financement: "Att. financement",
  envoi_pose: "Envoi pose",
  en_installation: "En installation",
  installe: "Posé",
  attente_paiement: "Att. paiement",
  paye: "Payé",
  annule: "Annulé",
  refus_financement: "Refus financement",
  inFinancable: "Infinançable",
  retracte: "Rétracté",
  refus_mairie_abf: "Refus Mairie / ABF",
};

interface VenteStatusTimelineProps {
  venteId: string;
}

export function VenteStatusTimeline({ venteId }: VenteStatusTimelineProps) {
  const [history, setHistory] = useState<StatusEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("vente_status_history")
        .select("id, old_status, new_status, changed_at")
        .eq("vente_id", venteId)
        .order("changed_at", { ascending: false });
      setHistory(data || []);
      setLoading(false);
    };
    load();

    // Realtime updates
    const channel = supabase
      .channel(`vente-history-${venteId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "vente_status_history",
        filter: `vente_id=eq.${venteId}`,
      }, (payload) => {
        setHistory(prev => [payload.new as StatusEntry, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [venteId]);

  if (loading || history.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Historique des statuts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
          
          {history.map((entry, i) => (
            <div key={entry.id} className="relative flex items-start gap-3 py-2">
              {/* Dot */}
              <div className={`relative z-10 mt-1.5 h-[9px] w-[9px] rounded-full shrink-0 ${
                i === 0 ? "bg-primary ring-2 ring-primary/20" : "bg-muted-foreground/40"
              }`} />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap text-sm">
                  {entry.old_status && (
                    <>
                      <span className="text-muted-foreground">
                        {STATUS_LABELS[entry.old_status] || entry.old_status}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    </>
                  )}
                  <span className="font-medium">
                    {STATUS_LABELS[entry.new_status] || entry.new_status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(entry.changed_at), "d MMM yyyy à HH:mm", { locale: fr })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
