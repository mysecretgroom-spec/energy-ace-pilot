import React, { useState, useEffect, Suspense, Component, ErrorInfo, ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { StatusBadge, RdvStatus } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Navigation,
  MessageCircle,
  Calendar,
  FileText,
  Image,
  Plus,
  Clock,
  Euro,
  Edit,
  Trash2,
  Sun,
  Zap,
  Pencil,
  Building2,
  RefreshCw,
  Send,
  Loader2,
  AlertTriangle,
  Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHejjaMode } from "@/hooks/useHejjaMode";
import { useToast } from "@/hooks/use-toast";
import { AIExtractedInfo } from "@/components/client/AIExtractedInfo";
import { EditClientDialog } from "@/components/client/EditClientDialog";
import { RegieSelector } from "@/components/planning/RegieSelector";
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog";
import { useDeleteEntity } from "@/hooks/useDeleteEntity";
import { useSendWhatsAppPdfDoc } from "@/hooks/useSendWhatsAppPdfDoc";
import { RdvStatusSelector } from "@/components/planning/RdvStatusSelector";
import { useEtudePdfDownload } from "@/hooks/useEtudePdfDownload";
import { ResultatPdfChoiceDialog } from "@/components/etude/ResultatPdfChoiceDialog";
import { WhatsAppSendButton } from "@/components/crm/WhatsAppSendButton";
import { VenteCard } from "@/components/crm/VenteCard";
import { VenteStatus } from "@/lib/venteStatusConfig";

// Lazy load heavy components to avoid blocking the main thread
const MultiImportFlow = React.lazy(() => import("@/components/scanner/MultiImportFlow").then(m => ({ default: m.MultiImportFlow })));
const MultiDocumentSelector = React.lazy(() => import("@/components/documents/MultiDocumentSelector").then(m => ({ default: m.MultiDocumentSelector })));
const DocumentSearch = React.lazy(() => import("@/components/documents/DocumentSearch").then(m => ({ default: m.DocumentSearch })));
const RetapeDialog = React.lazy(() => import("@/components/crm/RetapeDialog").then(m => ({ default: m.RetapeDialog })));
const AddDocumentFlow = React.lazy(() => import("@/components/scanner/AddDocumentFlow").then(m => ({ default: m.AddDocumentFlow })));

// Error Boundary to catch render crashes
class ClientDetailErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ClientDetail] Crash caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <MobileLayout title="Erreur">
          <div className="flex flex-col items-center justify-center h-64 p-6 text-center gap-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h2 className="text-lg font-semibold">Erreur d'affichage</h2>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message || "Une erreur inattendue s'est produite"}
            </p>
            <Button onClick={() => window.location.href = "/crm"}>
              Retour au CRM
            </Button>
          </div>
        </MobileLayout>
      );
    }
    return this.props.children;
  }
}

const LazyFallback = () => (
  <div className="flex items-center justify-center py-8">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  </div>
);

interface ClientMetadata {
  situation_familiale?: string;
  proprietaire?: boolean;
  type_habitation?: string;
  surface_habitable?: number;
  annee_construction?: number;
  type_chauffage?: string;
  facture_energie?: number;
  revenus_fiscaux?: number;
  nb_personnes_foyer?: number;
  type_toiture?: string;
  orientation_toiture?: string;
  projet_motivation?: string;
  budget_estime?: number;
  urgence?: string;
  notes_supplementaires?: string;
  last_email_update?: string;
}

interface RdvMetadata {
  ai_extracted?: boolean;
  extraction_date?: string;
  motivation?: string;
  budget_estime?: number;
  urgence?: string;
  type_toiture?: string;
  orientation_toiture?: string;
  facture_energie?: number;
  type_chauffage?: string;
}

interface Client {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  telephone_secondaire: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  metadata: ClientMetadata | null;
  is_retape?: boolean;
  retape_original_id?: string | null;
  regie_id?: string | null;
}

interface ClientRegie {
  id: string;
  nom: string;
  couleur: string | null;
}

