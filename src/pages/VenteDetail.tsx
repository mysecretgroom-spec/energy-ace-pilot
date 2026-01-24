import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  User, 
  Calendar, 
  Euro, 
  Zap, 
  FileText, 
  Save, 
  Loader2,
  ExternalLink
} from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type VenteStatus = Database["public"]["Enums"]["vente_status"];

interface Vente {
  id: string;
  client_id: string | null;
  etude_id: string | null;
  numero_contrat: string | null;
  date_signature: string | null;
  date_installation_prevue: string | null;
  date_installation_reelle: string | null;
  date_paiement: string | null;
  montant_ht: number | null;
  montant_ttc: number | null;
  montant_acompte: number | null;
  montant_solde: number | null;
  puissance_kwc: number | null;
  nombre_panneaux: number | null;
  type_installation: string | null;
  status: VenteStatus | null;
  notes: string | null;
  created_at: string;
}

interface Client {
  id: string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  email: string | null;
}

const statusLabels: Record<VenteStatus, string> = {
  en_negociation: "En négociation",
  signe: "Signé",
  cq_a_faire: "CQ à faire",
  cq_fait: "CQ fait",
  attente_financement: "Attente financement",
  envoi_pose: "Envoi en pose",
  en_installation: "En installation",
  installe: "Posé",
  attente_paiement: "Attente paiement",
  paye: "Payé",
  annule: "Annulé",
};

const statusColors: Record<VenteStatus, string> = {
  en_negociation: "bg-amber-500/10 text-amber-600 border-amber-200",
  signe: "bg-blue-500/10 text-blue-600 border-blue-200",
  cq_a_faire: "bg-orange-500/10 text-orange-600 border-orange-200",
  cq_fait: "bg-cyan-500/10 text-cyan-600 border-cyan-200",
  attente_financement: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  envoi_pose: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  en_installation: "bg-purple-500/10 text-purple-600 border-purple-200",
  installe: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  attente_paiement: "bg-pink-500/10 text-pink-600 border-pink-200",
  paye: "bg-green-500/10 text-green-600 border-green-200",
  annule: "bg-red-500/10 text-red-600 border-red-200",
};

const VenteDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vente, setVente] = useState<Vente | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [previousStatus, setPreviousStatus] = useState<VenteStatus>("en_negociation");
  
  // Editable fields
  const [numeroContrat, setNumeroContrat] = useState("");
  const [status, setStatus] = useState<VenteStatus>("en_negociation");
  const [dateSignature, setDateSignature] = useState("");
  const [dateInstallationReelle, setDateInstallationReelle] = useState("");
  const [montantHt, setMontantHt] = useState<number | "">("");
  const [montantTtc, setMontantTtc] = useState<number | "">("");
  const [montantAcompte, setMontantAcompte] = useState<number | "">("");
  const [montantSolde, setMontantSolde] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (id) {
      loadVente();
    }
  }, [id]);

  // Auto-set installation date when status changes to "installe"
  const handleStatusChange = (newStatus: VenteStatus) => {
    setStatus(newStatus);
    
    // If changing to "installe" and no installation date set, set it to today
    if (newStatus === "installe" && previousStatus !== "installe" && !dateInstallationReelle) {
      const today = new Date().toISOString().split("T")[0];
      setDateInstallationReelle(today);
    }
  };

  const loadVente = async () => {
    if (!id) return;
    
    setLoading(true);
    
    const { data: venteData, error } = await supabase
      .from("ventes")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !venteData) {
      toast.error("Vente non trouvée");
      navigate("/crm");
      return;
    }

    setVente(venteData);
    setNumeroContrat(venteData.numero_contrat || "");
    setStatus(venteData.status || "en_negociation");
    setPreviousStatus(venteData.status || "en_negociation");
    setDateInstallationReelle(venteData.date_installation_reelle || "");
    setMontantHt(venteData.montant_ht || "");
    setMontantTtc(venteData.montant_ttc || "");
    setMontantAcompte(venteData.montant_acompte || "");
    setMontantSolde(venteData.montant_solde || "");
    setNotes(venteData.notes || "");

    // Load client info
    if (venteData.client_id) {
      const { data: clientData } = await supabase
        .from("clients")
        .select("id, nom, prenom, telephone, email")
        .eq("id", venteData.client_id)
        .maybeSingle();
      
      if (clientData) {
        setClient(clientData);
      }
    }

    // Calculate signature date if not set
    if (!venteData.date_signature) {
      await calculateSignatureDate(venteData);
    } else {
      setDateSignature(venteData.date_signature);
    }

    setLoading(false);
  };

  const calculateSignatureDate = async (venteData: Vente) => {
    // Try to find associated RDV through etude
    if (venteData.etude_id) {
      const { data: etude } = await supabase
        .from("etudes")
        .select("rdv_id")
        .eq("id", venteData.etude_id)
        .maybeSingle();

      if (etude?.rdv_id) {
        const { data: rdv } = await supabase
          .from("rdv")
          .select("date_heure, historique")
          .eq("id", etude.rdv_id)
          .maybeSingle();

        if (rdv) {
          // Check historique for R2 or R2 pré-étude
          const historique = rdv.historique as Array<{ status: string; date: string }> | null;
          
          if (historique && Array.isArray(historique)) {
            // Find R2 or R2 pré-étude in history
            const r2Entry = historique.find(
              (h) => h.status === "r2" || h.status === "r2_prestudy"
            );
            
            if (r2Entry?.date) {
              const signDate = r2Entry.date.split("T")[0];
              setDateSignature(signDate);
              return;
            }
          }
          
          // No R2 found, use original RDV date
          if (rdv.date_heure) {
            const signDate = rdv.date_heure.split("T")[0];
            setDateSignature(signDate);
            return;
          }
        }
      }
    }
    
    // Fallback: use vente creation date
    if (venteData.created_at) {
      const signDate = venteData.created_at.split("T")[0];
      setDateSignature(signDate);
    }
  };

  const handleSave = async () => {
    if (!id) return;

    setSaving(true);

    const { error } = await supabase
      .from("ventes")
      .update({
        numero_contrat: numeroContrat || null,
        status,
        date_signature: dateSignature || null,
        date_installation_reelle: dateInstallationReelle || null,
        montant_ht: montantHt || null,
        montant_ttc: montantTtc || null,
        montant_acompte: montantAcompte || null,
        montant_solde: montantSolde || null,
        notes: notes || null,
      })
      .eq("id", id);

    setSaving(false);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      console.error(error);
      return;
    }

    toast.success("Vente mise à jour");
    setPreviousStatus(status);
  };

  if (loading) {
    return (
      <MobileLayout title="Détail vente" showBackButton>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  if (!vente) {
    return (
      <MobileLayout title="Détail vente" showBackButton>
        <div className="p-4 text-center text-muted-foreground">
          Vente non trouvée
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Détail vente" showBackButton>
      <div className="p-4 space-y-4 pb-24">
        {/* Header with status */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {client ? `${client.prenom || ""} ${client.nom}`.trim() : "Client inconnu"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Créée le {format(new Date(vente.created_at), "dd MMMM yyyy", { locale: fr })}
            </p>
          </div>
          <Badge className={statusColors[status]}>
            {statusLabels[status]}
          </Badge>
        </div>

        {/* Client info */}
        {client && (
          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => navigate(`/clients/${client.id}`)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{client.prenom} {client.nom}</p>
                  <p className="text-sm text-muted-foreground">{client.telephone}</p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Technical info (read-only) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Installation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Puissance</span>
              <span className="font-medium">{vente.puissance_kwc || "-"} kWc</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Panneaux</span>
              <span className="font-medium">{vente.nombre_panneaux || "-"}</span>
            </div>
            {vente.type_installation && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{vente.type_installation}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Editable status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Statut</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={status} onValueChange={(v) => handleStatusChange(v as VenteStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en_negociation">En négociation</SelectItem>
                <SelectItem value="signe">Signé</SelectItem>
                <SelectItem value="cq_a_faire">CQ à faire</SelectItem>
                <SelectItem value="cq_fait">CQ fait</SelectItem>
                <SelectItem value="attente_financement">Attente financement</SelectItem>
                <SelectItem value="envoi_pose">Envoi en pose</SelectItem>
                <SelectItem value="en_installation">En installation</SelectItem>
                <SelectItem value="installe">Posé</SelectItem>
                <SelectItem value="attente_paiement">Attente paiement</SelectItem>
                <SelectItem value="paye">Payé</SelectItem>
                <SelectItem value="annule">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Contract info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Contrat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="numeroContrat">N° Contrat</Label>
              <Input
                id="numeroContrat"
                value={numeroContrat}
                onChange={(e) => setNumeroContrat(e.target.value)}
                placeholder="Numéro de contrat"
              />
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dateSignature">Signature</Label>
              <Input
                id="dateSignature"
                type="date"
                value={dateSignature}
                onChange={(e) => setDateSignature(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Calculée auto. depuis le RDV (R2 si présent, sinon date initiale)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateInstallationReelle">Date de pose</Label>
              <Input
                id="dateInstallationReelle"
                type="date"
                value={dateInstallationReelle}
                onChange={(e) => setDateInstallationReelle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Remplie auto. au passage en statut "Posé"
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Financial info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Montants
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="montantHt">Montant HT</Label>
                <Input
                  id="montantHt"
                  type="number"
                  value={montantHt}
                  onChange={(e) => setMontantHt(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="montantTtc">Montant TTC</Label>
                <Input
                  id="montantTtc"
                  type="number"
                  value={montantTtc}
                  onChange={(e) => setMontantTtc(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="montantAcompte">Acompte</Label>
                <Input
                  id="montantAcompte"
                  type="number"
                  value={montantAcompte}
                  onChange={(e) => setMontantAcompte(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="montantSolde">Solde</Label>
                <Input
                  id="montantSolde"
                  type="number"
                  value={montantSolde}
                  onChange={(e) => setMontantSolde(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes sur cette vente..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Étude link */}
        {vente.etude_id && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(`/etude/edit?etude=${vente.etude_id}&client=${vente.client_id}`)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Voir l'étude associée
          </Button>
        )}
      </div>

      {/* Fixed save button */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-background border-t">
        <Button 
          className="w-full" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Enregistrer
        </Button>
      </div>
    </MobileLayout>
  );
};

export default VenteDetail;
