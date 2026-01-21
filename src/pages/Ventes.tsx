import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Plus,
  Euro,
  Calendar,
  User,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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

interface Client {
  id: string;
  nom: string;
  prenom: string | null;
}

interface Etude {
  id: string;
  puissance_kwc: number | null;
  prix_total: number | null;
  client_id: string;
}

const statusConfig: Record<VenteStatus, { label: string; color: string; icon: React.ReactNode }> = {
  en_negociation: { label: "En négociation", color: "bg-blue-500/10 text-blue-600 border-blue-200", icon: <Clock className="h-3 w-3" /> },
  signe: { label: "Signé", color: "bg-green-500/10 text-green-600 border-green-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  en_installation: { label: "En installation", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: <TrendingUp className="h-3 w-3" /> },
  installe: { label: "Installé", color: "bg-purple-500/10 text-purple-600 border-purple-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  paye: { label: "Payé", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: <Euro className="h-3 w-3" /> },
  annule: { label: "Annulé", color: "bg-red-500/10 text-red-600 border-red-200", icon: <XCircle className="h-3 w-3" /> }
};

const Ventes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [etudes, setEtudes] = useState<Etude[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    client_id: "",
    etude_id: "",
    montant_ht: "",
    montant_ttc: "",
    puissance_kwc: "",
    numero_contrat: "",
    date_signature: "",
    notes: ""
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [ventesRes, clientsRes, etudesRes] = await Promise.all([
        supabase
          .from("ventes")
          .select("*, client:clients(id, nom, prenom)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("clients")
          .select("id, nom, prenom")
          .eq("user_id", user.id)
          .order("nom"),
        supabase
          .from("etudes")
          .select("id, puissance_kwc, prix_total, client_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
      ]);

      setVentes((ventesRes.data || []) as Vente[]);
      setClients(clientsRes.data || []);
      setEtudes(etudesRes.data || []);
    } catch (error) {
      console.error("Erreur chargement ventes:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleClientChange = (clientId: string) => {
    setFormData(prev => ({ ...prev, client_id: clientId, etude_id: "" }));
  };

  const handleEtudeChange = (etudeId: string) => {
    const etude = etudes.find(e => e.id === etudeId);
    if (etude) {
      const montantTTC = etude.prix_total || 0;
      const montantHT = montantTTC / 1.2; // TVA 20%
      setFormData(prev => ({
        ...prev,
        etude_id: etudeId,
        montant_ttc: montantTTC.toString(),
        montant_ht: montantHT.toFixed(2),
        puissance_kwc: etude.puissance_kwc?.toString() || ""
      }));
    }
  };

  const handleSubmit = async () => {
    if (!user || !formData.client_id || !formData.montant_ht || !formData.montant_ttc) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("ventes").insert({
        user_id: user.id,
        client_id: formData.client_id,
        etude_id: formData.etude_id || null,
        montant_ht: parseFloat(formData.montant_ht),
        montant_ttc: parseFloat(formData.montant_ttc),
        puissance_kwc: formData.puissance_kwc ? parseFloat(formData.puissance_kwc) : null,
        numero_contrat: formData.numero_contrat || null,
        date_signature: formData.date_signature || null,
        notes: formData.notes || null,
        status: formData.date_signature ? 'signe' : 'en_negociation'
      });

      if (error) throw error;

      toast.success("Vente créée avec succès");
      setDialogOpen(false);
      setFormData({
        client_id: "",
        etude_id: "",
        montant_ht: "",
        montant_ttc: "",
        puissance_kwc: "",
        numero_contrat: "",
        date_signature: "",
        notes: ""
      });
      fetchData();
    } catch (error) {
      console.error("Erreur création vente:", error);
      toast.error("Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (venteId: string, newStatus: VenteStatus) => {
    try {
      const { error } = await supabase
        .from("ventes")
        .update({ status: newStatus })
        .eq("id", venteId);

      if (error) throw error;
      toast.success("Statut mis à jour");
      fetchData();
    } catch (error) {
      console.error("Erreur mise à jour:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  const filteredVentes = activeTab === "all" 
    ? ventes 
    : ventes.filter(v => v.status === activeTab);

  const clientEtudes = etudes.filter(e => e.client_id === formData.client_id);

  // Stats
  const totalCA = ventes.filter(v => v.status !== 'annule').reduce((sum, v) => sum + v.montant_ttc, 0);
  const ventesSigned = ventes.filter(v => ['signe', 'en_installation', 'installe', 'paye'].includes(v.status)).length;

  return (
    <MobileLayout title="Ventes" showBackButton={false}>
      <div className="p-4 space-y-4 pb-24">
        {/* Stats header */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">CA Total</p>
              <p className="text-xl font-bold">{formatCurrency(totalCA)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Ventes signées</p>
              <p className="text-xl font-bold">{ventesSigned}</p>
            </CardContent>
          </Card>
        </div>

        {/* Add button */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle vente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouvelle vente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={formData.client_id} onValueChange={handleClientChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.nom} {client.prenom || ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.client_id && clientEtudes.length > 0 && (
                <div className="space-y-2">
                  <Label>Étude associée</Label>
                  <Select value={formData.etude_id} onValueChange={handleEtudeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une étude (optionnel)" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientEtudes.map(etude => (
                        <SelectItem key={etude.id} value={etude.id}>
                          {etude.puissance_kwc} kWc - {formatCurrency(etude.prix_total || 0)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Montant HT *</Label>
                  <Input
                    type="number"
                    value={formData.montant_ht}
                    onChange={(e) => setFormData(prev => ({ ...prev, montant_ht: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Montant TTC *</Label>
                  <Input
                    type="number"
                    value={formData.montant_ttc}
                    onChange={(e) => setFormData(prev => ({ ...prev, montant_ttc: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Puissance (kWc)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.puissance_kwc}
                    onChange={(e) => setFormData(prev => ({ ...prev, puissance_kwc: e.target.value }))}
                    placeholder="9.0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>N° Contrat</Label>
                  <Input
                    value={formData.numero_contrat}
                    onChange={(e) => setFormData(prev => ({ ...prev, numero_contrat: e.target.value }))}
                    placeholder="CTR-001"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Date signature</Label>
                <Input
                  type="date"
                  value={formData.date_signature}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_signature: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes sur la vente..."
                  rows={3}
                />
              </div>

              <Button 
                className="w-full" 
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Créer la vente
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="all">Tout</TabsTrigger>
            <TabsTrigger value="en_negociation">Négo</TabsTrigger>
            <TabsTrigger value="signe">Signées</TabsTrigger>
            <TabsTrigger value="paye">Payées</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Liste des ventes */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredVentes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucune vente</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredVentes.map((vente) => {
              const config = statusConfig[vente.status];
              return (
                <Card 
                  key={vente.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/ventes/${vente.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
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
                        {vente.puissance_kwc && (
                          <p className="text-xs text-muted-foreground">
                            {vente.puissance_kwc} kWc
                          </p>
                        )}
                      </div>
                      <div className="text-right space-y-1">
                        {vente.date_signature && (
                          <p className="text-xs flex items-center gap-1 text-muted-foreground">
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

                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default Ventes;
