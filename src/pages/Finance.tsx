import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ReceiptScanner } from "@/components/finance/ReceiptScanner";
import { ExportFraisPDF } from "@/components/finance/ExportFraisPDF";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  TrendingUp,
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
} from "lucide-react";

// Données de démonstration
const venteStats = {
  caMonth: 45000,
  commissionsMonth: 4500,
  signedCount: 4,
  avgDeal: 11250,
};

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
  description?: string | null;
}

const Finance = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("ventes");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [fraisData, setFraisData] = useState<FraisItem[]>([]);
  const [totaux, setTotaux] = useState({
    jour: 0,
    semaine: 0,
    mois: 0,
    annee: 0,
  });

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
        .select("*")
        .eq("user_id", user.id)
        .gte("date_frais", startOfYear.toISOString().split("T")[0])
        .order("date_frais", { ascending: false });

      if (allFrais) {
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
  }, [user, scannerOpen]);

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
            {/* CA du mois */}
            <Card className="bg-gradient-hero text-primary-foreground shadow-card">
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <p className="text-sm opacity-90">Chiffre d'affaires ce mois</p>
                  <p className="text-4xl font-bold">
                    {venteStats.caMonth.toLocaleString("fr-FR")} €
                  </p>
                  <div className="flex items-center justify-center gap-1 text-sm">
                    <TrendingUp className="h-4 w-4" />
                    <span>+15% vs mois dernier</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="shadow-card">
                <CardContent className="p-4 text-center">
                  <Euro className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold text-foreground">
                    {venteStats.commissionsMonth.toLocaleString("fr-FR")} €
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Commissions
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
                    Dossiers signés
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-card col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Panier moyen
                      </p>
                      <p className="text-xl font-bold text-foreground">
                        {venteStats.avgDeal.toLocaleString("fr-FR")} €
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-status-signed" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* CTA rentabilité */}
            <Button variant="outline" className="w-full">
              Voir détail rentabilité
            </Button>
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

            {/* Actions */}
            <div className="flex gap-2">
              <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
                <DialogTrigger asChild>
                  <Button className="flex-1 bg-gradient-hero gap-2">
                    <Camera className="h-4 w-4" />
                    Scanner facture
                  </Button>
                </DialogTrigger>
                <DialogContent className="p-0 max-w-md">
                  <ReceiptScanner 
                    onSuccess={() => setScannerOpen(false)} 
                    onCancel={() => setScannerOpen(false)} 
                  />
                </DialogContent>
              </Dialog>
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
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {frais.description || categoryLabels[frais.categorie]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(frais.date_frais).toLocaleDateString("fr-FR")} • {categoryLabels[frais.categorie]}
                            </p>
                          </div>
                          <p className="font-semibold text-destructive">
                            -{Number(frais.montant).toFixed(2)} €
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Ajouter frais manuel */}
            <Button variant="outline" className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Ajouter frais manuel
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
};

export default Finance;
