import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { PipelineKanban } from "@/components/crm/PipelineKanban";
import { VenteSelectionBar } from "@/components/crm/VenteSelectionBar";
import { QontoInvoice } from "@/components/crm/QontoInvoice";
import { VenteCard } from "@/components/crm/VenteCard";
import { useVenteCommissions } from "@/hooks/useVenteCommissions";
import {
  Search,
  Phone,
  MapPin,
  ChevronRight,
  Plus,
  Euro,
  FileText,
  Loader2,
  Users,
  Kanban,
  CheckCircle2,
  Filter,
  Building2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

type VenteStatus = 'en_negociation' | 'signe' | 'cq_a_faire' | 'cq_fait' | 'attente_financement' | 'envoi_pose' | 'en_installation' | 'installe' | 'attente_paiement' | 'paye' | 'annule';

interface Regie {
  id: string;
  nom: string;
  couleur: string;
}

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

type VenteType = 'standard' | 'external_installation';

interface Vente {
  id: string;
  numero_contrat: string | null;
  date_signature: string | null;
  montant_ht: number;
  montant_ttc: number;
  puissance_kwc: number | null;
  status: VenteStatus;
  type_vente: VenteType;
  notes: string | null;
  created_at: string;
  decom_montant?: number | null;
  decom_raison?: string | null;
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


const CRM = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("ventes");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Clients state
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  
  // Ventes state
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [etudes, setEtudes] = useState<Etude[]>([]);
  const [ventesLoading, setVentesLoading] = useState(true);
  const [venteFilter, setVenteFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | VenteType>("all");
  const [regieFilter, setRegieFilter] = useState<string>("all");
  const [regies, setRegies] = useState<Regie[]>([]);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qontoDialogOpen, setQontoDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedVenteIds, setSelectedVenteIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

  // Use the commissions hook
  const { getCommission } = useVenteCommissions(ventes);
  
  // Form state for new vente
  const [formData, setFormData] = useState({
    client_id: "",
    etude_id: "",
    montant_ht: "",
    montant_ttc: "",
    puissance_kwc: "",
    numero_contrat: "",
    date_signature: "",
    notes: "",
    type_vente: "standard" as VenteType
  });
  
  // Track if client is pre-filled from URL (external installation from planning)
  const [prefilledClientName, setPrefilledClientName] = useState<string | null>(null);

  // Handle URL params for pre-filled vente creation
  useEffect(() => {
    const newVente = searchParams.get("newVente");
    const clientId = searchParams.get("clientId");
    const clientName = searchParams.get("clientName");
    const type = searchParams.get("type") as VenteType | null;

    if (newVente === "true" && clientId) {
      setActiveTab("ventes");
      setFormData(prev => ({
        ...prev,
        client_id: clientId,
        type_vente: type || "standard",
      }));
      // Store the client name for display (avoid showing dropdown for external installations)
      if (type === "external_installation" && clientName) {
        setPrefilledClientName(decodeURIComponent(clientName));
      }
      setDialogOpen(true);
      // Clear the URL params
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Handle regie filter from URL
  useEffect(() => {
    const regieParam = searchParams.get("regie");
    if (regieParam) {
      setRegieFilter(regieParam);
      setActiveTab("ventes");
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      fetchClients();
      fetchVentes();
      fetchRegies();
    }
  }, [user, showActiveOnly]);

  const fetchRegies = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("regies")
      .select("id, nom, couleur")
      .eq("user_id", user.id)
      .eq("actif", true)
      .order("nom");
    setRegies(data || []);
  };

  const fetchClients = async () => {
    if (!user) return;
    setClientsLoading(true);
    
    if (showActiveOnly) {
      // Only fetch clients that have at least one RDV with active status
      // Active statuses: nouveau, reporte, r2, r2_prestudy, signe
      const activeStatuses = ['nouveau', 'reporte', 'r2', 'r2_prestudy', 'signe'] as const;
      
      // First get RDVs with active status to find active client IDs
      const { data: rdvData, error: rdvError } = await supabase
        .from("rdv")
        .select("client_id")
        .eq("user_id", user.id)
        .in("status", activeStatuses);
      
      if (rdvError) {
        console.error("Error fetching active RDVs:", rdvError);
        setClientsLoading(false);
        return;
      }
      
      // Get unique client IDs from active RDVs
      const activeClientIds = [...new Set(rdvData?.map(r => r.client_id) || [])];
      
      if (activeClientIds.length === 0) {
        setClients([]);
        setClientsLoading(false);
        return;
      }
      
      // Fetch only clients with active RDVs
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .in("id", activeClientIds)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setClients(data);
      }
    } else {
      // Fetch all clients
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setClients(data);
      }
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
          .select("*, client:clients(id, nom, prenom), regie_id")
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

  const filteredVentes = ventes.filter(v => {
    // Filter by status
    if (venteFilter !== "all" && v.status !== venteFilter) return false;
    // Filter by type
    if (typeFilter !== "all" && v.type_vente !== typeFilter) return false;
    // Filter by regie
    if (regieFilter !== "all" && (v as any).regie_id !== regieFilter) return false;
    // Filter by date range
    const signatureDate = v.date_signature || v.created_at;
    if (dateFrom && new Date(signatureDate) < new Date(dateFrom)) return false;
    if (dateTo && new Date(signatureDate) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

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
      // Récupérer automatiquement la régie depuis le dernier RDV du client
      let regieId: string | null = null;
      const { data: lastRdv } = await supabase
        .from("rdv")
        .select("regie_id")
        .eq("client_id", formData.client_id)
        .not("regie_id", "is", null)
        .order("date_heure", { ascending: false })
        .limit(1)
        .single();
      
      if (lastRdv?.regie_id) {
        regieId = lastRdv.regie_id;
      }

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
        type_vente: formData.type_vente,
        regie_id: regieId,
        status: formData.type_vente === 'external_installation' 
          ? 'paye'  // Les installations externes sont directement marquées comme payées
          : (formData.date_signature ? 'signe' : 'en_negociation')
      });

      if (error) throw error;

      const regieInfo = regieId ? regies.find(r => r.id === regieId) : null;
      toast.success(
        regieInfo 
          ? `Vente créée (Régie: ${regieInfo.nom})` 
          : "Vente créée avec succès"
      );
      setDialogOpen(false);
      setPrefilledClientName(null);
      setFormData({
        client_id: "",
        etude_id: "",
        montant_ht: "",
        montant_ttc: "",
        puissance_kwc: "",
        numero_contrat: "",
        date_signature: "",
        notes: "",
        type_vente: "standard"
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
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="clients" className="gap-1 text-xs">
              <Users className="h-3.5 w-3.5" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="ventes" className="gap-1 text-xs">
              <Euro className="h-3.5 w-3.5" />
              Ventes
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1 text-xs">
              <Kanban className="h-3.5 w-3.5" />
              Pipeline
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

            {/* Toggle for active clients filter */}
            <div className="flex items-center justify-between px-1 py-2 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Clients actifs uniquement</span>
              </div>
              <Switch
                checked={showActiveOnly}
                onCheckedChange={setShowActiveOnly}
              />
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between px-1 text-sm">
              <span className="text-muted-foreground">
                {filteredClients.length} client{filteredClients.length > 1 ? "s" : ""}
                {showActiveOnly && " actif" + (filteredClients.length > 1 ? "s" : "")}
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
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setPrefilledClientName(null);
            }}>
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
                  {/* Type de vente */}
                  <div className="space-y-2">
                    <Label>Type de vente</Label>
                    <Select 
                      value={formData.type_vente} 
                      onValueChange={(v: VenteType) => setFormData(prev => ({ ...prev, type_vente: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Vente standard</SelectItem>
                        <SelectItem value="external_installation">Installation pour un autre commercial</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.type_vente === 'external_installation' && (
                      <p className="text-xs text-muted-foreground bg-amber-500/10 p-2 rounded border border-amber-200">
                        💡 Cette vente sera directement marquée comme "Payée" et hors pipeline standard.
                      </p>
                    )}
                  </div>

                  {/* Client selection - show read-only display for external installations with prefilled client */}
                  {prefilledClientName && formData.type_vente === 'external_installation' ? (
                    <div className="space-y-2">
                      <Label>Client</Label>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{prefilledClientName}</span>
                        <Badge variant="secondary" className="ml-auto text-xs">Depuis RDV</Badge>
                      </div>
                    </div>
                  ) : (
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
                  )}

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
                      <Label className="flex items-center gap-2">
                        Montant HT *
                        <Badge variant="outline" className="text-xs font-normal bg-muted">HT</Badge>
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={formData.montant_ht}
                          onChange={(e) => {
                            const ht = e.target.value;
                            const ttc = ht ? (parseFloat(ht) * 1.2).toFixed(2) : "";
                            setFormData(prev => ({ ...prev, montant_ht: ht, montant_ttc: ttc }));
                          }}
                          placeholder="0"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Hors taxes (base commissions)</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        Montant TTC *
                        <Badge className="text-xs font-normal bg-primary/20 text-primary border-0">TTC</Badge>
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={formData.montant_ttc}
                          onChange={(e) => {
                            const ttc = e.target.value;
                            const ht = ttc ? (parseFloat(ttc) / 1.2).toFixed(2) : "";
                            setFormData(prev => ({ ...prev, montant_ttc: ttc, montant_ht: ht }));
                          }}
                          placeholder="0"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Toutes taxes comprises</p>
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

            {/* Selection bar */}
            {selectedVenteIds.length > 0 && (
              <VenteSelectionBar
                selectedIds={selectedVenteIds}
                onClear={() => {
                  setSelectedVenteIds([]);
                  setSelectionMode(false);
                }}
                onRefresh={fetchVentes}
                onGenerateInvoice={() => setQontoDialogOpen(true)}
              />
            )}

            {/* Qonto Invoice Dialog */}
            <QontoInvoice
              venteIds={selectedVenteIds}
              ventes={ventes}
              open={qontoDialogOpen}
              onOpenChange={setQontoDialogOpen}
            />

            {/* Actions bar */}
            <div className="flex gap-2">
              <Button 
                variant={selectionMode ? "default" : "outline"} 
                className="flex-1"
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  if (selectionMode) setSelectedVenteIds([]);
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {selectionMode ? "Annuler sélection" : "Sélectionner"}
              </Button>
            </div>

            {/* Filters section */}
            <div className="space-y-3">
              {/* Type and Regie filters */}
              <div className="flex gap-2">
                <Select value={typeFilter} onValueChange={(v: "all" | VenteType) => setTypeFilter(v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Type de vente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="standard">Ventes standard</SelectItem>
                    <SelectItem value="external_installation">Installations externes</SelectItem>
                  </SelectContent>
                </Select>
                
                {regies.length > 0 && (
                  <Select value={regieFilter} onValueChange={setRegieFilter}>
                    <SelectTrigger className="flex-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Régie" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les régies</SelectItem>
                      {regies.map((regie) => (
                        <SelectItem key={regie.id} value={regie.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: regie.couleur }}
                            />
                            {regie.nom}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Date range filter */}
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    placeholder="Du"
                    className="text-xs"
                  />
                </div>
                <span className="text-muted-foreground text-sm">→</span>
                <div className="flex-1">
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    placeholder="Au"
                    className="text-xs"
                  />
                </div>
                {(dateFrom || dateTo) && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                    className="px-2"
                  >
                    ✕
                  </Button>
                )}
              </div>

              {/* Status filter tabs */}
              <Tabs value={venteFilter} onValueChange={setVenteFilter}>
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="all">Tout</TabsTrigger>
                  <TabsTrigger value="en_negociation">Négo</TabsTrigger>
                  <TabsTrigger value="signe">Signées</TabsTrigger>
                  <TabsTrigger value="paye">Payées</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

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
                  const isSelected = selectedVenteIds.includes(vente.id);
                  const commission = getCommission(vente.id);

                  const handleCardClick = () => {
                    if (selectionMode) {
                      setSelectedVenteIds(prev => 
                        prev.includes(vente.id) 
                          ? prev.filter(id => id !== vente.id)
                          : [...prev, vente.id]
                      );
                    } else {
                      navigate(`/ventes/${vente.id}`);
                    }
                  };

                  return (
                    <VenteCard
                      key={vente.id}
                      vente={vente}
                      commission={commission}
                      selectionMode={selectionMode}
                      isSelected={isSelected}
                      onClick={handleCardClick}
                      onRefresh={fetchVentes}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Pipeline Tab */}
          <TabsContent value="pipeline" className="mt-4 space-y-4">
            {/* Regie filter for pipeline */}
            {regies.length > 0 && (
              <Select value={regieFilter} onValueChange={setRegieFilter}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Filtrer par régie" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les régies</SelectItem>
                  {regies.map((regie) => (
                    <SelectItem key={regie.id} value={regie.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: regie.couleur }}
                        />
                        {regie.nom}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {ventesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <PipelineKanban ventes={filteredVentes} onRefresh={fetchVentes} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
};

export default CRM;
