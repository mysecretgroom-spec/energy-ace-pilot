import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search,
  Phone,
  MapPin,
  ChevronRight,
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
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type VenteStatus = 'en_negociation' | 'signe' | 'en_installation' | 'installe' | 'paye' | 'annule';

interface Client {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  created_at: string;
}

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

const CRM = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("clients");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Clients state
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  
  // Ventes state
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [etudes, setEtudes] = useState<Etude[]>([]);
  const [ventesLoading, setVentesLoading] = useState(true);
  const [venteFilter, setVenteFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state for new vente
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
      fetchClients();
      fetchVentes();
    }
  }, [user]);

  const fetchClients = async () => {
    setClientsLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setClients(data);
    }
    setClientsLoading(false);
  };

  const fetchVentes = async () => {
    if (!user) return;
    setVentesLoading(true);

    try {
      const [ventesRes, etudesRes] = await Promise.all([
        supabase
          .from("ventes")
          .select("*, client:clients(id, nom, prenom)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("etudes")
          .select("id, puissance_kwc, prix_total, client_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
      ]);

      setVentes((ventesRes.data || []) as Vente[]);
      setEtudes(etudesRes.data || []);
    } catch (error) {
      console.error("Erreur chargement ventes:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setVentesLoading(false);
    }
  };

  // Client helpers
  const filteredClients = clients.filter(
    (client) =>
      client.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.prenom && client.prenom.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (client.telephone && client.telephone.includes(searchQuery)) ||
      (client.ville && client.ville.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaine(s)`;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  // Vente helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  const filteredVentes = venteFilter === "all" 
    ? ventes 
    : ventes.filter(v => v.status === venteFilter);

  const clientEtudes = etudes.filter(e => e.client_id === formData.client_id);
  const totalCA = ventes.filter(v => v.status !== 'annule').reduce((sum, v) => sum + v.montant_ttc, 0);
  const ventesSigned = ventes.filter(v => ['signe', 'en_installation', 'installe', 'paye'].includes(v.status)).length;

  const handleClientChange = (clientId: string) => {
    setFormData(prev => ({ ...prev, client_id: clientId, etude_id: "" }));
  };

  const handleEtudeChange = (etudeId: string) => {
    const etude = etudes.find(e => e.id === etudeId);
    if (etude) {
      const montantTTC = etude.prix_total || 0;
      const montantHT = montantTTC / 1.2;
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
      fetchVentes();
    } catch (error) {
      console.error("Erreur création vente:", error);
      toast.error("Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileLayout title="CRM">
      <div className="p-4 space-y-4 pb-24">
        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="clients" className="gap-2">
              <Users className="h-4 w-4" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="ventes" className="gap-2">
              <Euro className="h-4 w-4" />
              Ventes
            </TabsTrigger>
          </TabsList>

          {/* Clients Tab */}
          <TabsContent value="clients" className="space-y-4 mt-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between px-1 text-sm">
              <span className="text-muted-foreground">
                {filteredClients.length} client{filteredClients.length > 1 ? "s" : ""}
              </span>
              <Button size="sm" className="bg-gradient-hero gap-1">
                <Plus className="h-4 w-4" />
                Nouveau
              </Button>
            </div>

            {/* Client list */}
            {clientsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">
                  {clients.length === 0 ? "Aucun client" : "Aucun client trouvé"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {clients.length === 0
                    ? "Commencez par ajouter votre premier client"
                    : "Essayez avec d'autres termes de recherche"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredClients.map((client, index) => (
                  <Card
                    key={client.id}
                    className="shadow-card overflow-hidden animate-slide-up cursor-pointer hover:shadow-lg transition-shadow"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => navigate(`/clients/${client.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <h3 className="font-semibold text-foreground">
                            {client.prenom ? `${client.prenom} ${client.nom}` : client.nom}
                          </h3>
                          <div className="space-y-1">
                            {client.telephone && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="h-3.5 w-3.5" />
                                <span>{client.telephone}</span>
                              </div>
                            )}
                            {(client.adresse || client.ville) && (
                              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                <span>
                                  {client.ville || client.adresse}
                                  {client.code_postal && ` (${client.code_postal})`}
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(client.created_at)}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Ventes Tab */}
          <TabsContent value="ventes" className="space-y-4 mt-4">
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

            {/* Ventes filter tabs */}
            <Tabs value={venteFilter} onValueChange={setVenteFilter}>
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="all">Tout</TabsTrigger>
                <TabsTrigger value="en_negociation">Négo</TabsTrigger>
                <TabsTrigger value="signe">Signées</TabsTrigger>
                <TabsTrigger value="paye">Payées</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Ventes list */}
            {ventesLoading ? (
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
                      className="cursor-pointer hover:bg-muted/50 transition-colors relative"
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
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
};

export default CRM;
