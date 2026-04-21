import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTauxTVAByPuissance, ttcToHT } from "@/lib/tva";
import { findOrInterpolateBouquet } from "@/lib/bouquetInterpolation";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  Mail,
  Phone,
  MessageSquare,
  Euro,
  ChevronRight,
  Trash2,
  Star,
  Palette,
  Edit,
  Check,
  Loader2,
  TrendingUp,
  Calendar,
  Target,
  BarChart3,
  ArrowRight,
  ExternalLink,
  Sparkles,
  CreditCard,
  Wrench,
  Pencil,
  X,
} from "lucide-react";
import { BouquetExtractor } from "@/components/regie/BouquetExtractor";
import { RegieAIConfigImport } from "@/components/regie/RegieAIConfigImport";
import { CreateRegieDialog } from "@/components/regie/CreateRegieDialog";
import { EditRegieDialog } from "@/components/regie/EditRegieDialog";
import { ProductBouquetsSection } from "@/components/regie/ProductBouquetsSection";
import { ProductSurcoutsSection } from "@/components/regie/ProductSurcoutsSection";
import { SiretSearchField } from "@/components/regie/SiretSearchField";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHejjaMode } from "@/hooks/useHejjaMode";
import { toast } from "sonner";

interface Regie {
  id: string;
  nom: string;
  couleur: string;
  logo_url: string | null;
  actif: boolean;
  created_at: string;
  mode_calcul_commission: string;
  part_survente_pct: number;
  is_hejja: boolean;
  siret: string | null;
}

interface RegieEmail {
  id: string;
  regie_id: string;
  email: string;
  nom_source: string | null;
  actif: boolean;
}

interface RegieContact {
  id: string;
  regie_id: string;
  nom: string;
  telephone: string;
  is_principal: boolean;
  actif: boolean;
}

interface RegieBouquet {
  id: string;
  regie_id: string;
  nom_bouquet: string;
  puissance_kwc: number;
  prix_recommande: number;
  commission_fixe: number;
  commission_pct: number;
  description: string | null;
  actif: boolean;
}

interface RegieFinancement {
  id: string;
  regie_id: string;
  nom: string;
  taux_effectif: number;
  taeg: number;
  actif: boolean;
}

interface RegieSurcout {
  id: string;
  regie_id: string | null;
  categorie: 'support' | 'emplacement_boitier' | 'compteur';
  code: string;
  nom: string;
  prix: number;
  type_calcul: 'fixe' | 'par_panneau';
  actif: boolean;
  isGlobal?: boolean; // For display purposes
}

interface RegieStats {
  rdv: number;
  ventes: number;
  rdvMois: number;
  ventesMois: number;
  // Commissions par catégorie
  commEnAttente: number; // Signé, en financement, CQ
  commAVenir: number;    // Envoi pose, en installation
  commDuSur: number;     // Installé, attente paiement
  commPayees: number;    // Payé
}

const colorOptions = [
  "#0066CC", "#00A86B", "#FF6B35", "#9B59B6", "#E74C3C", "#3498DB", "#F39C12", "#1ABC9C"
];

