import { useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  Euro,
  Receipt,
  Camera,
  Download,
  Calendar,
  Fuel,
  Utensils,
  Building2,
  Car,
  Plus,
} from "lucide-react";

// Données de démonstration
const venteStats = {
  caMonth: 45000,
  commissionsMonth: 4500,
  signedCount: 4,
  avgDeal: 11250,
};

const fraisData = [
  {
    id: "1",
    date: "21/01/2026",
    category: "Carburant",
    description: "Plein essence",
    amount: 85.5,
    icon: Fuel,
  },
  {
    id: "2",
    date: "20/01/2026",
    category: "Repas",
    description: "Déjeuner client",
    amount: 32.0,
    icon: Utensils,
  },
  {
    id: "3",
    date: "19/01/2026",
    category: "Hôtel",
    description: "Nuit Lyon centre",
    amount: 89.0,
    icon: Building2,
  },
  {
    id: "4",
    date: "18/01/2026",
    category: "Péage",
    description: "A6 Lyon-Mâcon",
    amount: 12.4,
    icon: Car,
  },
];

const totauxFrais = {
  jour: 85.5,
  semaine: 218.9,
  mois: 876.5,
  annee: 12450,
};

const Finance = () => {
  const [activeTab, setActiveTab] = useState("ventes");

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
                    {totauxFrais.jour.toFixed(2)} €
                  </p>
                  <p className="text-xs text-muted-foreground">Aujourd'hui</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {totauxFrais.semaine.toFixed(2)} €
                  </p>
                  <p className="text-xs text-muted-foreground">Cette semaine</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {totauxFrais.mois.toFixed(2)} €
                  </p>
                  <p className="text-xs text-muted-foreground">Ce mois</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {totauxFrais.annee.toLocaleString("fr-FR")} €
                  </p>
                  <p className="text-xs text-muted-foreground">Cette année</p>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button className="flex-1 bg-gradient-hero gap-2">
                <Camera className="h-4 w-4" />
                Scanner facture
              </Button>
              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div>

            {/* Liste des frais */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Derniers frais
              </h3>
              {fraisData.map((frais) => {
                const Icon = frais.icon;
                return (
                  <Card key={frais.id} className="shadow-card">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {frais.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {frais.date} • {frais.category}
                          </p>
                        </div>
                        <p className="font-semibold text-destructive">
                          -{frais.amount.toFixed(2)} €
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
