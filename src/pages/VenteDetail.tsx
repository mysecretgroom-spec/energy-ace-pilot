import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FloatingSaveButton } from "@/components/ui/floating-save-button";
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
  Loader2,
  ExternalLink,
  Trash2,
  Download,
} from "lucide-react";
import { Building2 } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useWhatsAppNotification } from "@/hooks/useWhatsAppNotification";
import { WhatsAppConfirmDialog } from "@/components/notifications/WhatsAppConfirmDialog";
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog";
import { useDeleteEntity } from "@/hooks/useDeleteEntity";
import { RegieSelector } from "@/components/planning/RegieSelector";
import { VenteStatusTimeline } from "@/components/crm/VenteStatusTimeline";

type VenteStatus = Database["public"]["Enums"]["vente_status"];

// Map vente status to WhatsApp classification
const venteStatusToClassification: Record<VenteStatus, string | null> = {
  en_negociation: null, // Pas de notification
  signe: "positif",
  cq_a_faire: null,
  cq_fait: null,
  attente_financement: null,
  envoi_pose: null,
  en_installation: null,
  installe: "installe", // Installation terminée - template spécifique
  attente_paiement: null,
  paye: "paye", // Paiement reçu - template spécifique
  annule: "annule",
  refus_financement: "annule",
};

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
  refus_financement: "Refus financement",
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
  refus_financement: "bg-red-500/10 text-red-600 border-red-200",
};

const VenteDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sendWhatsAppNotification } = useWhatsAppNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vente, setVente] = useState<Vente | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [previousStatus, setPreviousStatus] = useState<VenteStatus>("en_negociation");
  const [regieId, setRegieId] = useState<string | null>(null);
  const [regieNom, setRegieNom] = useState<string | null>(null);
  const [regieCouleur, setRegieCouleur] = useState<string | null>(null);
  // WhatsApp dialog state
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [pendingWhatsApp, setPendingWhatsApp] = useState<{
    classification: string;
  } | null>(null);
  const [skipWhatsAppPrompt, setSkipWhatsAppPrompt] = useState(false);
  
  // Delete functionality
  const {
    isDeleteDialogOpen,
    isDeleting,
    openDeleteDialog,
    confirmDelete,
    cancelDelete,
  } = useDeleteEntity({
    tableName: "ventes",
    entityName: "Vente",
    onSuccess: () => navigate(-1),
  });
  
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
  const [puissanceKwc, setPuissanceKwc] = useState<number | "">("");
  const [typeInstallation, setTypeInstallation] = useState("");
  
  // Auto-calculate panels: 2 per kWc, 1 for 0.5 kWc
  const nombrePanneaux = useMemo(() => {
    if (puissanceKwc === "" || puissanceKwc === 0) return 0;
    const kwc = Number(puissanceKwc);
    // 2 panels per kWc, 1 panel for 0.5 kWc
    return Math.round(kwc * 2);
  }, [puissanceKwc]);
  
  // Original values for dirty state detection
  const [originalValues, setOriginalValues] = useState({
    numeroContrat: "",
    status: "en_negociation" as VenteStatus,
    dateSignature: "",
    dateInstallationReelle: "",
    montantHt: "" as number | "",
    montantTtc: "" as number | "",
    montantAcompte: "" as number | "",
    montantSolde: "" as number | "",
    notes: "",
    puissanceKwc: "" as number | "",
    typeInstallation: "",
  });

  // Check if form has changes
  const hasChanges = useMemo(() => {
    return (
      numeroContrat !== originalValues.numeroContrat ||
      status !== originalValues.status ||
      dateSignature !== originalValues.dateSignature ||
      dateInstallationReelle !== originalValues.dateInstallationReelle ||
      montantHt !== originalValues.montantHt ||
      montantTtc !== originalValues.montantTtc ||
      montantAcompte !== originalValues.montantAcompte ||
      montantSolde !== originalValues.montantSolde ||
      notes !== originalValues.notes ||
      puissanceKwc !== originalValues.puissanceKwc ||
      typeInstallation !== originalValues.typeInstallation
    );
  }, [
    numeroContrat, status, dateSignature, dateInstallationReelle,
    montantHt, montantTtc, montantAcompte, montantSolde, notes,
    puissanceKwc, typeInstallation,
    originalValues
  ]);

  useEffect(() => {
    if (id) {
      loadVente();
    }
  }, [id]);

  // Load WhatsApp settings
  useEffect(() => {
    const loadWhatsAppSettings = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from("settings_notifications")
        .select("skip_whatsapp_prompt, whatsapp_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data) {
        setSkipWhatsAppPrompt(data.skip_whatsapp_prompt || !data.whatsapp_enabled);
      }
    };
    
    loadWhatsAppSettings();
  }, [user]);

  // Auto-set installation date when status changes to "installe"
  const handleStatusChange = (newStatus: VenteStatus) => {
    setStatus(newStatus);
    
    // If changing to "installe" and no installation date set, set it to today
    if (newStatus === "installe" && !dateInstallationReelle) {
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
      navigate(-1);
      return;
    }

    setVente(venteData);
    setRegieId(venteData.regie_id || null);

    // Fetch regie info
    if (venteData.regie_id) {
      const { data: regieData } = await supabase
        .from("regies")
        .select("id, nom, couleur")
        .eq("id", venteData.regie_id)
        .maybeSingle();
      if (regieData) {
        setRegieNom(regieData.nom);
        setRegieCouleur(regieData.couleur);
      }
    } else {
      setRegieNom(null);
      setRegieCouleur(null);
    }

    const newNumeroContrat = venteData.numero_contrat || "";
    const newStatus = venteData.status || "en_negociation";
    const newDateInstallationReelle = venteData.date_installation_reelle || "";
    const newMontantHt = venteData.montant_ht || "";
    const newMontantTtc = venteData.montant_ttc || "";
    const newMontantAcompte = venteData.montant_acompte || "";
    const newMontantSolde = venteData.montant_solde || "";
    const newNotes = venteData.notes || "";
    const newPuissanceKwc = venteData.puissance_kwc || "";
    const newTypeInstallation = venteData.type_installation || "";
    
    setNumeroContrat(newNumeroContrat);
    setStatus(newStatus);
    setPreviousStatus(newStatus);
    setDateInstallationReelle(newDateInstallationReelle);
    setMontantHt(newMontantHt);
    setMontantTtc(newMontantTtc);
    setMontantAcompte(newMontantAcompte);
    setMontantSolde(newMontantSolde);
    setNotes(newNotes);
    setPuissanceKwc(newPuissanceKwc);
    setTypeInstallation(newTypeInstallation);

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
    let finalDateSignature = venteData.date_signature || "";
    if (!venteData.date_signature) {
      finalDateSignature = await calculateSignatureDate(venteData);
    }
    setDateSignature(finalDateSignature);
    
    // Store original values for dirty state detection
    setOriginalValues({
      numeroContrat: newNumeroContrat,
      status: newStatus,
      dateSignature: finalDateSignature,
      dateInstallationReelle: newDateInstallationReelle,
      montantHt: newMontantHt,
      montantTtc: newMontantTtc,
      montantAcompte: newMontantAcompte,
      montantSolde: newMontantSolde,
      notes: newNotes,
      puissanceKwc: newPuissanceKwc,
      typeInstallation: newTypeInstallation,
    });

    setLoading(false);
  };

  const calculateSignatureDate = async (venteData: Vente): Promise<string> => {
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
              return r2Entry.date.split("T")[0];
            }
          }
          
          // No R2 found, use original RDV date
          if (rdv.date_heure) {
            return rdv.date_heure.split("T")[0];
          }
        }
      }
    }
    
    // Fallback: use vente creation date
    if (venteData.created_at) {
      return venteData.created_at.split("T")[0];
    }
    
    return "";
  };

  const handleSave = async () => {
    if (!id) return;

    const statusChanged = status !== previousStatus;
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
        puissance_kwc: puissanceKwc || null,
        nombre_panneaux: nombrePanneaux || null,
        type_installation: typeInstallation || null,
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
    
    // Update original values to reset dirty state
    setOriginalValues({
      numeroContrat,
      status,
      dateSignature,
      dateInstallationReelle,
      montantHt,
      montantTtc,
      montantAcompte,
      montantSolde,
      notes,
      puissanceKwc,
      typeInstallation,
    });

    // Show WhatsApp dialog if status changed and has a classification
    if (statusChanged && !skipWhatsAppPrompt) {
      const classification = venteStatusToClassification[status];
      if (classification) {
        setPendingWhatsApp({ classification });
        setShowWhatsAppDialog(true);
      }
    }
  };

  const handleWhatsAppConfirm = async () => {
    if (!pendingWhatsApp || !user || !client) return;
    
    await sendWhatsAppNotification({
      clientName: client.nom,
      clientPrenom: client.prenom || undefined,
      classification: pendingWhatsApp.classification,
      userId: user.id,
      regieId: regieId,
    });
    
    setPendingWhatsApp(null);
  };

  const handleWhatsAppCancel = () => {
    setPendingWhatsApp(null);
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
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">
                {client ? `${client.prenom || ""} ${client.nom}`.trim() : "Client inconnu"}
              </h2>
              {regieNom && (
                <span 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: regieCouleur || '#888' }}
                >
                  <Building2 className="h-3 w-3" />
                  {regieNom}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Créée le {format(new Date(vente.created_at), "dd MMMM yyyy", { locale: fr })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RegieSelector
              entityId={id!}
              targetTable="ventes"
              currentRegieId={regieId}
              currentRegieNom={regieNom}
              currentRegieCouleur={regieCouleur}
              onRegieChange={(newRegieId, newRegieNom, newRegieCouleur) => {
                setRegieId(newRegieId);
                setRegieNom(newRegieNom);
                setRegieCouleur(newRegieCouleur);
              }}
            />
            <Badge className={statusColors[status]}>
              {statusLabels[status]}
            </Badge>
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

        {/* Technical info (editable) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Installation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="puissanceKwc">Puissance (kWc)</Label>
                <Input
                  id="puissanceKwc"
                  type="number"
                  step="0.5"
                  value={puissanceKwc}
                  onChange={(e) => setPuissanceKwc(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Panneaux</Label>
                <div className="h-10 flex items-center px-3 rounded-md border bg-muted/50">
                  <span className="font-medium">{nombrePanneaux || "-"}</span>
                  <span className="text-xs text-muted-foreground ml-2">(2/kWc)</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="typeInstallation">Type d'installation</Label>
              <Select value={typeInstallation} onValueChange={setTypeInstallation}>
                <SelectTrigger id="typeInstallation">
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="surimposition">Surimposition</SelectItem>
                  <SelectItem value="integration">Intégration</SelectItem>
                  <SelectItem value="sol">Au sol</SelectItem>
                  <SelectItem value="carport">Carport</SelectItem>
                  <SelectItem value="facade">Façade</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                <SelectItem value="refus_financement">Refus financement</SelectItem>
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

        {/* Status History Timeline */}
        <VenteStatusTimeline venteId={id!} />

        {/* Étude link */}
        {vente.etude_id && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate(`/etude/edit?etude=${vente.etude_id}&client=${vente.client_id}`)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Voir l'étude
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Télécharger le PDF de l'étude"
              onClick={async () => {
                const { data: etude } = await supabase
                  .from("etudes")
                  .select("pdf_url, product_type, puissance_kwc")
                  .eq("id", vente.etude_id!)
                  .maybeSingle();
                if (!etude?.pdf_url) {
                  toast.error("Aucun PDF disponible. Ouvrez l'étude pour le générer.");
                  return;
                }
                const { data } = await supabase.storage
                  .from("etudes-pdf")
                  .createSignedUrl(etude.pdf_url, 60 * 60);
                if (data?.signedUrl) {
                  const a = document.createElement("a");
                  a.href = data.signedUrl;
                  a.download = `Etude_${etude.product_type || "PV"}_${etude.puissance_kwc || ""}kWc.pdf`;
                  a.click();
                } else {
                  toast.error("Erreur de téléchargement");
                }
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Floating save button - only appears when changes detected */}
      <FloatingSaveButton
        show={hasChanges}
        saving={saving}
        onSave={handleSave}
      />

      {/* WhatsApp Confirm Dialog */}
      <WhatsAppConfirmDialog
        open={showWhatsAppDialog}
        onOpenChange={setShowWhatsAppDialog}
        onConfirm={handleWhatsAppConfirm}
        onCancel={handleWhatsAppCancel}
        clientName={[client?.prenom, client?.nom].filter(Boolean).join(" ")}
        classification={pendingWhatsApp?.classification || "positif"}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={cancelDelete}
        onConfirm={confirmDelete}
        title="Supprimer cette vente ?"
        description="Cette action est irréversible. La vente sera définitivement supprimée."
        isLoading={isDeleting}
      />
    </MobileLayout>
  );
};

export default VenteDetail;