const RegiesSettings = () => {
  const { user } = useAuth();
  const { isActive: modeHejjaActive } = useHejjaMode();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regies, setRegies] = useState<Regie[]>([]);
  const [regieStats, setRegieStats] = useState<Record<string, RegieStats>>({});
  const [selectedRegie, setSelectedRegie] = useState<Regie | null>(null);
  const [regieEmails, setRegieEmails] = useState<RegieEmail[]>([]);
  const [regieContacts, setRegieContacts] = useState<RegieContact[]>([]);
  const [regieBouquets, setRegieBouquets] = useState<RegieBouquet[]>([]);
  const [regieFinancements, setRegieFinancements] = useState<RegieFinancement[]>([]);
  const [regieSurcouts, setRegieSurcouts] = useState<RegieSurcout[]>([]);
  
  // Create/Edit dialogs
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingHejja, setIsCreatingHejja] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit forms
  const [newEmail, setNewEmail] = useState({ email: "", nom_source: "" });
  const [newContact, setNewContact] = useState({ nom: "", telephone: "" });
  const [newBouquet, setNewBouquet] = useState({
    nom_bouquet: "",
    puissance_kwc: 3,
    prix_recommande: 0,
    commission_fixe: 0,
  });
  const [newFinancement, setNewFinancement] = useState({
    nom: "",
    taux_effectif: 0,
    taeg: 0,
  });
  const [newSurcout, setNewSurcout] = useState({
    categorie: 'support' as 'support' | 'emplacement_boitier' | 'compteur',
    code: "",
    nom: "",
    prix: 0,
    type_calcul: 'fixe' as 'fixe' | 'par_panneau',
  });

  useEffect(() => {
    if (user) {
      fetchRegies();
    }
  }, [user]);

  useEffect(() => {
    if (selectedRegie) {
      fetchRegieDetails(selectedRegie.id);
    }
  }, [selectedRegie?.id]);

  const fetchRegies = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("regies")
        .select("*")
        .eq("user_id", user.id)
        .order("nom");

      if (error) throw error;
      setRegies(data || []);

      // Fetch stats for each regie using DYNAMIC commission calculation
      const statsMap: Record<string, RegieStats> = {};
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      // Get all regie IDs
      const regieIds = (data || []).map(r => r.id);
      
      // Fetch all data needed for commission calculation
      const [allRdv, allVentes, allBouquets, allEtudes, globalConfig] = await Promise.all([
        supabase.from("rdv").select("id, regie_id, date_heure"),
        supabase.from("ventes").select("id, regie_id, status, montant_ht, montant_ttc, puissance_kwc, decom_montant, type_vente, etude_id, date_signature"),
        supabase.from("bouquets").select("id, puissance_kwc, prix_recommande, commission_fixe, regie_ids, actif").eq("actif", true),
        supabase.from("etudes").select("id, surcout_support, surcout_compteur, autre_surcout"),
        supabase.from("config_commissions").select("part_survente_pct").maybeSingle(),
      ]);
      
      const rdvData = allRdv.data || [];
      const ventesData = allVentes.data || [];
      const bouquetsData = allBouquets.data || [];
      const etudesData = allEtudes.data || [];
      const globalSurventePct = globalConfig.data?.part_survente_pct || 50;
      
      // Create maps for quick lookup
      const etudeSurcoutsMap = new Map(etudesData.map(e => [e.id, e]));
      
      // Group bouquets by regie (use regie_ids array)
      const bouquetsByRegie = new Map<string, any[]>();
      for (const b of bouquetsData) {
        if (b.regie_ids && b.regie_ids.length > 0) {
          for (const regieId of b.regie_ids) {
            const existing = bouquetsByRegie.get(regieId) || [];
            existing.push({
              ...b,
              puissance_kwc: Number(b.puissance_kwc),
              prix_recommande: Number(b.prix_recommande),
              commission_fixe: b.commission_fixe ? Number(b.commission_fixe) : null,
            });
            bouquetsByRegie.set(regieId, existing);
          }
        }
      }
      
      // Calculate stats for each regie
      for (const regie of data || []) {
        const regieRdv = rdvData.filter(r => r.regie_id === regie.id);
        const regieRdvMois = regieRdv.filter(r => r.date_heure >= startOfMonth);
        const regieVentes = ventesData.filter(v => v.regie_id === regie.id);
        const regieVentesMois = regieVentes.filter(v => v.date_signature && v.date_signature >= startOfMonth.split("T")[0]);
        
        // Get bouquets for this regie
        const regieBouquets = bouquetsByRegie.get(regie.id) || [];
        const partSurventePct = regie.part_survente_pct ?? globalSurventePct;
        
        // Calculate commissions dynamically
        let commEnAttente = 0;
        let commAVenir = 0;
        let commDuSur = 0;
        let commPayees = 0;
        
        for (const vente of regieVentes) {
          // Skip cancelled sales
          if (vente.status === 'annule') continue;
          
          let commissionNette = 0;
          
          // External installation: commission = montant HT
          if (vente.type_vente === 'external_installation') {
            const decomMontant = Number(vente.decom_montant) || 0;
            commissionNette = Math.max(0, Number(vente.montant_ht) - decomMontant);
          } else if (vente.puissance_kwc && regieBouquets.length > 0) {
            // Standard calculation using bouquet interpolation
            const puissanceKwc = Number(vente.puissance_kwc);
            const interpolated = findOrInterpolateBouquet(regieBouquets, puissanceKwc);
            const commissionFixe = interpolated.commissionFixe;
            const prixRecommande = interpolated.prixRecommande;
            
            // Calculate survente bonus
            const etudeSurcouts = vente.etude_id ? etudeSurcoutsMap.get(vente.etude_id) : null;
            const totalSurcouts = etudeSurcouts 
              ? (Number(etudeSurcouts.surcout_support) || 0) + 
                (Number(etudeSurcouts.surcout_compteur) || 0) + 
                (Number(etudeSurcouts.autre_surcout) || 0)
              : 0;
            
            const tauxTVA = getTauxTVAByPuissance(puissanceKwc);
            const montantTTC = vente.montant_ttc || (vente.montant_ht * (1 + tauxTVA / 100));
            const montantTTCSansSurcouts = montantTTC - totalSurcouts;
            
            let bonusSurvente = 0;
            if (prixRecommande > 0 && montantTTCSansSurcouts > prixRecommande) {
              const surventeTTC = montantTTCSansSurcouts - prixRecommande;
              const surventeHT = ttcToHT(surventeTTC, tauxTVA);
              bonusSurvente = surventeHT * (partSurventePct / 100);
            }
            
            const decomMontant = Number(vente.decom_montant) || 0;
            commissionNette = Math.max(0, commissionFixe + bonusSurvente - decomMontant);
          }
          
          // Categorize by status
          if (["signe", "attente_financement", "cq_a_faire", "cq_fait"].includes(vente.status)) {
            commEnAttente += commissionNette;
          } else if (["envoi_pose", "en_installation"].includes(vente.status)) {
            commAVenir += commissionNette;
          } else if (["installe", "attente_paiement"].includes(vente.status)) {
            commDuSur += commissionNette;
          } else if (vente.status === "paye") {
            commPayees += commissionNette;
          }
        }
        
        statsMap[regie.id] = {
          rdv: regieRdv.length,
          ventes: regieVentes.filter(v => v.status !== 'annule').length,
          rdvMois: regieRdvMois.length,
          ventesMois: regieVentesMois.length,
          commEnAttente,
          commAVenir,
          commDuSur,
          commPayees,
        };
      }
      setRegieStats(statsMap);
    } catch (error) {
      console.error("Error fetching regies:", error);
      toast.error("Erreur lors du chargement des régies");
    } finally {
      setLoading(false);
    }
  };

  const fetchRegieDetails = async (regieId: string) => {
    try {
      const [emailsRes, contactsRes, regieBouquetsRes, financementsRes, regieSurcoutsRes] = await Promise.all([
        supabase.from("emails_autorises").select("*").eq("regie_id", regieId),
        supabase.from("regies_contacts").select("*").eq("regie_id", regieId).order("is_principal", { ascending: false }),
        supabase.from("bouquets").select("*").contains("regie_ids", [regieId]).order("puissance_kwc"),
        supabase.from("regies_financements").select("*").eq("regie_id", regieId).order("duree_mois"),
        supabase.from("regies_surcouts").select("*").eq("regie_id", regieId).order("categorie"),
      ]);

      setRegieEmails((emailsRes.data || []) as RegieEmail[]);
      setRegieContacts(contactsRes.data || []);
      
      // Only show regie-specific bouquets (no global pre-configured bouquets)
      const regieBouquetsData = (regieBouquetsRes.data || []).map((b: any) => ({
        ...b,
        regie_id: regieId,
        isGlobal: false,
      }));
      
      setRegieBouquets(regieBouquetsData);
      setRegieFinancements(financementsRes.data || []);
      
      // Only use regie-specific surcouts (no global merge)
      setRegieSurcouts((regieSurcoutsRes.data || []) as RegieSurcout[]);
    } catch (error) {
      console.error("Error fetching regie details:", error);
    }
  };

  const handleDeleteRegie = async (regieId: string) => {
    if (!confirm("Supprimer cette régie ? Les emails, contacts et bouquets associés seront également supprimés.")) {
      return;
    }

    try {
      const { error } = await supabase.from("regies").delete().eq("id", regieId);
      if (error) throw error;
      
      toast.success("Régie supprimée");
      setSelectedRegie(null);
      fetchRegies();
    } catch (error) {
      console.error("Error deleting regie:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleUpdateRegieColor = async (color: string) => {
    if (!selectedRegie) return;
    
    try {
      const { error } = await supabase
        .from("regies")
        .update({ couleur: color })
        .eq("id", selectedRegie.id);

      if (error) throw error;
      
      setSelectedRegie({ ...selectedRegie, couleur: color });
      setRegies(regies.map(r => r.id === selectedRegie.id ? { ...r, couleur: color } : r));
      toast.success("Couleur mise à jour");
    } catch (error) {
      console.error("Error updating color:", error);
    }
  };

  const handleUpdateCommissionMode = async (mode: 'pourcentage' | 'bouquet') => {
    if (!selectedRegie) return;
    
    try {
      const { error } = await supabase
        .from("regies")
        .update({ mode_calcul_commission: mode })
        .eq("id", selectedRegie.id);

      if (error) throw error;
      
      setSelectedRegie({ ...selectedRegie, mode_calcul_commission: mode });
      setRegies(regies.map(r => r.id === selectedRegie.id ? { ...r, mode_calcul_commission: mode } : r));
      toast.success(`Mode ${mode === 'bouquet' ? 'Bouquet + Survente' : 'Pourcentage'} activé`);
    } catch (error) {
      console.error("Error updating commission mode:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleUpdateSurventePct = async (pct: number) => {
    if (!selectedRegie) return;
    const clampedPct = Math.min(100, Math.max(0, pct));
    
    try {
      const { error } = await supabase
        .from("regies")
        .update({ part_survente_pct: clampedPct })
        .eq("id", selectedRegie.id);

      if (error) throw error;
      
      setSelectedRegie({ ...selectedRegie, part_survente_pct: clampedPct });
      setRegies(regies.map(r => r.id === selectedRegie.id ? { ...r, part_survente_pct: clampedPct } : r));
    } catch (error) {
      console.error("Error updating survente pct:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleUpdateSiret = async (siret: string) => {
    if (!selectedRegie) return;
    
    try {
      const { error } = await supabase
        .from("regies")
        .update({ siret: siret || null })
        .eq("id", selectedRegie.id);

      if (error) throw error;
      
      setSelectedRegie({ ...selectedRegie, siret });
      setRegies(regies.map(r => r.id === selectedRegie.id ? { ...r, siret } : r));
      // Silent save
    } catch (error) {
      console.error("Error updating SIRET:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleAddEmail = async () => {
    if (!selectedRegie || !user || !newEmail.email.trim()) return;
    
    try {
      const { error } = await supabase
        .from("emails_autorises")
        .insert({
          user_id: user.id,
          regie_id: selectedRegie.id,
          email: newEmail.email.trim().toLowerCase(),
          nom_source: newEmail.nom_source.trim() || null,
          actif: true,
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("Cet email existe déjà");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Email ajouté");
      setNewEmail({ email: "", nom_source: "" });
      fetchRegieDetails(selectedRegie.id);
    } catch (error) {
      console.error("Error adding email:", error);
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleDeleteEmail = async (emailId: string) => {
    try {
      const { error } = await supabase.from("emails_autorises").delete().eq("id", emailId);
      if (error) throw error;
      setRegieEmails(regieEmails.filter(e => e.id !== emailId));
      toast.success("Email supprimé");
    } catch (error) {
      console.error("Error deleting email:", error);
    }
  };

  const handleToggleEmailActif = async (email: RegieEmail) => {
    try {
      const { error } = await supabase
        .from("emails_autorises")
        .update({ actif: !email.actif })
        .eq("id", email.id);

      if (error) throw error;
      setRegieEmails(regieEmails.map(e => e.id === email.id ? { ...e, actif: !e.actif } : e));
    } catch (error) {
      console.error("Error toggling email:", error);
    }
  };

  // Contact handlers
  const handleAddContact = async () => {
    if (!selectedRegie || !user || !newContact.nom.trim() || !newContact.telephone.trim()) return;
    
    try {
      // If this is the first contact, make it principal
      const isPrincipal = regieContacts.length === 0;

      const { error } = await supabase
        .from("regies_contacts")
        .insert({
          user_id: user.id,
          regie_id: selectedRegie.id,
          nom: newContact.nom.trim(),
          telephone: newContact.telephone.trim(),
          is_principal: isPrincipal,
          actif: true,
        });

      if (error) throw error;

      toast.success("Contact ajouté");
      setNewContact({ nom: "", telephone: "" });
      fetchRegieDetails(selectedRegie.id);
    } catch (error) {
      console.error("Error adding contact:", error);
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleSetPrincipal = async (contactId: string) => {
    if (!selectedRegie) return;
    
    try {
      // First, unset all principals for this regie
      await supabase
        .from("regies_contacts")
        .update({ is_principal: false })
        .eq("regie_id", selectedRegie.id);

      // Then set the new principal
      await supabase
        .from("regies_contacts")
        .update({ is_principal: true })
        .eq("id", contactId);

      // Silent save
      fetchRegieDetails(selectedRegie.id);
    } catch (error) {
      console.error("Error setting principal:", error);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      const { error } = await supabase.from("regies_contacts").delete().eq("id", contactId);
      if (error) throw error;
      setRegieContacts(regieContacts.filter(c => c.id !== contactId));
      toast.success("Contact supprimé");
    } catch (error) {
      console.error("Error deleting contact:", error);
    }
  };

  // Bouquet handlers
  const handleAddBouquet = async () => {
    if (!selectedRegie || !user || !newBouquet.nom_bouquet.trim()) return;
    
    try {
      const { error } = await supabase
        .from("bouquets")
        .insert({
          user_id: user.id,
          regie_ids: [selectedRegie.id],
          nom_bouquet: newBouquet.nom_bouquet.trim(),
          puissance_kwc: newBouquet.puissance_kwc,
          prix_recommande: newBouquet.prix_recommande,
          prix_max: newBouquet.prix_recommande,
          commission_fixe: newBouquet.commission_fixe,
          actif: true,
        });

      if (error) throw error;

      toast.success("Bouquet ajouté");
      setNewBouquet({
        nom_bouquet: "",
        puissance_kwc: 3,
        prix_recommande: 0,
        commission_fixe: 0,
      });
      fetchRegieDetails(selectedRegie.id);
    } catch (error) {
      console.error("Error adding bouquet:", error);
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleDeleteBouquet = async (bouquetId: string) => {
    try {
      const { error } = await supabase.from("bouquets").delete().eq("id", bouquetId);
      if (error) throw error;
      setRegieBouquets(regieBouquets.filter(b => b.id !== bouquetId));
      toast.success("Bouquet supprimé");
    } catch (error) {
      console.error("Error deleting bouquet:", error);
    }
  };

  // Financement handlers
  const handleAddFinancement = async () => {
    if (!selectedRegie || !user || !newFinancement.nom.trim()) return;
    
    try {
      const { error } = await supabase
        .from("regies_financements")
        .insert({
          user_id: user.id,
          regie_id: selectedRegie.id,
          ...newFinancement,
          nom: newFinancement.nom.trim(),
          actif: true,
        });

      if (error) throw error;

      toast.success("Financement ajouté");
      setNewFinancement({
        nom: "",
        taux_effectif: 0,
        taeg: 0,
      });
      fetchRegieDetails(selectedRegie.id);
    } catch (error) {
      console.error("Error adding financement:", error);
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleDeleteFinancement = async (financementId: string) => {
    try {
      const { error } = await supabase.from("regies_financements").delete().eq("id", financementId);
      if (error) throw error;
      setRegieFinancements(regieFinancements.filter(f => f.id !== financementId));
      toast.success("Financement supprimé");
    } catch (error) {
      console.error("Error deleting financement:", error);
    }
  };

  const handleToggleFinancementActif = async (financement: RegieFinancement) => {
    try {
      const { error } = await supabase
        .from("regies_financements")
        .update({ actif: !financement.actif })
        .eq("id", financement.id);
      if (error) throw error;
      setRegieFinancements(regieFinancements.map(f => 
        f.id === financement.id ? { ...f, actif: !f.actif } : f
      ));
    } catch (error) {
      console.error("Error toggling financement:", error);
    }
  };

  // Surcout handlers
  const handleAddSurcout = async () => {
    if (!selectedRegie || !user || !newSurcout.code.trim() || !newSurcout.nom.trim()) return;
    
    try {
      const { error } = await supabase
        .from("regies_surcouts")
        .insert({
          user_id: user.id,
          regie_id: selectedRegie.id,
          categorie: newSurcout.categorie,
          code: newSurcout.code.trim(),
          nom: newSurcout.nom.trim(),
          prix: newSurcout.prix,
          type_calcul: newSurcout.type_calcul,
          actif: true,
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("Ce surcoût existe déjà pour cette catégorie");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Surcoût ajouté");
      setNewSurcout({
        categorie: 'support',
        code: "",
        nom: "",
        prix: 0,
        type_calcul: 'fixe',
      });
      fetchRegieDetails(selectedRegie.id);
    } catch (error) {
      console.error("Error adding surcout:", error);
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleDeleteSurcout = async (surcout: RegieSurcout) => {
    if (surcout.isGlobal) {
      toast.error("Impossible de supprimer un surcoût par défaut. Vous pouvez le désactiver ou créer un surcoût personnalisé.");
      return;
    }
    try {
      const { error } = await supabase.from("regies_surcouts").delete().eq("id", surcout.id);
      if (error) throw error;
      // Refresh to get global defaults back if we deleted an override
      if (selectedRegie) {
        fetchRegieDetails(selectedRegie.id);
      }
      toast.success("Surcoût supprimé");
    } catch (error) {
      console.error("Error deleting surcout:", error);
    }
  };

  const handleToggleSurcoutActif = async (surcout: RegieSurcout) => {
    if (!selectedRegie || !user) return;
    
    try {
      if (surcout.isGlobal) {
        // Create a regie-specific override with toggled state
        const { error } = await supabase
          .from("regies_surcouts")
          .insert({
            user_id: user.id,
            regie_id: selectedRegie.id,
            categorie: surcout.categorie,
            code: surcout.code,
            nom: surcout.nom,
            prix: surcout.prix,
            type_calcul: surcout.type_calcul || 'fixe',
            actif: !surcout.actif, // Toggle the state
          });
        if (error) throw error;
        // Refresh to get the new override
        fetchRegieDetails(selectedRegie.id);
      } else {
        const { error } = await supabase
          .from("regies_surcouts")
          .update({ actif: !surcout.actif })
          .eq("id", surcout.id);
        if (error) throw error;
        setRegieSurcouts(regieSurcouts.map(s => 
          s.id === surcout.id ? { ...s, actif: !s.actif } : s
        ));
      }
    } catch (error) {
      console.error("Error toggling surcout:", error);
    }
  };

  const getCategorieLabel = (categorie: string) => {
    switch (categorie) {
      case 'support': return 'Support d\'installation';
      case 'emplacement_boitier': return 'Emplacement boîtier';
      case 'compteur': return 'Type de compteur';
      default: return categorie;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <MobileLayout title="Régies" showBackButton>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Régies" showBackButton>
      <div className="p-4 pb-8 space-y-4" data-onboarding="regie-list">
        {/* Header avec bouton d'ajout */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">
              Gérez vos sources de RDV et leurs tarifs
            </p>
          </div>
          <div className="flex gap-2">
            {/* Bouton Régie HEJJA - uniquement si mode HEJJA actif */}
            {modeHejjaActive && (
              <Button 
                size="sm" 
                variant="outline"
                className="gap-2 border-red-500/50 text-red-500 hover:bg-red-500/10"
                onClick={() => setIsCreatingHejja(true)}
              >
                <Plus className="h-4 w-4" />
                HEJJA
              </Button>
            )}

            {/* Bouton Régie normale */}
            <Button size="sm" className="gap-2" onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4" />
              Nouvelle
            </Button>
          </div>

          {/* Dialog création régie normale */}
          <CreateRegieDialog
            open={isCreating}
            onOpenChange={setIsCreating}
            isHejja={false}
            existingRegies={regies}
            onSuccess={(newRegie) => {
              fetchRegies();
              setSelectedRegie(newRegie);
            }}
          />

          {/* Dialog création régie HEJJA */}
          <CreateRegieDialog
            open={isCreatingHejja}
            onOpenChange={setIsCreatingHejja}
            isHejja={true}
            existingRegies={regies}
            onSuccess={(newRegie) => {
              fetchRegies();
              setSelectedRegie(newRegie);
            }}
          />
        </div>

        {/* Liste des régies - filtrer les régies HEJJA si mode inactif */}
        {(() => {
          const filteredRegies = modeHejjaActive 
            ? regies 
            : regies.filter(r => !r.is_hejja);
          
          return filteredRegies.length === 0 ? (
            <Card className="bg-muted/50">
              <CardContent className="p-6 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Aucune régie configurée</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Créez votre première régie pour regrouper vos sources de RDV
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredRegies.map((regie) => {
                const stats = regieStats[regie.id] || { rdv: 0, ventes: 0, rdvMois: 0, ventesMois: 0, commEnAttente: 0, commAVenir: 0, commDuSur: 0, commPayees: 0 };
                return (
                <Card
                  key={regie.id}
                  className="shadow-card cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden"
                  onClick={() => setSelectedRegie(regie)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: regie.couleur + "20" }}
                      >
                        <Building2 className="h-6 w-6" style={{ color: regie.couleur }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground truncate">{regie.nom}</h3>
                          {regie.is_hejja && (
                            <Badge className="text-[10px] h-4 bg-red-500 text-white">
                              HEJJA
                            </Badge>
                          )}
                          {regie.actif ? (
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                              Actif
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Inactif</Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {stats.rdv} RDV
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {stats.ventes} ventes
                          </Badge>
                          <Badge className="text-xs bg-green-500/20 text-green-600 border-green-500/30">
                            {formatCurrency(stats.commDuSur + stats.commPayees)} acquis
                          </Badge>
                        </div>
                      </div>

                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
              })}
            </div>
          );
        })()}

        {/* Dialog détail régie */}
        <Dialog open={!!selectedRegie} onOpenChange={() => setSelectedRegie(null)}>
          <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto p-0">
            {selectedRegie && (
              <>
                {/* Header avec couleur */}
                <div
                  className="p-4 pt-10 text-white relative"
                  style={{ backgroundColor: selectedRegie.couleur }}
                >
                  {/* Actions en haut à droite, sous le bouton X du dialog */}
                  <div className="absolute top-12 right-3 flex gap-1">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-white hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-white hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/regies/${selectedRegie.id}`);
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20">
                          <Palette className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-xs">
                        <DialogHeader>
                          <DialogTitle>Changer la couleur</DialogTitle>
                        </DialogHeader>
                        <div className="flex gap-2 flex-wrap justify-center py-4">
                          {colorOptions.map((color) => (
                            <button
                              key={color}
                              className={`w-10 h-10 rounded-full border-2 transition-colors ${
                                selectedRegie.couleur === color ? "border-foreground" : "border-transparent"
                              }`}
                              style={{ backgroundColor: color }}
                              onClick={() => handleUpdateRegieColor(color)}
                            />
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-white hover:bg-red-500/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRegie(selectedRegie.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Titre et infos */}
                  <div className="flex items-center gap-3 pr-28">
                    <Building2 className="h-8 w-8 flex-shrink-0" />
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold truncate">{selectedRegie.nom}</h2>
                      <p className="text-sm opacity-80">
                        {regieStats[selectedRegie.id]?.ventes || 0} ventes • {formatCurrency((regieStats[selectedRegie.id]?.commDuSur || 0) + (regieStats[selectedRegie.id]?.commPayees || 0))} acquis
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Config Import */}
                <div className="px-4 pt-4">
                  <RegieAIConfigImport
                    regieId={selectedRegie.id}
                    userId={user?.id || ""}
                    onComplete={() => fetchRegieDetails(selectedRegie.id)}
                  />
                </div>

                {/* Tabs pour les différentes sections */}
                <Tabs defaultValue="dashboard" className="w-full">
                  <TabsList className="w-full rounded-none border-b grid grid-cols-6">
                    <TabsTrigger value="dashboard" className="gap-1 text-xs px-1">
                      <BarChart3 className="h-4 w-4" />
                      <span className="hidden sm:inline">Stats</span>
                    </TabsTrigger>
                    <TabsTrigger value="emails" className="gap-1 text-xs px-1">
                      <Mail className="h-4 w-4" />
                      <span className="hidden sm:inline">Emails</span>
                    </TabsTrigger>
                    <TabsTrigger value="contacts" className="gap-1 text-xs px-1">
                      <MessageSquare className="h-4 w-4" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </TabsTrigger>
                    <TabsTrigger value="bouquets" className="gap-1 text-xs px-1">
                      <Euro className="h-4 w-4" />
                      <span className="hidden sm:inline">Tarifs</span>
                    </TabsTrigger>
                    <TabsTrigger value="surcouts" className="gap-1 text-xs px-1">
                      <Wrench className="h-4 w-4" />
                      <span className="hidden sm:inline">Surcoûts</span>
                    </TabsTrigger>
                    <TabsTrigger value="financements" className="gap-1 text-xs px-1">
                      <CreditCard className="h-4 w-4" />
                      <span className="hidden sm:inline">Financement</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Onglet Dashboard */}
                  <TabsContent value="dashboard" className="p-4 space-y-4">
                    {(() => {
                      const stats = regieStats[selectedRegie.id] || {
                        rdv: 0, ventes: 0, rdvMois: 0, ventesMois: 0, commEnAttente: 0, commAVenir: 0, commDuSur: 0, commPayees: 0
                      };
                      const conversionRate = stats.rdv > 0 ? Math.round((stats.ventes / stats.rdv) * 100) : 0;
                      
                      return (
                        <>
                          {/* KPIs principaux */}
                          <div className="grid grid-cols-2 gap-3">
                            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Calendar className="h-4 w-4 text-blue-600" />
                                  <span className="text-xs text-muted-foreground">RDV Total</span>
                                </div>
                                <p className="text-2xl font-bold text-blue-600">{stats.rdv}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  dont {stats.rdvMois} ce mois
                                </p>
                              </CardContent>
                            </Card>

                            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Target className="h-4 w-4 text-green-600" />
                                  <span className="text-xs text-muted-foreground">Ventes</span>
                                </div>
                                <p className="text-2xl font-bold text-green-600">{stats.ventes}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  dont {stats.ventesMois} ce mois
                                </p>
                              </CardContent>
                            </Card>

                            {/* Commissions En Attente */}
                            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Euro className="h-4 w-4 text-orange-600" />
                                  <span className="text-xs text-muted-foreground">En Attente</span>
                                </div>
                                <p className="text-2xl font-bold text-orange-600">{formatCurrency(stats.commEnAttente)}</p>
                                <p className="text-xs text-muted-foreground mt-1">Signé / Financement</p>
                              </CardContent>
                            </Card>

                            {/* Conversion */}
                            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <TrendingUp className="h-4 w-4 text-purple-600" />
                                  <span className="text-xs text-muted-foreground">Conversion</span>
                                </div>
                                <p className="text-2xl font-bold text-purple-600">{conversionRate}%</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  RDV → Vente
                                </p>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Pipeline des commissions */}
                          <Card>
                            <CardContent className="p-4">
                              <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                <Euro className="h-4 w-4 text-primary" />
                                Pipeline Commissions
                              </h4>
                              
                              <div className="space-y-3">
                                {/* En Attente */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">En Attente</span>
                                    <span className="font-medium text-orange-600">{formatCurrency(stats.commEnAttente)}</span>
                                  </div>
                                  <Progress 
                                    value={((stats.commEnAttente + stats.commAVenir + stats.commDuSur + stats.commPayees) > 0) ? (stats.commEnAttente / (stats.commEnAttente + stats.commAVenir + stats.commDuSur + stats.commPayees)) * 100 : 0} 
                                    className="h-2 bg-orange-100"
                                  />
                                </div>

                                <div className="flex items-center justify-center">
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </div>

                                {/* À Venir */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">À Venir (pose)</span>
                                    <span className="font-medium text-blue-600">{formatCurrency(stats.commAVenir)}</span>
                                  </div>
                                  <Progress 
                                    value={((stats.commEnAttente + stats.commAVenir + stats.commDuSur + stats.commPayees) > 0) ? (stats.commAVenir / (stats.commEnAttente + stats.commAVenir + stats.commDuSur + stats.commPayees)) * 100 : 0} 
                                    className="h-2 bg-blue-100"
                                  />
                                </div>

                                <div className="flex items-center justify-center">
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </div>

                                {/* Du Sûr */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Du Sûr (installé)</span>
                                    <span className="font-medium text-emerald-600">{formatCurrency(stats.commDuSur)}</span>
                                  </div>
                                  <Progress 
                                    value={((stats.commEnAttente + stats.commAVenir + stats.commDuSur + stats.commPayees) > 0) ? (stats.commDuSur / (stats.commEnAttente + stats.commAVenir + stats.commDuSur + stats.commPayees)) * 100 : 0} 
                                    className="h-2 bg-emerald-100"
                                  />
                                </div>

                                <div className="flex items-center justify-center">
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </div>

                                {/* Payées */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Payées</span>
                                    <span className="font-medium text-green-600">{formatCurrency(stats.commPayees)}</span>
                                  </div>
                                  <Progress 
                                    value={((stats.commEnAttente + stats.commAVenir + stats.commDuSur + stats.commPayees) > 0) ? (stats.commPayees / (stats.commEnAttente + stats.commAVenir + stats.commDuSur + stats.commPayees)) * 100 : 0} 
                                    className="h-2 bg-green-100"
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Total potentiel */}
                          <Card className="bg-muted/30">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs text-muted-foreground">Potentiel Total</p>
                                  <p className="text-lg font-bold">{formatCurrency(stats.commEnAttente + stats.commAVenir + stats.commDuSur)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">Taux conversion</p>
                                  <p className="text-lg font-bold text-primary">{conversionRate}%</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Section SIRET */}
                          <Card>
                            <CardContent className="p-4">
                              <SiretSearchField
                                companyName={selectedRegie.nom}
                                value={selectedRegie.siret || ""}
                                onChange={(siret) => handleUpdateSiret(siret)}
                              />
                            </CardContent>
                          </Card>
                        </>
                      );
                    })()}</TabsContent>

                  {/* Onglet Emails */}
                  <TabsContent value="emails" className="p-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Emails d'import RDV automatique
                    </p>

                    {/* Formulaire ajout email */}
                    <Card>
                      <CardContent className="p-3 space-y-2">
                        <Input
                          placeholder="Email expéditeur"
                          type="email"
                          value={newEmail.email}
                          onChange={(e) => setNewEmail({ ...newEmail, email: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <Input
                            placeholder="Nom source (optionnel)"
                            value={newEmail.nom_source}
                            onChange={(e) => setNewEmail({ ...newEmail, nom_source: e.target.value })}
                            className="flex-1"
                          />
                          <Button size="sm" onClick={handleAddEmail} disabled={!newEmail.email.trim()}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {regieEmails.map((email) => (
                      <Card key={email.id}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Mail className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{email.email}</p>
                            {email.nom_source && (
                              <p className="text-xs text-muted-foreground">{email.nom_source}</p>
                            )}
                          </div>
                          <Switch 
                            checked={email.actif} 
                            onCheckedChange={() => handleToggleEmailActif(email)}
                          />
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="text-destructive"
                            onClick={() => handleDeleteEmail(email.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}

                    {regieEmails.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucun email configuré
                      </p>
                    )}
                  </TabsContent>

                  {/* Onglet Contacts WhatsApp */}
                  <TabsContent value="contacts" className="p-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Contacts pour envoi WhatsApp
                    </p>

                    {/* Formulaire ajout contact */}
                    <Card>
                      <CardContent className="p-3 space-y-2">
                        <Input
                          placeholder="Nom du contact"
                          value={newContact.nom}
                          onChange={(e) => setNewContact({ ...newContact, nom: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <Input
                            placeholder="Téléphone"
                            value={newContact.telephone}
                            onChange={(e) => setNewContact({ ...newContact, telephone: e.target.value })}
                            className="flex-1"
                          />
                          <Button 
                            size="sm" 
                            onClick={handleAddContact} 
                            disabled={!newContact.nom.trim() || !newContact.telephone.trim()}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {regieContacts.map((contact) => (
                      <Card key={contact.id} className={contact.is_principal ? "ring-2 ring-primary" : ""}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${contact.is_principal ? "bg-primary text-primary-foreground" : "bg-green-500/10"}`}>
                            <MessageSquare className={`h-4 w-4 ${contact.is_principal ? "" : "text-green-600"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{contact.nom}</p>
                              {contact.is_principal && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-primary">
                                  <Star className="h-2.5 w-2.5 mr-0.5" />
                                  Principal
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{contact.telephone}</p>
                          </div>
                          {!contact.is_principal && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs gap-1"
                              onClick={() => handleSetPrincipal(contact.id)}
                            >
                              <Check className="h-3 w-3" />
                              Principal
                            </Button>
                          )}
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="text-destructive"
                            onClick={() => handleDeleteContact(contact.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}

                    {regieContacts.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucun contact configuré
                      </p>
                    )}

                    <Card className="bg-muted/50 border-dashed">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground text-center">
                          Le contact <strong>Principal</strong> recevra les messages WhatsApp automatiques lors des changements de statut.
                        </p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Onglet Bouquets/Tarifs - Multi-produit */}
                  <TabsContent value="bouquets" className="p-4">
                    <ProductBouquetsSection
                      selectedRegie={{
                        id: selectedRegie.id,
                        nom: selectedRegie.nom,
                        mode_calcul_commission: selectedRegie.mode_calcul_commission,
                        part_survente_pct: selectedRegie.part_survente_pct,
                      }}
                      regieBouquets={regieBouquets.map(b => ({
                        ...b,
                        product_type: (b as any).product_type || null,
                      }))}
                      userId={user?.id || ""}
                      onRefresh={() => fetchRegieDetails(selectedRegie.id)}
                      onUpdateCommissionMode={handleUpdateCommissionMode}
                      onUpdateSurventePct={handleUpdateSurventePct}
                    />
                  </TabsContent>

                  {/* Onglet Surcoûts - Multi-produit */}
                  <TabsContent value="surcouts" className="p-4">
                    <ProductSurcoutsSection
                      regieId={selectedRegie.id}
                      userId={user?.id || ""}
                      regieSurcouts={regieSurcouts.map(s => ({
                        ...s,
                        type_calcul: s.type_calcul as 'fixe' | 'par_panneau' | 'par_m2',
                      }))}
                      onRefresh={() => fetchRegieDetails(selectedRegie.id)}
                    />
                  </TabsContent>

                  {/* Onglet Financements */}
                  <TabsContent value="financements" className="p-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Options de financement proposées par cette régie
                    </p>

                    {/* Formulaire ajout financement */}
                    <Card>
                      <CardContent className="p-3 space-y-2">
                        <Input
                          placeholder="Nom du financement (ex: Cetelem 120 mois)"
                          value={newFinancement.nom}
                          onChange={(e) => setNewFinancement({ ...newFinancement, nom: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Taux effectif %</label>
                            <Input
                              type="number"
                              step="0.01"
                              value={newFinancement.taux_effectif}
                              onChange={(e) => setNewFinancement({ ...newFinancement, taux_effectif: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">TAEG %</label>
                            <Input
                              type="number"
                              step="0.01"
                              value={newFinancement.taeg}
                              onChange={(e) => setNewFinancement({ ...newFinancement, taeg: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={handleAddFinancement} 
                          disabled={!newFinancement.nom.trim()}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Ajouter le financement
                        </Button>
                      </CardContent>
                    </Card>

                    {regieFinancements.map((financement) => (
                      <Card key={financement.id} className={!financement.actif ? "opacity-50" : ""}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{financement.nom}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Taux {financement.taux_effectif}% • TAEG {financement.taeg}%
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch 
                                checked={financement.actif} 
                                onCheckedChange={() => handleToggleFinancementActif(financement)}
                              />
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="text-destructive h-8 w-8"
                                onClick={() => handleDeleteFinancement(financement.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {regieFinancements.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucun financement configuré
                      </p>
                    )}
                  </TabsContent>
                </Tabs>

                {/* Footer actions */}
                <div className="p-4 border-t">
                  <Button variant="outline" className="w-full" onClick={() => setSelectedRegie(null)}>
                    Fermer
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Regie Dialog */}
        {selectedRegie && (
          <EditRegieDialog
            open={isEditing}
            onOpenChange={setIsEditing}
            regie={selectedRegie}
            onSuccess={(updatedRegie) => {
              setSelectedRegie({ ...selectedRegie, ...updatedRegie });
              setRegies(regies.map(r => r.id === updatedRegie.id ? { ...r, ...updatedRegie } : r));
            }}
          />
        )}
      </div>
    </MobileLayout>
  );
};

export default RegiesSettings;
