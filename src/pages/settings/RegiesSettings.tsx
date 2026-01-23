import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
} from "lucide-react";
import { BouquetExtractor } from "@/components/regie/BouquetExtractor";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Regie {
  id: string;
  nom: string;
  couleur: string;
  logo_url: string | null;
  actif: boolean;
  created_at: string;
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
  prix_max: number;
  prix_hejja: number;
  commission_fixe: number;
  commission_pct: number;
  description: string | null;
  actif: boolean;
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regies, setRegies] = useState<Regie[]>([]);
  const [regieStats, setRegieStats] = useState<Record<string, RegieStats>>({});
  const [selectedRegie, setSelectedRegie] = useState<Regie | null>(null);
  const [regieEmails, setRegieEmails] = useState<RegieEmail[]>([]);
  const [regieContacts, setRegieContacts] = useState<RegieContact[]>([]);
  const [regieBouquets, setRegieBouquets] = useState<RegieBouquet[]>([]);
  
  // Create dialog
  const [isCreating, setIsCreating] = useState(false);
  const [newRegie, setNewRegie] = useState({ nom: "", couleur: "#0066CC" });
  
  // Edit forms
  const [newEmail, setNewEmail] = useState({ email: "", nom_source: "" });
  const [newContact, setNewContact] = useState({ nom: "", telephone: "" });
  const [newBouquet, setNewBouquet] = useState({
    nom_bouquet: "",
    puissance_kwc: 3,
    prix_recommande: 0,
    prix_max: 0,
    prix_hejja: 0,
    commission_fixe: 0,
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

      // Fetch stats for each regie
      const statsMap: Record<string, RegieStats> = {};
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      for (const regie of data || []) {
        const [rdvResult, rdvMoisResult, ventesResult, ventesMoisResult, commissionsResult] = await Promise.all([
          supabase.from("rdv").select("id", { count: "exact" }).eq("regie_id", regie.id),
          supabase.from("rdv").select("id", { count: "exact" }).eq("regie_id", regie.id).gte("date_heure", startOfMonth),
          supabase.from("ventes").select("id, montant_solde, status").eq("regie_id", regie.id),
          supabase.from("ventes").select("id, montant_solde").eq("regie_id", regie.id).gte("date_signature", startOfMonth.split("T")[0]),
          supabase.from("commissions").select("montant_commission, paye, vente:ventes!inner(status, regie_id)").eq("vente.regie_id", regie.id),
        ]);
        
        const ventes = ventesResult.data || [];
        const ventesMois = ventesMoisResult.data || [];
        const commissions = (commissionsResult.data || []) as any[];
        
        // Calculate commissions by category
        let commEnAttente = 0;  // Signé, financement, CQ
        let commAVenir = 0;     // Envoi pose, en installation
        let commDuSur = 0;      // Installé, attente paiement
        let commPayees = 0;     // Payé
        
        for (const c of commissions) {
          const status = c.vente?.status;
          const montant = Number(c.montant_commission) || 0;
          
          if (c.paye) {
            commPayees += montant;
          } else if (["signe", "attente_financement", "cq_a_faire", "cq_fait"].includes(status)) {
            commEnAttente += montant;
          } else if (["envoi_pose", "en_installation"].includes(status)) {
            commAVenir += montant;
          } else if (["installe", "attente_paiement"].includes(status)) {
            commDuSur += montant;
          }
        }
        
        statsMap[regie.id] = {
          rdv: rdvResult.count || 0,
          ventes: ventes.length,
          rdvMois: rdvMoisResult.count || 0,
          ventesMois: ventesMois.length,
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
      const [emailsRes, contactsRes, bouquetsRes] = await Promise.all([
        supabase.from("emails_autorises").select("*").eq("regie_id", regieId),
        supabase.from("regies_contacts").select("*").eq("regie_id", regieId).order("is_principal", { ascending: false }),
        supabase.from("regies_bouquets").select("*").eq("regie_id", regieId).order("puissance_kwc"),
      ]);

      setRegieEmails((emailsRes.data || []) as RegieEmail[]);
      setRegieContacts(contactsRes.data || []);
      setRegieBouquets(bouquetsRes.data || []);
    } catch (error) {
      console.error("Error fetching regie details:", error);
    }
  };

  const handleCreateRegie = async () => {
    if (!user || !newRegie.nom.trim()) {
      toast.error("Le nom de la régie est requis");
      return;
    }
    
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("regies")
        .insert({
          user_id: user.id,
          nom: newRegie.nom.trim(),
          couleur: newRegie.couleur,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Une régie avec ce nom existe déjà");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Régie créée avec succès");
      setIsCreating(false);
      setNewRegie({ nom: "", couleur: "#0066CC" });
      fetchRegies();
      setSelectedRegie(data);
    } catch (error) {
      console.error("Error creating regie:", error);
      toast.error("Erreur lors de la création");
    } finally {
      setSaving(false);
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

  // Email handlers
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

      toast.success("Contact principal mis à jour");
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
        .from("regies_bouquets")
        .insert({
          user_id: user.id,
          regie_id: selectedRegie.id,
          ...newBouquet,
          nom_bouquet: newBouquet.nom_bouquet.trim(),
          actif: true,
        });

      if (error) throw error;

      toast.success("Bouquet ajouté");
      setNewBouquet({
        nom_bouquet: "",
        puissance_kwc: 3,
        prix_recommande: 0,
        prix_max: 0,
        prix_hejja: 0,
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
      const { error } = await supabase.from("regies_bouquets").delete().eq("id", bouquetId);
      if (error) throw error;
      setRegieBouquets(regieBouquets.filter(b => b.id !== bouquetId));
      toast.success("Bouquet supprimé");
    } catch (error) {
      console.error("Error deleting bouquet:", error);
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
      <div className="p-4 pb-8 space-y-4">
        {/* Header avec bouton d'ajout */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Gérez vos sources de RDV et leurs tarifs
            </p>
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <Button size="sm" className="gap-2" onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4" />
              Nouvelle
            </Button>
            <DialogContent className="max-w-[95vw]">
              <DialogHeader>
                <DialogTitle>Nouvelle Régie</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nom de la régie</label>
                  <Input 
                    placeholder="Ex: EDF ENR, Engie Solar..." 
                    value={newRegie.nom}
                    onChange={(e) => setNewRegie({ ...newRegie, nom: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Couleur</label>
                  <div className="flex gap-2 flex-wrap">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        className={`w-8 h-8 rounded-full border-2 transition-colors ${
                          newRegie.couleur === color ? "border-foreground" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewRegie({ ...newRegie, couleur: color })}
                      />
                    ))}
                  </div>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleCreateRegie}
                  disabled={saving || !newRegie.nom.trim()}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Créer la régie
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Liste des régies */}
        {regies.length === 0 ? (
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
            {regies.map((regie) => {
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
        )}

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
                        navigate(`/regies/${selectedRegie.id}`);
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Dialog>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20">
                        <Palette className="h-4 w-4" />
                      </Button>
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

                {/* Tabs pour les différentes sections */}
                <Tabs defaultValue="dashboard" className="w-full">
                  <TabsList className="w-full rounded-none border-b grid grid-cols-4">
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
                          💡 Le contact <strong>Principal</strong> recevra les messages WhatsApp automatiques lors des changements de statut.
                        </p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Onglet Bouquets/Tarifs */}
                  <TabsContent value="bouquets" className="p-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Tarifs et commissions spécifiques à cette régie
                    </p>

                    {/* Extraction AI */}
                    {user && (
                      <BouquetExtractor
                        regieId={selectedRegie.id}
                        userId={user.id}
                        onBouquetsCreated={() => fetchRegieDetails(selectedRegie.id)}
                      />
                    )}

                    {/* Séparateur */}
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">ou ajouter manuellement</span>
                      </div>
                    </div>

                    {/* Formulaire ajout bouquet */}
                    <Card>
                      <CardContent className="p-3 space-y-2">
                        <Input
                          placeholder="Nom du bouquet"
                          value={newBouquet.nom_bouquet}
                          onChange={(e) => setNewBouquet({ ...newBouquet, nom_bouquet: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Puissance (kWc)</label>
                            <Input
                              type="number"
                              step="0.1"
                              value={newBouquet.puissance_kwc}
                              onChange={(e) => setNewBouquet({ ...newBouquet, puissance_kwc: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Prix recommandé</label>
                            <Input
                              type="number"
                              value={newBouquet.prix_recommande}
                              onChange={(e) => setNewBouquet({ ...newBouquet, prix_recommande: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Prix max</label>
                            <Input
                              type="number"
                              value={newBouquet.prix_max}
                              onChange={(e) => setNewBouquet({ ...newBouquet, prix_max: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Commission €</label>
                            <Input
                              type="number"
                              value={newBouquet.commission_fixe}
                              onChange={(e) => setNewBouquet({ ...newBouquet, commission_fixe: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={handleAddBouquet} 
                          disabled={!newBouquet.nom_bouquet.trim()}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Ajouter le bouquet
                        </Button>
                      </CardContent>
                    </Card>

                    {regieBouquets.map((bouquet) => (
                      <Card key={bouquet.id}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{bouquet.nom_bouquet}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {bouquet.puissance_kwc} kWc
                              </p>
                            </div>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="text-destructive h-8 w-8"
                              onClick={() => handleDeleteBouquet(bouquet.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex gap-4 mt-3">
                            <div className="flex-1">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Prix reco.</p>
                              <p className="text-sm font-semibold text-foreground">
                                {formatCurrency(bouquet.prix_recommande)}
                              </p>
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Commission</p>
                              <p className="text-sm font-semibold text-green-600">
                                {formatCurrency(bouquet.commission_fixe)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {regieBouquets.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucun bouquet configuré
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
      </div>
    </MobileLayout>
  );
};

export default RegiesSettings;