interface Rdv {
  id: string;
  date_heure: string;
  duree_minutes: number | null;
  adresse: string | null;
  type_projet: string;
  status: RdvStatus;
  commentaire: string | null;
  metadata: RdvMetadata | null;
  regie_id: string | null;
  regies?: {
    id: string;
    nom: string;
    couleur: string | null;
  } | null;
}

interface Etude {
  id: string;
  puissance_kwc: number | null;
  prix_total: number | null;
  verdict: string | null;
  created_at: string;
  pdf_url: string | null;
  product_type: string | null;
}

interface Document {
  id: string;
  type_document: string;
  nom: string;
  url: string;
  created_at: string;
}

interface HistoriqueAction {
  id: string;
  action_type: string;
  description: string | null;
  created_at: string;
}

interface ClientVente {
  id: string;
  numero_contrat: string | null;
  date_signature: string | null;
  montant_ht: number;
  montant_ttc: number;
  puissance_kwc: number | null;
  status: VenteStatus;
  type_vente?: 'standard' | 'external_installation';
  decom_montant?: number | null;
  decom_raison?: string | null;
  regie_id?: string | null;
  client: { id: string; nom: string; prenom: string | null } | null;
}

interface ClientRegie2 {
  id: string;
  nom: string;
  couleur: string;
}

