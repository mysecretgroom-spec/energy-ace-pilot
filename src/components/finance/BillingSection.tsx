import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { 
  FileText, 
  Euro, 
  ChevronRight, 
  Loader2,
  Copy,
  CheckCircle
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface BillableVente {
  id: string;
  client_nom: string;
  client_prenom: string | null;
  puissance_kwc: number | null;
  montant_ht: number;
  montant_ttc: number;
  date_installation: string | null;
  commission: number;
}

interface BillingSectionProps {
  onRefresh?: () => void;
}

export function BillingSection({ onRefresh }: BillingSectionProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ventes, setVentes] = useState<BillableVente[]>([]);
  const [totalBillable, setTotalBillable] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBillableVentes();
    }
  }, [user]);

  const fetchBillableVentes = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch ventes with status "attente_paiement"
      const { data: ventesData, error: ventesError } = await supabase
        .from("ventes")
        .select(`
          id,
          montant_ht,
          montant_ttc,
          puissance_kwc,
          date_installation,
          decom_montant,
          clients (
            nom,
            prenom
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "attente_paiement")
        .order("date_installation", { ascending: true });

      if (ventesError) throw ventesError;

      // If no ventes in attente_paiement, just set empty and return
      if (!ventesData || ventesData.length === 0) {
        setVentes([]);
        setTotalBillable(0);
        setLoading(false);
        return;
      }

      // Fetch commission config
      const [tiersRes, bouquetsRes, configRes] = await Promise.all([
        supabase.from("data_commissions").select("*").order("tranche_min"),
        supabase.from("data_prix_bouquets").select("puissance_kwc, prix_hejja, prix_recommande").eq("actif", true),
        supabase.from("config_commissions").select("part_survente_pct").maybeSingle(),
      ]);

      const tiers = tiersRes.data || [];
      const bouquets = bouquetsRes.data || [];
      const partSurventePct = configRes.data?.part_survente_pct || 50;

      // Calculate commissions
      const billableVentes: BillableVente[] = (ventesData || []).map((v: any) => {
        const bouquet = bouquets.find(b => b.puissance_kwc === v.puissance_kwc);
        const prixRecommande = bouquet?.prix_recommande || 0;
        
        const tier = tiers.find(
          t => v.montant_ht >= t.tranche_min && v.montant_ht <= t.tranche_max
        ) || tiers[tiers.length - 1];
        
        const tauxCommission = tier?.taux_commission || 0;
        const baseCommission = v.montant_ht * (tauxCommission / 100);
        
        let bonusSurvente = 0;
        if (prixRecommande > 0 && v.montant_ht > prixRecommande) {
          const surventeBase = v.montant_ht - prixRecommande;
          bonusSurvente = surventeBase * (partSurventePct / 100);
        }
        
        const decomMontant = v.decom_montant || 0;
        const commission = Math.max(0, baseCommission + bonusSurvente - decomMontant);

        return {
          id: v.id,
          client_nom: v.clients?.nom || "Client inconnu",
          client_prenom: v.clients?.prenom || null,
          puissance_kwc: v.puissance_kwc,
          montant_ht: v.montant_ht,
          montant_ttc: v.montant_ttc,
          date_installation: v.date_installation,
          commission,
        };
      });

      setVentes(billableVentes);
      setTotalBillable(billableVentes.reduce((sum, v) => sum + v.commission, 0));
    } catch (error) {
      console.error("Error fetching billable ventes:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleCopyAll = () => {
    if (ventes.length === 0) return;

    const lines = ventes.map(v => {
      const clientName = v.client_prenom 
        ? `${v.client_prenom} ${v.client_nom}`
        : v.client_nom;
      return `${clientName} | ${v.puissance_kwc || "-"} kWc | ${formatCurrency(v.commission)} €`;
    });

    const total = `\nTOTAL À FACTURER: ${formatCurrency(totalBillable)} €`;
    
    navigator.clipboard.writeText(lines.join("\n") + total);
    setCopied(true);
    toast.success("Lignes copiées dans le presse-papier");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600" />
            <span className="text-amber-800">Facturation</span>
          </div>
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            {ventes.length} dossier{ventes.length > 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Total à facturer */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white">
          <p className="text-sm opacity-90">Total à facturer</p>
          <p className="text-3xl font-bold">{formatCurrency(totalBillable)} €</p>
          <p className="text-xs opacity-75 mt-1">Commissions HT nettes</p>
        </div>

        {/* Copy button */}
        {ventes.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={handleCopyAll}
          >
            {copied ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Copié !
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copier pour Qonto
              </>
            )}
          </Button>
        )}

        {/* Liste des dossiers */}
        {ventes.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            Aucun dossier en attente de paiement
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {ventes.map((vente) => (
              <div
                key={vente.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white border border-amber-100 cursor-pointer hover:bg-amber-50 transition-colors"
                onClick={() => navigate(`/ventes/${vente.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {vente.client_prenom && `${vente.client_prenom} `}{vente.client_nom}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{vente.puissance_kwc || "-"} kWc</span>
                    {vente.date_installation && (
                      <>
                        <span>•</span>
                        <span>
                          Posé le {format(new Date(vente.date_installation), "dd MMM", { locale: fr })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="font-bold text-amber-700">{formatCurrency(vente.commission)} €</p>
                    <p className="text-xs text-muted-foreground">Commission</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
