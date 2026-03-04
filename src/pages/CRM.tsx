import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { BlurOverlay } from "@/components/layout/BlurOverlay";
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
import { useHejjaMode } from "@/hooks/useHejjaMode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PipelineKanban } from "@/components/crm/PipelineKanban";
import { VentesGroupedList } from "@/components/crm/VentesGroupedList";
import { VenteSelectionBar } from "@/components/crm/VenteSelectionBar";
import { QontoInvoice } from "@/components/crm/QontoInvoice";
import { VenteCard } from "@/components/crm/VenteCard";
import { PullToRefreshContainer } from "@/components/common/PullToRefreshContainer";
import { MultiSelectFilter, FilterOption } from "@/components/crm/MultiSelectFilter";
import { useVenteCommissions } from "@/hooks/useVenteCommissions";
import {
  Search,
  Phone,
  MapPin,
  ChevronRight,
  ChevronDown,
  Plus,
  Euro,
  FileText,
  Loader2,
  Users,
  Kanban,
  CheckCircle2,
  XCircle,
  Filter,
  Building2,
  Tag,
  MessageCircle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { VenteStatus, isCancellationStatus } from "@/lib/venteStatusConfig";

interface Regie {
  id: string;
  nom: string;
  couleur: string;
  is_hejja: boolean;
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
  is_retape?: boolean;
  retape_original_id?: string | null;
  regie_id?: string | null;
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
  regie_id?: string | null;
  etude_id?: string | null;
  is_retape?: boolean;
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
  const { isActive: modeHejjaActive } = useHejjaMode();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("ventes");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout>;
    return (value: string) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setSearchQuery(value), 200);
    };
  }, []);
  const [searchInput, setSearchInput] = useState("");
  
  // Clients state
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [clientCategoryFilters, setClientCategoryFilters] = useState<string[]>([]);
  
  // Client-RDV status mapping (loaded with clients)
  const [clientRdvStatuses, setClientRdvStatuses] = useState<Record<string, string[]>>({});
  const [clientVenteStatuses, setClientVenteStatuses] = useState<Record<string, VenteStatus[]>>({});
  
  // Ventes state
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [etudes, setEtudes] = useState<Etude[]>([]);
  const [ventesLoading, setVentesLoading] = useState(true);
  const [statusFilters, setStatusFilters] = useState<VenteStatus[]>([]);
  const [typeFilter, setTypeFilter] = useState<"all" | VenteType>("all");
  const [regieFilters, setRegieFilters] = useState<string[]>([]);
  const [clientRegieFilters, setClientRegieFilters] = useState<string[]>([]);
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
      setRegieFilters([regieParam]);
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
      .select("id, nom, couleur, is_hejja")
      .eq("user_id", user.id)
      .eq("actif", true)
      .order("nom");
    setRegies((data || []) as Regie[]);
  };

  const fetchClients = async () => {
    if (!user) return;
    setClientsLoading(true);
    
    // Fetch all clients, RDV statuses, and vente statuses for categorization
    const [clientsRes, rdvRes, ventesRes] = await Promise.all([
      supabase
        .from("clients")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("rdv")
        .select("client_id, status")
        .eq("user_id", user.id),
      supabase
        .from("ventes")
        .select("client_id, status")
        .eq("user_id", user.id)
    ]);
    
    if (clientsRes.error) {
      console.error("Error fetching clients:", clientsRes.error);
      setClientsLoading(false);
      return;
    }
    
    // Build client -> rdv statuses mapping
    const rdvStatusMap: Record<string, string[]> = {};
    for (const rdv of rdvRes.data || []) {
      if (!rdvStatusMap[rdv.client_id]) rdvStatusMap[rdv.client_id] = [];
      if (!rdvStatusMap[rdv.client_id].includes(rdv.status)) {
        rdvStatusMap[rdv.client_id].push(rdv.status);
      }
    }
    setClientRdvStatuses(rdvStatusMap);
    
    // Build client -> vente statuses mapping
    const venteStatusMap: Record<string, VenteStatus[]> = {};
    for (const vente of ventesRes.data || []) {
      if (!venteStatusMap[vente.client_id]) venteStatusMap[vente.client_id] = [];
      if (!venteStatusMap[vente.client_id].includes(vente.status as VenteStatus)) {
        venteStatusMap[vente.client_id].push(vente.status as VenteStatus);
      }
    }
    setClientVenteStatuses(venteStatusMap);
    
    let clientsToShow = clientsRes.data || [];
    
    if (showActiveOnly) {
      // Active = has at least one RDV with active status
      const activeStatuses = ['nouveau', 'reporte', 'r2', 'r2_prestudy', 'signe'];
      const activeClientIds = new Set(
        Object.entries(rdvStatusMap)
          .filter(([_, statuses]) => statuses.some(s => activeStatuses.includes(s)))
          .map(([clientId]) => clientId)
      );
      clientsToShow = clientsToShow.filter(c => activeClientIds.has(c.id));
    }
    
    setClients(clientsToShow);
    setClientsLoading(false);
  };

  const fetchVentes = async () => {
    if (!user) return;
    setVentesLoading(true);

    try {
      const [ventesRes, etudesRes] = await Promise.all([
        supabase
          .from("ventes")
          .select("*, client:clients(id, nom, prenom), regie_id, etude_id")
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

  // Helper: get client category based on their RDV/Vente statuses
  const getClientCategory = (clientId: string): string[] => {
    const rdvStatuses = clientRdvStatuses[clientId] || [];
    const venteStatuses = clientVenteStatuses[clientId] || [];
    
    const categories: string[] = [];
    
    // "Signés" = has at least one vente (not annule)
    const hasActiveVente = venteStatuses.some(s => !isCancellationStatus(s));
    if (hasActiveVente) categories.push('signe');
    
    // "R2/Reporté" = has RDV with r2, r2_prestudy, or reporte status
    const hasR2 = rdvStatuses.some(s => ['r2', 'r2_prestudy', 'reporte'].includes(s));
    if (hasR2) categories.push('r2_reporte');
    
    // "Nouveaux" = has RDV with nouveau status (no vente yet)
    const hasNouveau = rdvStatuses.includes('nouveau');
    if (hasNouveau && !hasActiveVente) categories.push('nouveau');
    
    // "Négatif" = has RDV with negatif status
    const hasNegatif = rdvStatuses.includes('negatif');
    if (hasNegatif && !hasActiveVente) categories.push('negatif');
    
    // "Annulés" = all ventes are annulé OR RDV is annule/ni
    const allVentesAnnule = venteStatuses.length > 0 && venteStatuses.every(s => isCancellationStatus(s));
    const hasAnnuleRdv = rdvStatuses.some(s => ['annule', 'ni'].includes(s));
    if (allVentesAnnule || (hasAnnuleRdv && !hasActiveVente)) categories.push('annule');
    
    return categories;
  };

  // Helper: get the primary status badge info for a client
  const getClientStatusBadge = (clientId: string): { label: string; color: string; bgColor: string } | null => {
    const rdvStatuses = clientRdvStatuses[clientId] || [];
    const venteStatuses = clientVenteStatuses[clientId] || [];
    
    // Priority order: Signé > R2 Pré-étude > R2 > Reporté > Nouveau > Négatif > Annulé
    const hasActiveVente = venteStatuses.some(s => !isCancellationStatus(s));
    if (hasActiveVente) return { label: 'Signé', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-500/20' };
    
    if (rdvStatuses.includes('r2_prestudy')) return { label: 'R2 Pré-étude', color: 'text-indigo-700 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-500/20' };
    if (rdvStatuses.includes('r2')) return { label: 'R2', color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-500/20' };
    if (rdvStatuses.includes('reporte')) return { label: 'Reporté', color: 'text-orange-700 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-500/20' };
    if (rdvStatuses.includes('nouveau')) return { label: 'Nouveau', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-500/20' };
    if (rdvStatuses.includes('negatif')) return { label: 'Négatif', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-500/20' };
    
    const allVentesAnnule = venteStatuses.length > 0 && venteStatuses.every(s => isCancellationStatus(s));
    const hasAnnuleRdv = rdvStatuses.includes('annule');
    if (allVentesAnnule || hasAnnuleRdv) return { label: 'Annulé', color: 'text-gray-700 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-500/20' };
    
    return null;
  };

  // Sort priority for client categories
  const getCategorySortPriority = (clientId: string): number => {
    const categories = getClientCategory(clientId);
    if (categories.includes('r2_reporte')) return 0;
    if (categories.includes('nouveau')) return 1;
    if (categories.includes('signe')) return 2;
    if (categories.includes('negatif')) return 3;
    if (categories.includes('annule')) return 4;
    return 5;
  };

  // Client category filter options
  const clientCategoryOptions: FilterOption[] = [
    { id: 'signe', label: 'Signés', color: '#22c55e' },
    { id: 'r2_reporte', label: 'R2 / Reporté', color: '#8b5cf6' },
    { id: 'nouveau', label: 'Nouveaux', color: '#3b82f6' },
    { id: 'negatif', label: 'Négatifs', color: '#ef4444' },
    { id: 'annule', label: 'Annulés', color: '#6b7280' },
  ];

  // Client helpers - filter out retape clients when HEJJA mode is not active, then sort by category
  const filteredClients = useMemo(() => {
    const filtered = clients.filter((client) => {
      // Hide retape clients when HEJJA mode is not active
      if (!modeHejjaActive && client.is_retape) return false;
      
      // Filter by regie (multi-select)
      if (clientRegieFilters.length > 0) {
        if (!client.regie_id || !clientRegieFilters.includes(client.regie_id)) return false;
      }
      
      // Filter by category (multi-select)
      if (clientCategoryFilters.length > 0) {
        const clientCategories = getClientCategory(client.id);
        if (!clientCategoryFilters.some(cat => clientCategories.includes(cat))) return false;
      }
      
      // Search filter
      return (
        client.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.prenom && client.prenom.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (client.telephone && client.telephone.includes(searchQuery)) ||
        (client.ville && client.ville.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    });
    
    // Sort by category priority: Signés → À revoir → Nouveaux → Négatifs → Annulés
    return filtered.sort((a, b) => getCategorySortPriority(a.id) - getCategorySortPriority(b.id));
  }, [clients, modeHejjaActive, clientRegieFilters, clientCategoryFilters, searchQuery, clientRdvStatuses, clientVenteStatuses]);

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

  // Helper: check if vente is installed for more than 2 weeks (billable)
  const isInstalledAndBillable = (v: Vente): boolean => {
    if (v.status !== 'installe') return false;
    // Check date_installation from metadata or date_signature as fallback
    const installDate = (v as any).date_installation || v.date_signature;
    if (!installDate) return true; // If no date, consider it billable
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    return new Date(installDate) <= twoWeeksAgo;
  };

  // "Signées" = all signed ventes (not annule)
  const signeStatuses: VenteStatus[] = ['signe', 'cq_a_faire', 'cq_fait', 'attente_financement', 'envoi_pose', 'en_installation', 'installe', 'attente_paiement', 'paye'];
  
  // "En cours" = signed but not installed yet (before pose)
  const enCoursStatuses: VenteStatus[] = ['signe', 'cq_a_faire', 'cq_fait', 'attente_financement', 'envoi_pose'];
  
  const filteredVentes = ventes.filter(v => {
    // Hide retape ventes when HEJJA mode is not active
    if (!modeHejjaActive && v.is_retape) return false;
    
    // Hide ventes from HEJJA regies when not in HEJJA mode
    if (!modeHejjaActive && v.regie_id) {
      const regie = regies.find(r => r.id === v.regie_id);
      if (regie?.is_hejja) return false;
    }
    // Don't exclude cancelled here — they'll be shown in a collapsible section
    
    // Filter by status (multi-select)
    if (statusFilters.length > 0) {
      if (!statusFilters.includes(v.status)) return false;
    }
    
    // Filter by type
    if (typeFilter !== "all" && v.type_vente !== typeFilter) return false;
    
    // Filter by regie (multi-select)
    if (regieFilters.length > 0) {
      if (!v.regie_id || !regieFilters.includes(v.regie_id)) return false;
    }
    
    // Filter by date range
    const signatureDate = v.date_signature || v.created_at;
    if (dateFrom && new Date(signatureDate) < new Date(dateFrom)) return false;
    if (dateTo && new Date(signatureDate) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const clientEtudes = etudes.filter(e => e.client_id === formData.client_id);
  
  // Filter stats based on HEJJA mode
  const statsVentes = modeHejjaActive ? ventes : ventes.filter(v => {
    if (v.is_retape) return false;
    const regie = regies.find(r => r.id === v.regie_id);
    return !regie?.is_hejja;
  });
  const totalCA = statsVentes.filter(v => v.status !== 'annule' && v.type_vente !== 'external_installation').reduce((sum, v) => sum + v.montant_ttc, 0);
  const ventesSigned = statsVentes.filter(v => !['en_negociation', 'annule'].includes(v.status) && v.type_vente !== 'external_installation').length;
  
  // Commission HEJJA: sum of retape commissions
  const hejjaVentes = ventes.filter(v => v.is_retape || regies.find(r => r.id === v.regie_id)?.is_hejja);

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
          ? 'installe'  // Les installations externes sont directement au statut "posé"
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
      <BlurOverlay storageKey="crm">
      <PullToRefreshContainer onRefresh={async () => { await Promise.all([fetchClients(), fetchVentes()]); }}>
      <div className="p-4 space-y-4 pb-24 max-w-4xl mx-auto">
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
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); debouncedSearch(e.target.value); }}
                className="pl-10"
              />
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap gap-2">
              {/* Toggle for active clients filter */}
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Actifs</span>
                <Switch
                  checked={showActiveOnly}
                  onCheckedChange={setShowActiveOnly}
                />
              </div>
              
              {/* Category filter for clients */}
              <MultiSelectFilter
                label="Statut"
                icon={<Tag className="h-4 w-4" />}
                placeholder="Tous les statuts"
                options={clientCategoryOptions}
                selected={clientCategoryFilters}
                onChange={setClientCategoryFilters}
              />
              
              {/* Regie filter for clients */}
              {regies.length > 0 && (
                <MultiSelectFilter
                  label="Régie"
                  icon={<Building2 className="h-4 w-4" />}
                  placeholder="Toutes les régies"
                  options={regies.map(r => ({
                    id: r.id,
                    label: r.nom,
                    color: r.couleur
                  }))}
                  selected={clientRegieFilters}
                  onChange={setClientRegieFilters}
                />
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between px-1 text-sm">
              <span className="text-muted-foreground">
                {filteredClients.length} client{filteredClients.length > 1 ? "s" : ""}
                {showActiveOnly && " actif" + (filteredClients.length > 1 ? "s" : "")}
                {clientCategoryFilters.length > 0 && ` • ${clientCategoryFilters.length} filtre${clientCategoryFilters.length > 1 ? 's' : ''}`}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground">
                              {client.prenom ? `${client.prenom} ${client.nom}` : client.nom}
                            </h3>
                            {/* Status badge */}
                            {(() => {
                              const badge = getClientStatusBadge(client.id);
                              return badge ? (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${badge.color} ${badge.bgColor}`}>
                                  {badge.label}
                                </span>
                              ) : null;
                            })()}
                            {client.regie_id && (() => {
                              const regie = regies.find(r => r.id === client.regie_id);
                              return regie ? (
                                <span 
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                                  style={{ backgroundColor: regie.couleur }}
                                >
                                  {regie.nom}
                                </span>
                              ) : null;
                            })()}
                            {client.is_retape && (
                              <Badge variant="outline" className="text-[10px] h-5 bg-orange-500/10 text-orange-500 border-orange-500/30">
                                RETAPE
                              </Badge>
                            )}
                          </div>
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
                          
                          {/* Quick action buttons */}
                          {(client.telephone || client.adresse || client.ville) && (
                            <div className="flex items-center gap-1.5 pt-1">
                              {client.telephone && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs gap-1"
                                  onClick={(e) => { e.stopPropagation(); window.open(`tel:${client.telephone}`, "_self"); }}
                                >
                                  <Phone className="h-3 w-3" />
                                  Appeler
                                </Button>
                              )}
                              {client.telephone && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const clean = client.telephone!.replace(/\D/g, "");
                                    const fr = clean.startsWith("0") ? `33${clean.slice(1)}` : clean;
                                    window.open(`https://wa.me/${fr}`, "_blank");
                                  }}
                                >
                                  <MessageCircle className="h-3 w-3" />
                                </Button>
                              )}
                              {(client.adresse || client.ville) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const addr = [client.adresse, client.code_postal, client.ville].filter(Boolean).join(",");
                                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, "_blank");
                                  }}
                                >
                                  <MapPin className="h-3 w-3" />
                                  GPS
                                </Button>
                              )}
                            </div>
                          )}
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
                        💡 Cette vente sera créée au statut "Posé". Seuls la date de pose et le montant de la commission sont requis.
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

                  {/* Étude associée - seulement pour ventes standard */}
                  {formData.type_vente !== 'external_installation' && formData.client_id && clientEtudes.length > 0 && (
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

                  {/* Pour ventes externes: juste commission et date de pose */}
                  {formData.type_vente === 'external_installation' ? (
                    <>
                      <div className="space-y-2">
                        <Label>Commission (€ HT) *</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={formData.montant_ht}
                            onChange={(e) => {
                              const ht = e.target.value;
                              setFormData(prev => ({ ...prev, montant_ht: ht, montant_ttc: ht }));
                            }}
                            placeholder="Ex: 500"
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Montant que vous facturez pour cette installation</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Date de pose *</Label>
                        <Input
                          type="date"
                          value={formData.date_signature}
                          onChange={(e) => setFormData(prev => ({ ...prev, date_signature: e.target.value }))}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Montants HT/TTC pour ventes standard */}
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
                    </>
                  )}

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
              {/* Status and Regie multi-select filters */}
              <div className="flex flex-wrap gap-2">
                <MultiSelectFilter
                  label="Statut"
                  icon={<Tag className="h-4 w-4" />}
                  placeholder="Tous les statuts"
                  options={[
                    { id: 'signe', label: 'Signé' },
                    { id: 'cq_a_faire', label: 'CQ à faire' },
                    { id: 'cq_fait', label: 'CQ fait' },
                    { id: 'attente_financement', label: 'Attente financement' },
                    { id: 'envoi_pose', label: 'Envoi pose' },
                    { id: 'en_installation', label: 'En installation' },
                    { id: 'installe', label: 'Installé' },
                    { id: 'attente_paiement', label: 'Attente paiement' },
                    { id: 'paye', label: 'Payé' },
                  ]}
                  selected={statusFilters}
                  onChange={(s) => setStatusFilters(s as VenteStatus[])}
                  className="min-w-[140px] flex-1"
                />
                
                {regies.length > 0 && (
                  <MultiSelectFilter
                    label="Régie"
                    icon={<Building2 className="h-4 w-4" />}
                    placeholder="Toutes les régies"
                    options={regies.map(r => ({
                      id: r.id,
                      label: r.nom,
                      color: r.couleur
                    }))}
                    selected={regieFilters}
                    onChange={setRegieFilters}
                    className="min-w-[140px] flex-1"
                  />
                )}
              </div>

              {/* Type filter */}
              <div className="flex flex-wrap gap-2">
                <Select value={typeFilter} onValueChange={(v: "all" | VenteType) => setTypeFilter(v)}>
                  <SelectTrigger className="w-full sm:w-auto sm:min-w-[200px]">
                    <SelectValue placeholder="Type de vente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="standard">Ventes standard</SelectItem>
                    <SelectItem value="external_installation">Installations externes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date range filter */}
              <div className="flex flex-wrap gap-2 items-center">
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

              {/* Active filters summary */}
              {(statusFilters.length > 0 || regieFilters.length > 0) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Filter className="h-3 w-3" />
                  <span>
                    {filteredVentes.length} vente{filteredVentes.length > 1 ? 's' : ''} 
                    {statusFilters.length > 0 && ` • ${statusFilters.length} statut${statusFilters.length > 1 ? 's' : ''}`}
                    {regieFilters.length > 0 && ` • ${regieFilters.length} régie${regieFilters.length > 1 ? 's' : ''}`}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      setStatusFilters([]);
                      setRegieFilters([]);
                    }}
                  >
                    Effacer
                  </Button>
                </div>
              )}
            </div>

            {/* Ventes list */}
            <VentesGroupedList
              ventes={filteredVentes}
              regies={regies}
              selectedVenteIds={selectedVenteIds}
              selectionMode={selectionMode}
              onCardClick={(vente) => {
                if (selectionMode) {
                  setSelectedVenteIds(prev =>
                    prev.includes(vente.id)
                      ? prev.filter(id => id !== vente.id)
                      : [...prev, vente.id]
                  );
                } else {
                  navigate(`/ventes/${vente.id}`);
                }
              }}
              getCommission={getCommission}
              onRefresh={fetchVentes}
              isLoading={ventesLoading}
            />
          </TabsContent>

          {/* Pipeline Tab */}
          <TabsContent value="pipeline" className="mt-4 space-y-4">
            {/* Regie filter for pipeline */}
            {regies.length > 0 && (
              <MultiSelectFilter
                label="Régie"
                icon={<Building2 className="h-4 w-4" />}
                placeholder="Toutes les régies"
                options={regies.map(r => ({
                  id: r.id,
                  label: r.nom,
                  color: r.couleur
                }))}
                selected={regieFilters}
                onChange={setRegieFilters}
                className="w-full"
              />
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
      </PullToRefreshContainer>
      </BlurOverlay>
    </MobileLayout>
  );
};

export default CRM;