const ClientDetailInner = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isActive: modeHejjaActive } = useHejjaMode();
  const { toast } = useToast();
  const { downloadOrShare: downloadOrSharePdf, loading: pdfDownloadLoading } = useEtudePdfDownload();

  const [client, setClient] = useState<Client | null>(null);
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [etudes, setEtudes] = useState<Etude[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [historique, setHistorique] = useState<HistoriqueAction[]>([]);
  const [ventes, setVentes] = useState<ClientVente[]>([]);
  const [ventesRegies, setVentesRegies] = useState<ClientRegie2[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("info");
  const [showMultiImport, setShowMultiImport] = useState(false);
  const [showLiveScanner, setShowLiveScanner] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRetapeDialog, setShowRetapeDialog] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [destinationPhone, setDestinationPhone] = useState("");
  const [clientRegie, setClientRegie] = useState<ClientRegie | null>(null);

  // WhatsApp PDF sending
  const { sendPdfDoc, isSending: isSendingDoc } = useSendWhatsAppPdfDoc();
  // Delete functionality
  const {
    isDeleteDialogOpen,
    isDeleting,
    openDeleteDialog,
    confirmDelete,
    cancelDelete,
  } = useDeleteEntity({
    tableName: "clients",
    entityName: "Client",
    onSuccess: () => navigate(-1),
  });

  useEffect(() => {
    if (id && user) {
      fetchClientData();
    }
  }, [id, user]);

  const fetchClientData = async () => {
    if (!id) return;

    setLoading(true);

    // Fetch client first (needed for regie_id)
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (clientError || !clientData) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Client introuvable",
      });
      navigate(-1);
      return;
    }

    setClient({
      ...clientData,
      metadata: clientData.metadata as ClientMetadata | null,
    });

    // Parallel fetch all related data at once
    const [regieResult, rdvResult, etudesResult, docsResult, histResult, ventesResult] = await Promise.all([
      clientData.regie_id
        ? supabase.from("regies").select("id, nom, couleur").eq("id", clientData.regie_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("rdv").select(`*, regies:regie_id (id, nom, couleur)`).eq("client_id", id).order("date_heure", { ascending: false }),
      supabase.from("etudes").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      supabase.from("documents").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      supabase.from("historique_actions").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(20),
      supabase.from("ventes").select("id, numero_contrat, date_signature, montant_ht, montant_ttc, puissance_kwc, status, type_vente, decom_montant, decom_raison, regie_id").eq("client_id", id).order("date_signature", { ascending: false }),
    ]);

    setClientRegie(regieResult.data as ClientRegie | null);
    setRdvs((rdvResult.data || []).map(r => ({
      ...r,
      metadata: r.metadata as RdvMetadata | null,
      regies: r.regies as Rdv["regies"],
    })) as Rdv[]);
    setEtudes((etudesResult.data as Etude[]) || []);
    setDocuments((docsResult.data as Document[]) || []);
    setHistorique((histResult.data as HistoriqueAction[]) || []);

    // Map ventes with client info embedded
    const ventesData = (ventesResult.data || []).map((v: any) => ({
      ...v,
      client: { id: clientData.id, nom: clientData.nom, prenom: clientData.prenom },
    })) as ClientVente[];
    setVentes(ventesData);

    // Fetch regies for ventes
    const regieIds = [...new Set(ventesData.map(v => v.regie_id).filter(Boolean))] as string[];
    if (regieIds.length > 0) {
      const { data: regiesData } = await supabase
        .from("regies")
        .select("id, nom, couleur")
        .in("id", regieIds);
      setVentesRegies((regiesData || []) as ClientRegie2[]);
    } else {
      setVentesRegies([]);
    }

    setLoading(false);
  };

  const openPhone = () => {
    if (client?.telephone) {
      window.open(`tel:${client.telephone}`, "_self");
    }
  };

  const openWhatsApp = () => {
    if (client?.telephone) {
      const phone = client.telephone.replace(/\s/g, "").replace(/^0/, "33");
      window.open(`https://wa.me/${phone}`, "_blank");
    }
  };

  const openNavigation = () => {
    if (client?.adresse) {
      const address = `${client.adresse}, ${client.code_postal} ${client.ville}`;
      window.open(`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`, "_blank");
    }
  };

  const openEmail = () => {
    if (client?.email) {
      window.open(`mailto:${client.email}`, "_self");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getVerdictBadge = (verdict: string | null) => {
    switch (verdict) {
      case "valide":
        return <Badge className="bg-status-signed text-white">Valide</Badge>;
      case "a_etudier":
        return <Badge className="bg-status-reported text-black">À étudier</Badge>;
      case "invalide":
        return <Badge className="bg-status-negative text-white">Invalide</Badge>;
      default:
        return <Badge variant="outline">En cours</Badge>;
    }
  };

  if (loading) {
    return (
      <MobileLayout title="Chargement...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Chargement...</div>
        </div>
      </MobileLayout>
    );
  }

  if (!client) {
    return null;
  }


  return (
    <MobileLayout>
      <div className="p-4 space-y-4">
        {/* Header avec retour */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-display font-bold text-foreground">
                {client.prenom ? `${client.prenom} ${client.nom}` : client.nom}
              </h1>
              {clientRegie && (
                <span 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: clientRegie.couleur || '#888' }}
                >
                  <Building2 className="h-3 w-3" />
                  {clientRegie.nom}
                </span>
              )}
              {client.is_retape && (
                <Badge variant="outline" className="text-xs h-5 bg-orange-500/10 text-orange-500 border-orange-500/30">
                  RETAPE
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Client depuis {formatDate(client.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RegieSelector
              entityId={id!}
              targetTable="clients"
              currentRegieId={client.regie_id}
              currentRegieNom={clientRegie?.nom}
              currentRegieCouleur={clientRegie?.couleur}
              onRegieChange={(regieId, regieNom, regieCouleur) => {
                setClient(prev => prev ? { ...prev, regie_id: regieId } : prev);
                setClientRegie(regieId ? { id: regieId, nom: regieNom || "", couleur: regieCouleur } : null);
              }}
            />
            {modeHejjaActive && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowRetapeDialog(true)}
                className="border-orange-500/50 text-orange-500 hover:bg-orange-500/10"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowEditDialog(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => openDeleteDialog(id!)}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-4 gap-2">
          <Button
            variant="outline"
            className="flex flex-col h-16 gap-1"
            onClick={openPhone}
            disabled={!client.telephone}
          >
            <Phone className="h-5 w-5 text-primary" />
            <span className="text-xs">Appeler</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col h-16 gap-1"
            onClick={openWhatsApp}
            disabled={!client.telephone}
          >
            <MessageCircle className="h-5 w-5 text-status-signed" />
            <span className="text-xs">WhatsApp</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col h-16 gap-1"
            onClick={openNavigation}
            disabled={!client.adresse}
          >
            <Navigation className="h-5 w-5 text-secondary" />
            <span className="text-xs">Itinéraire</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col h-16 gap-1"
            onClick={openEmail}
            disabled={!client.email}
          >
            <Mail className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs">Email</span>
          </Button>
        </div>

        {/* Onglets */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="rdv">RDV ({rdvs.length})</TabsTrigger>
            <TabsTrigger value="ventes">Ventes ({ventes.length})</TabsTrigger>
            <TabsTrigger value="etudes">Études ({etudes.length})</TabsTrigger>
            <TabsTrigger value="docs" className="text-xs">Photos ({documents.length})</TabsTrigger>
          </TabsList>

          {/* Tab Info */}
          <TabsContent value="info" className="space-y-4 mt-4">
            <Card className="shadow-card">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Coordonnées</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 gap-1"
                  onClick={() => setShowEditDialog(true)}
                >
                  <Pencil className="h-3 w-3" />
                  Modifier
                </Button>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {client.telephone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{client.telephone}</span>
                  </div>
                )}
                {client.telephone_secondaire && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{client.telephone_secondaire}</span>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{client.email}</span>
                  </div>
                )}
                {client.adresse && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      {client.adresse}
                      {client.code_postal && `, ${client.code_postal}`}
                      {client.ville && ` ${client.ville}`}
                    </span>
                  </div>
                )}
                {client.source && (
                  <div className="pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      Source : {client.source}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Extracted Info */}
            <AIExtractedInfo metadata={client.metadata} type="client" />

            {client.notes && (
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Notes</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{client.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Historique récent */}
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Historique récent</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {historique.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune action enregistrée</p>
                ) : (
                  <div className="space-y-2">
                    {historique.slice(0, 5).map((action) => (
                      <div key={action.id} className="flex items-start gap-2 text-xs">
                        <Clock className="h-3 w-3 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="text-foreground">{action.description || action.action_type}</span>
                          <span className="text-muted-foreground ml-2">
                            {formatDateTime(action.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab RDV */}
          <TabsContent value="rdv" className="space-y-3 mt-4">
            <Button className="w-full bg-gradient-hero gap-2">
              <Plus className="h-4 w-4" />
              Nouveau RDV
            </Button>

            {rdvs.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="p-6 text-center">
                  <Calendar className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Aucun RDV pour ce client</p>
                </CardContent>
              </Card>
            ) : (
              rdvs.map((rdv) => (
                <Card key={rdv.id} className="shadow-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-primary">
                            {formatDateTime(rdv.date_heure)}
                          </span>
                          <StatusBadge status={rdv.status} />
                          {rdv.regies && (
                            <span 
                              className="text-xs px-2 py-0.5 rounded-full border flex items-center gap-1"
                              style={{ 
                                backgroundColor: rdv.regies.couleur ? `${rdv.regies.couleur}15` : undefined,
                                color: rdv.regies.couleur || undefined,
                                borderColor: rdv.regies.couleur ? `${rdv.regies.couleur}40` : undefined,
                              }}
                            >
                              <Building2 className="h-3 w-3" />
                              {rdv.regies.nom}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">
                          {rdv.type_projet.replace("_", " ")}
                        </p>
                        {rdv.adresse && (
                          <p className="text-xs text-muted-foreground">{rdv.adresse}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {rdv.status !== "nouveau" && (
                          <WhatsAppSendButton
                            clientName={client.nom}
                            clientPrenom={client.prenom || undefined}
                            classification={rdv.status}
                            comment={rdv.commentaire || undefined}
                            regieId={rdv.regie_id}
                            compact
                          />
                        )}
                        <RdvStatusSelector
                          rdvId={rdv.id}
                          currentStatus={rdv.status}
                          clientName={client.nom}
                          clientPrenom={client.prenom || undefined}
                          clientId={client.id}
                          regieId={rdv.regie_id}
                          rdvDate={rdv.date_heure}
                          onStatusChange={() => fetchClientData()}
                          compact
                        />
                        <RegieSelector
                          rdvId={rdv.id}
                          currentRegieId={rdv.regie_id}
                          currentRegieNom={rdv.regies?.nom}
                          currentRegieCouleur={rdv.regies?.couleur}
                          onRegieChange={() => fetchClientData()}
                        />
                      </div>
                    </div>
                    {/* AI Extracted Info for RDV */}
                    {rdv.metadata && Object.keys(rdv.metadata).length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <AIExtractedInfo metadata={rdv.metadata} type="rdv" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Tab Ventes */}
          <TabsContent value="ventes" className="space-y-3 mt-4">
            {ventes.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="p-6 text-center">
                  <Euro className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Aucune vente pour ce client</p>
                </CardContent>
              </Card>
            ) : (
              ventes.map((vente) => (
                <VenteCard
                  key={vente.id}
                  vente={vente}
                  regies={ventesRegies}
                  selectionMode={false}
                  isSelected={false}
                  onClick={() => navigate(`/ventes/${vente.id}`)}
                  onRefresh={fetchClientData}
                />
              ))
            )}
          </TabsContent>

          {/* Tab Études */}
          <TabsContent value="etudes" className="space-y-3 mt-4">
            <Button className="w-full bg-gradient-hero gap-2" onClick={() => navigate(`/etude/new?client=${id}`)}>
              <Sun className="h-4 w-4" />
              Nouvelle étude
            </Button>

            {etudes.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="p-6 text-center">
                  <Zap className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Aucune étude pour ce client</p>
                </CardContent>
              </Card>
            ) : (
              etudes.map((etude) => (
                <Card key={etude.id} className="shadow-card hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {etude.puissance_kwc && (
                            <span className="font-semibold">{etude.puissance_kwc} kWc</span>
                          )}
                          {getVerdictBadge(etude.verdict)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(etude.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {etude.prix_total && (
                          <div className="text-right">
                            <p className="font-bold text-foreground">
                              {etude.prix_total.toLocaleString("fr-FR")} €
                            </p>
                          </div>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          title="Télécharger la Pré-étude"
                          disabled={pdfDownloadLoading}
                          onClick={async (e) => {
                            e.stopPropagation();
                            await downloadOrSharePdf(etude.id, "pre-etude");
                          }}
                        >
                          {pdfDownloadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          title="Télécharger le Résultat d'étude (complet)"
                          disabled={pdfDownloadLoading}
                          onClick={async (e) => {
                            e.stopPropagation();
                            await downloadOrSharePdf(etude.id, "resultat");
                          }}
                        >
                          {pdfDownloadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => navigate(`/etude/edit?etude=${etude.id}&client=${id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={async () => {
                            if (confirm("Supprimer cette étude ?")) {
                              const { error } = await supabase
                                .from("etudes")
                                .delete()
                                .eq("id", etude.id);
                              if (!error) {
                                toast({ title: "Étude supprimée" });
                                fetchClientData();
                              } else {
                                toast({ title: "Erreur", variant: "destructive" });
                              }
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Tab Documents et Photos - only render content when active to avoid freezing */}
          <TabsContent value="docs" className="space-y-3 mt-4" forceMount={undefined}>
            {activeTab === "docs" && (
              <Suspense fallback={<LazyFallback />}>
                {/* Recherche dans les documents */}
                <DocumentSearch 
                  clientId={id}
                  onSelectDocument={(doc) => window.open(doc.url, "_blank")}
                />

                <div className="flex gap-2">
                  <Button 
                    className="flex-1 gap-2 h-12 bg-gradient-hero"
                    onClick={() => setShowMultiImport(true)}
                  >
                    <Plus className="h-5 w-5" />
                    Importer
                  </Button>
                  <Button 
                    variant="outline"
                    className="gap-2 h-12 border-primary text-primary"
                    onClick={() => setShowLiveScanner(true)}
                  >
                    <Image className="h-5 w-5" />
                    Scanner
                  </Button>
                  <Button 
                    variant="outline"
                    className="flex-1 gap-2 h-12 border-primary text-primary"
                    onClick={async () => {
                      const lastRdv = rdvs.find(r => r.regie_id);
                      if (lastRdv?.regie_id) {
                        const { data: regieContact } = await supabase
                          .from("regies_contacts")
                          .select("telephone, nom")
                          .eq("regie_id", lastRdv.regie_id)
                          .eq("is_principal", true)
                          .eq("actif", true)
                          .maybeSingle();
                        
                        if (regieContact?.telephone) {
                          await sendPdfDoc({
                            clientId: id!,
                            phoneNumber: regieContact.telephone,
                            message: `📄 Dossier complet pour ${client?.prenom || ""} ${client?.nom || ""}`.trim(),
                            includeEtude: true,
                          });
                          return;
                        }
                      }
                      if (client?.telephone) {
                        const cleanPhone = client.telephone.replace(/\D/g, "");
                        const frPhone = cleanPhone.startsWith("0") ? `33${cleanPhone.slice(1)}` : cleanPhone;
                        await sendPdfDoc({
                          clientId: id!,
                          phoneNumber: frPhone,
                          message: `📄 Votre dossier complet`,
                          includeEtude: true,
                        });
                      } else {
                        toast({
                          variant: "destructive",
                          title: "Aucun destinataire",
                          description: "Aucune régie/confirmateur trouvé et le client n'a pas de téléphone.",
                        });
                      }
                    }}
                    disabled={isSendingDoc || documents.length === 0}
                  >
                    {isSendingDoc ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                    Envoyer
                  </Button>
                </div>

                {documents.length === 0 ? (
                  <Card className="shadow-card">
                    <CardContent className="p-6 text-center">
                      <Image className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Aucun document ou photo</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ajoutez des photos du site, documents techniques, etc.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <MultiDocumentSelector 
                    documents={documents.map(doc => ({
                      ...doc,
                      thumbnails_urls: (doc as any).thumbnails_urls || null,
                    }))}
                    clientName={`${client?.prenom || ""} ${client?.nom || ""}`}
                    clientAddress={[client?.adresse, client?.code_postal, client?.ville].filter(Boolean).join(", ")}
                    clientId={id}
                    etudeId={etudes.length > 0 ? etudes[0].id : undefined}
                    onDocumentsChange={fetchClientData}
                  />
                )}
              </Suspense>
            )}
          </TabsContent>
        </Tabs>

        {/* Multi Import Flow - lazy loaded */}
        {showMultiImport && (
          <Suspense fallback={<LazyFallback />}>
            <MultiImportFlow
              isOpen={showMultiImport}
              context="client_docs"
              clientId={id}
              onSuccess={() => {
                setShowMultiImport(false);
                fetchClientData();
              }}
              onClose={() => setShowMultiImport(false)}
            />
          </Suspense>
        )}

        {/* Live Scanner Flow */}
        {showLiveScanner && (
          <Suspense fallback={<LazyFallback />}>
            <AddDocumentFlow
              isOpen={showLiveScanner}
              context="client_docs"
              relatedClientId={id}
              onSuccess={() => {
                setShowLiveScanner(false);
                fetchClientData();
              }}
              onCancel={() => setShowLiveScanner(false)}
            />
          </Suspense>
        )}

        {showEditDialog && (
          <EditClientDialog
            client={client}
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
            onSuccess={fetchClientData}
          />
        )}

        {/* Retape Dialog - only mount when open */}
        {showRetapeDialog && client && (
          <Suspense fallback={null}>
            <RetapeDialog
              open={showRetapeDialog}
              onOpenChange={setShowRetapeDialog}
              clientId={client.id}
              clientName={client.prenom ? `${client.prenom} ${client.nom}` : client.nom}
              onSuccess={fetchClientData}
            />
          </Suspense>
        )}

        {/* Delete Confirmation - only mount when open */}
        {isDeleteDialogOpen && (
          <DeleteConfirmDialog
            open={isDeleteDialogOpen}
            onOpenChange={cancelDelete}
            onConfirm={confirmDelete}
            title="Supprimer ce client ?"
            description="Cette action est irréversible. Toutes les données associées (RDV, études, documents) seront également supprimées."
            isLoading={isDeleting}
          />
        )}
      </div>
    </MobileLayout>
  );
};

// Wrap with ErrorBoundary
const ClientDetail = () => (
  <ClientDetailErrorBoundary>
    <ClientDetailInner />
  </ClientDetailErrorBoundary>
);

export default ClientDetail;
