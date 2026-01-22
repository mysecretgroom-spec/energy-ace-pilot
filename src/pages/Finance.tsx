import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReceiptScanner } from "@/components/finance/ReceiptScanner";
import { ExportFraisPDF } from "@/components/finance/ExportFraisPDF";
import { ReceiptGallery } from "@/components/finance/ReceiptGallery";
import { ExpenseChart } from "@/components/finance/ExpenseChart";
import { VATReport } from "@/components/finance/VATReport";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import {
  TrendingUp,
  TrendingDown,
  Euro,
  Receipt,
  Camera,
  Calendar,
  Fuel,
  Utensils,
  Building2,
  Car,
  Plus,
  ParkingSquare,
  HelpCircle,
  FolderOpen,
  FileText,
  Loader2,
  CheckCircle,
  Clock,
  Ban,
  Pencil,
  Trash2,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

const categoryIcons: Record<string, React.ElementType> = {
  carburant: Fuel,
  repas: Utensils,
  hotel: Building2,
  peage: Car,
  parking: ParkingSquare,
  autre: HelpCircle,
};

const categoryLabels: Record<string, string> = {
  carburant: "Carburant",
  repas: "Repas",
  hotel: "Hôtel",
  peage: "Péage",
  parking: "Parking",
  autre: "Autre",
};

interface FraisItem {
  id: string;
  montant: number;
  date_frais: string;
  categorie: string;
  description: string | null;
  ocr_data: Json | null;
}

interface VenteStats {
  caMonth: number;
  caPrevMonth: number;
  commissionsMonth: number;
  // Nouvelles catégories de commissions
  comPotentielle: number;  // Tous contrats signés non annulés
  comAVenir: number;       // envoi_pose, en_installation
  comDuSur: number;        // installe, attente_paiement
  signedCount: number;
  avgDeal: number;
  ventesEnCours: number;
  ventesAnnulees: number;
}

const Finance = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("ventes");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [addFraisOpen, setAddFraisOpen] = useState(false);
  const [fraisData, setFraisData] = useState<FraisItem[]>([]);
  const [allFraisData, setAllFraisData] = useState<FraisItem[]>([]);
  const [venteStats, setVenteStats] = useState<VenteStats | null>(null);
  const [loadingVentes, setLoadingVentes] = useState(true);
  const [savingFrais, setSavingFrais] = useState(false);
  const [totaux, setTotaux] = useState({
    jour: 0,
    semaine: 0,
    mois: 0,
    annee: 0,
  });
  
  // Form state for manual expense
  const [newFrais, setNewFrais] = useState({
    montant: "",
    categorie: "autre",
    description: "",
    date_frais: new Date().toISOString().split("T")[0],
  });
  
  // Edit/Delete state
  const [editingFrais, setEditingFrais] = useState<FraisItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fraisToDelete, setFraisToDelete] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    montant: "",
    categorie: "autre",
    description: "",
    date_frais: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch ventes stats
  useEffect(() => {
    if (!user) return;

    const fetchVenteStats = async () => {
      setLoadingVentes(true);
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Fetch all ventes for the user (toutes, pas juste ce mois)
        const { data: ventes, error } = await supabase
          .from("ventes")
          .select("id, montant_ttc, montant_ht, status, puissance_kwc, decom_montant, date_signature, created_at")
          .eq("user_id", user.id);

        if (error) throw error;

        // Fetch commission config and tiers
        const [tiersRes, bouquetsRes, configRes] = await Promise.all([
          supabase.from("data_commissions").select("*").order("tranche_min"),
          supabase.from("data_prix_bouquets").select("puissance_kwc, prix_hejja, prix_recommande").eq("actif", true),
          supabase.from("config_commissions").select("part_survente_pct").maybeSingle(),
        ]);

        const tiers = tiersRes.data || [];
        const bouquets = bouquetsRes.data || [];
        const partSurventePct = configRes.data?.part_survente_pct || 50;

        // Helper to calculate commission for a vente
        const calcCommission = (v: typeof ventes[0]) => {
          if (!v.puissance_kwc) return 0;
          
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
          return Math.max(0, baseCommission + bonusSurvente - decomMontant);
        };

        // Calculate stats
        const ventesThisMonth = ventes?.filter(v => {
          const date = v.date_signature ? new Date(v.date_signature) : new Date(v.created_at);
          return date >= startOfMonth;
        }) || [];

        const ventesPrevMonth = ventes?.filter(v => {
          const date = v.date_signature ? new Date(v.date_signature) : new Date(v.created_at);
          return date >= startOfPrevMonth && date <= endOfPrevMonth;
        }) || [];

        const signedThisMonth = ventesThisMonth.filter(v => 
          !["en_negociation", "annule"].includes(v.status)
        );
        
        const signedPrevMonth = ventesPrevMonth.filter(v => 
          !["en_negociation", "annule"].includes(v.status)
        );

        const caMonth = signedThisMonth.reduce((sum, v) => sum + Number(v.montant_ttc || 0), 0);
        const caPrevMonth = signedPrevMonth.reduce((sum, v) => sum + Number(v.montant_ttc || 0), 0);

        // Commissions this month
        const commissionsMonth = signedThisMonth.reduce((sum, v) => sum + calcCommission(v), 0);

        // Com potentielle: tous contrats signés non annulés (toutes périodes)
        const ventesSigneesNonAnnulees = ventes?.filter(v => 
          !["en_negociation", "annule", "paye"].includes(v.status)
        ) || [];
        const comPotentielle = ventesSigneesNonAnnulees.reduce((sum, v) => sum + calcCommission(v), 0);

        // Com à venir: envoi_pose, en_installation
        const ventesAVenir = ventes?.filter(v => 
          ["envoi_pose", "en_installation"].includes(v.status)
        ) || [];
        const comAVenir = ventesAVenir.reduce((sum, v) => sum + calcCommission(v), 0);

        // Com du sûr: installe, attente_paiement
        const ventesDuSur = ventes?.filter(v => 
          ["installe", "attente_paiement"].includes(v.status)
        ) || [];
        const comDuSur = ventesDuSur.reduce((sum, v) => sum + calcCommission(v), 0);

        const signedCount = signedThisMonth.length;
        const avgDeal = signedCount > 0 ? caMonth / signedCount : 0;

        const ventesEnCours = ventes?.filter(v => 
          ["en_negociation", "signe", "cq_a_faire", "cq_fait", "attente_financement"].includes(v.status)
        ).length || 0;

        const ventesAnnulees = ventesThisMonth.filter(v => v.status === "annule").length;

        setVenteStats({
          caMonth,
          caPrevMonth,
          commissionsMonth,
          comPotentielle,
          comAVenir,
          comDuSur,
          signedCount,
          avgDeal,
          ventesEnCours,
          ventesAnnulees,
        });
      } catch (err) {
        console.error("Error fetching vente stats:", err);
      } finally {
        setLoadingVentes(false);
      }
    };

    fetchVenteStats();
  }, [user]);

  // Fetch frais
  useEffect(() => {
    if (!user) return;

    const fetchFrais = async () => {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const { data: allFrais } = await supabase
        .from("frais")
        .select("id, montant, date_frais, categorie, description, ocr_data")
        .eq("user_id", user.id)
        .gte("date_frais", startOfYear.toISOString().split("T")[0])
        .order("date_frais", { ascending: false });

      if (allFrais) {
        setAllFraisData(allFrais);
        setFraisData(allFrais.slice(0, 10));

        const jourTotal = allFrais
          .filter(f => f.date_frais >= startOfDay.toISOString().split("T")[0])
          .reduce((sum, f) => sum + Number(f.montant), 0);
        const semaineTotal = allFrais
          .filter(f => f.date_frais >= startOfWeek.toISOString().split("T")[0])
          .reduce((sum, f) => sum + Number(f.montant), 0);
        const moisTotal = allFrais
          .filter(f => f.date_frais >= startOfMonth.toISOString().split("T")[0])
          .reduce((sum, f) => sum + Number(f.montant), 0);
        const anneeTotal = allFrais.reduce((sum, f) => sum + Number(f.montant), 0);

        setTotaux({
          jour: jourTotal,
          semaine: semaineTotal,
          mois: moisTotal,
          annee: anneeTotal,
        });
      }
    };

    fetchFrais();
  }, [user, scannerOpen, addFraisOpen]);

  const handleAddFrais = async () => {
    if (!user || !newFrais.montant) {
      toast.error("Veuillez renseigner un montant");
      return;
    }

    setSavingFrais(true);
    try {
      const { error } = await supabase.from("frais").insert({
        user_id: user.id,
        montant: parseFloat(newFrais.montant),
        categorie: newFrais.categorie as "carburant" | "repas" | "hotel" | "peage" | "parking" | "autre",
        description: newFrais.description || null,
        date_frais: newFrais.date_frais,
      });

      if (error) throw error;

      toast.success("Frais ajouté");
      setAddFraisOpen(false);
      setNewFrais({
        montant: "",
        categorie: "autre",
        description: "",
        date_frais: new Date().toISOString().split("T")[0],
      });
    } catch (err) {
      console.error("Error adding frais:", err);
      toast.error("Erreur lors de l'ajout");
    } finally {
      setSavingFrais(false);
    }
  };

  const openEditDialog = (frais: FraisItem) => {
    setEditingFrais(frais);
    setEditForm({
      montant: String(frais.montant),
      categorie: frais.categorie,
      description: frais.description || "",
      date_frais: frais.date_frais,
    });
    setEditDialogOpen(true);
  };

  const handleEditFrais = async () => {
    if (!user || !editingFrais || !editForm.montant) {
      toast.error("Veuillez renseigner un montant");
      return;
    }

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("frais")
        .update({
          montant: parseFloat(editForm.montant),
          categorie: editForm.categorie as "carburant" | "repas" | "hotel" | "peage" | "parking" | "autre",
          description: editForm.description || null,
          date_frais: editForm.date_frais,
        })
        .eq("id", editingFrais.id);

      if (error) throw error;

      toast.success("Frais modifié");
      setEditDialogOpen(false);
      setEditingFrais(null);
      
      // Refresh data
      setAddFraisOpen(prev => !prev);
      setTimeout(() => setAddFraisOpen(false), 0);
    } catch (err) {
      console.error("Error editing frais:", err);
      toast.error("Erreur lors de la modification");
    } finally {
      setSavingEdit(false);
    }
  };

  const openDeleteDialog = (fraisId: string) => {
    setFraisToDelete(fraisId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteFrais = async () => {
    if (!fraisToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("frais")
        .delete()
        .eq("id", fraisToDelete);

      if (error) throw error;

      toast.success("Frais supprimé");
      setDeleteDialogOpen(false);
      setFraisToDelete(null);
      
      // Refresh data
      setAddFraisOpen(prev => !prev);
      setTimeout(() => setAddFraisOpen(false), 0);
    } catch (err) {
      console.error("Error deleting frais:", err);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const caVariation = venteStats && venteStats.caPrevMonth > 0 
    ? ((venteStats.caMonth - venteStats.caPrevMonth) / venteStats.caPrevMonth * 100)
    : 0;

  return (
    <MobileLayout title="Finance">
      <div className="p-4 space-y-4">
        {/* Tabs Ventes / Frais */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="ventes" className="gap-1">
              <TrendingUp className="h-4 w-4" />
              Ventes
            </TabsTrigger>
            <TabsTrigger value="frais" className="gap-1">
              <Receipt className="h-4 w-4" />
              Frais
            </TabsTrigger>
          </TabsList>

          {/* Tab Ventes */}
          <TabsContent value="ventes" className="space-y-4 mt-4">
            {loadingVentes ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24 col-span-2" />
                </div>
              </div>
            ) : venteStats ? (
              <>
                {/* CA du mois */}
                <Card className="bg-gradient-hero text-primary-foreground shadow-card">
                  <CardContent className="p-6">
                    <div className="text-center space-y-2">
                      <p className="text-sm opacity-90">Chiffre d'affaires ce mois</p>
                      <p className="text-4xl font-bold">
                        {venteStats.caMonth.toLocaleString("fr-FR")} €
                      </p>
                      {caVariation !== 0 && (
                        <div className={`flex items-center justify-center gap-1 text-sm ${caVariation >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                          {caVariation >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          <span>{caVariation >= 0 ? '+' : ''}{caVariation.toFixed(0)}% vs mois dernier</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Stats grid - 2 cols */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="shadow-card">
                    <CardContent className="p-4 text-center">
                      <Euro className="h-6 w-6 mx-auto mb-2 text-primary" />
                      <p className="text-2xl font-bold text-foreground">
                        {venteStats.commissionsMonth.toLocaleString("fr-FR")} €
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Commissions ce mois
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card">
                    <CardContent className="p-4 text-center">
                      <Calendar className="h-6 w-6 mx-auto mb-2 text-secondary" />
                      <p className="text-2xl font-bold text-foreground">
                        {venteStats.signedCount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Dossiers signés ce mois
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card">
                    <CardContent className="p-4 text-center">
                      <TrendingUp className="h-6 w-6 mx-auto mb-2 text-status-signed" />
                      <p className="text-xl font-bold text-foreground">
                        {venteStats.avgDeal.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Panier moyen
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card">
                    <CardContent className="p-4 text-center">
                      <CheckCircle className="h-6 w-6 mx-auto mb-2 text-status-signed" />
                      <p className="text-sm text-muted-foreground">En cours</p>
                      <p className="text-lg font-bold text-foreground">{venteStats.ventesEnCours}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Répartition des commissions */}
                <Card className="shadow-card border-primary/20">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Répartition des commissions</p>
                    
                    {/* Com Potentielle */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-200">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-amber-600" />
                        <div>
                          <p className="text-sm font-medium text-amber-700">Com. Potentielle</p>
                          <p className="text-xs text-amber-600/80">Contrats signés non annulés</p>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-amber-700">
                        {venteStats.comPotentielle.toLocaleString("fr-FR")} €
                      </p>
                    </div>
                    
                    {/* Com À Venir */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-200">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-blue-700">Com. À Venir</p>
                          <p className="text-xs text-blue-600/80">Envoi pose / En installation</p>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-blue-700">
                        {venteStats.comAVenir.toLocaleString("fr-FR")} €
                      </p>
                    </div>
                    
                    {/* Com Du Sûr */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-200">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-green-700">Com. Du Sûr</p>
                          <p className="text-xs text-green-600/80">Posé / Attente paiement</p>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-green-700">
                        {venteStats.comDuSur.toLocaleString("fr-FR")} €
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Ventes annulées */}
                <Card className="shadow-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Ban className="h-4 w-4 text-destructive" />
                      <span className="text-sm text-muted-foreground">Annulées ce mois:</span>
                      <span className="font-semibold">{venteStats.ventesAnnulees}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Rentabilité Nette */}
                <Card className="shadow-card border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Rentabilité nette (Comm. - Frais)
                        </p>
                        <p className={`text-2xl font-bold ${
                          (venteStats.commissionsMonth - totaux.mois) >= 0 
                            ? 'text-status-signed' 
                            : 'text-destructive'
                        }`}>
                          {(venteStats.commissionsMonth - totaux.mois).toLocaleString("fr-FR")} €
                        </p>
                      </div>
                      <FileText className="h-8 w-8 text-primary/50" />
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="shadow-card">
                <CardContent className="p-6 text-center text-muted-foreground">
                  Aucune donnée de vente disponible
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab Frais */}
          <TabsContent value="frais" className="space-y-4 mt-4">
            {/* Totaux */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="shadow-card">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {totaux.jour.toFixed(2)} €
                  </p>
                  <p className="text-xs text-muted-foreground">Aujourd'hui</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {totaux.semaine.toFixed(2)} €
                  </p>
                  <p className="text-xs text-muted-foreground">Cette semaine</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {totaux.mois.toFixed(2)} €
                  </p>
                  <p className="text-xs text-muted-foreground">Ce mois</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {totaux.annee.toLocaleString("fr-FR")} €
                  </p>
                  <p className="text-xs text-muted-foreground">Cette année</p>
                </CardContent>
              </Card>
            </div>

            {/* Expense Chart */}
            <ExpenseChart frais={allFraisData} />

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
                <DialogTrigger asChild>
                  <Button className="flex-1 bg-gradient-hero gap-2">
                    <Camera className="h-4 w-4" />
                    Scanner
                  </Button>
                </DialogTrigger>
                <DialogContent className="p-0 max-w-md">
                  <ReceiptScanner 
                    onSuccess={() => setScannerOpen(false)} 
                    onCancel={() => setScannerOpen(false)} 
                  />
                </DialogContent>
              </Dialog>
              
              <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Factures
                  </Button>
                </DialogTrigger>
                <DialogContent className="p-0 max-w-lg max-h-[85vh]">
                  <ReceiptGallery onClose={() => setGalleryOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
            
            {/* Export & Reports */}
            <div className="flex gap-2">
              <VATReport 
                frais={allFraisData} 
                periode={new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} 
              />
              <ExportFraisPDF 
                frais={fraisData} 
                periode={new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} 
              />
            </div>

            {/* Liste des frais */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Derniers frais
              </h3>
              {fraisData.length === 0 ? (
                <Card className="shadow-card">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Aucun frais enregistré
                  </CardContent>
                </Card>
              ) : (
                fraisData.map((frais) => {
                  const Icon = categoryIcons[frais.categorie] || HelpCircle;
                  return (
                    <Card key={frais.id} className="shadow-card">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {frais.description || categoryLabels[frais.categorie]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(frais.date_frais).toLocaleDateString("fr-FR")} • {categoryLabels[frais.categorie]}
                            </p>
                          </div>
                          <p className="font-semibold text-destructive whitespace-nowrap">
                            -{Number(frais.montant).toFixed(2)} €
                          </p>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(frais)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => openDeleteDialog(frais.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Ajouter frais manuel */}
            <Dialog open={addFraisOpen} onOpenChange={setAddFraisOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Ajouter frais manuel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter un frais</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="montant">Montant TTC (€)</Label>
                    <Input
                      id="montant"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newFrais.montant}
                      onChange={(e) => setNewFrais(prev => ({ ...prev, montant: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="categorie">Catégorie</Label>
                    <Select
                      value={newFrais.categorie}
                      onValueChange={(v) => setNewFrais(prev => ({ ...prev, categorie: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newFrais.date_frais}
                      onChange={(e) => setNewFrais(prev => ({ ...prev, date_frais: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optionnel)</Label>
                    <Input
                      id="description"
                      placeholder="Ex: Station Total, Restaurant..."
                      value={newFrais.description}
                      onChange={(e) => setNewFrais(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  
                  <Button 
                    className="w-full" 
                    onClick={handleAddFrais}
                    disabled={savingFrais}
                  >
                    {savingFrais ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      "Enregistrer"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Modifier le frais</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-montant">Montant TTC (€)</Label>
                    <Input
                      id="edit-montant"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={editForm.montant}
                      onChange={(e) => setEditForm(prev => ({ ...prev, montant: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-categorie">Catégorie</Label>
                    <Select
                      value={editForm.categorie}
                      onValueChange={(v) => setEditForm(prev => ({ ...prev, categorie: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-date">Date</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editForm.date_frais}
                      onChange={(e) => setEditForm(prev => ({ ...prev, date_frais: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Description (optionnel)</Label>
                    <Input
                      id="edit-description"
                      placeholder="Ex: Station Total, Restaurant..."
                      value={editForm.description}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  
                  <Button 
                    className="w-full" 
                    onClick={handleEditFrais}
                    disabled={savingEdit}
                  >
                    {savingEdit ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      "Enregistrer les modifications"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce frais ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Le frais sera définitivement supprimé.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteFrais}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Suppression...
                      </>
                    ) : (
                      "Supprimer"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
};

export default Finance;
