import { useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { StatusBadge, RdvStatus } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  MapPin,
  Navigation,
  Phone,
  ChevronLeft,
  ChevronRight,
  Car,
} from "lucide-react";

type ViewMode = "jour" | "semaine" | "mois";

// Données de démonstration
const planningData = [
  {
    id: "1",
    time: "09:00",
    duration: "1h30",
    client: "M. Dupont",
    address: "12 rue de la Paix, 69001 Lyon",
    status: "nouveau" as RdvStatus,
    type: "Photovoltaïque",
    distance: "15 km",
    travelTime: "25 min",
  },
  {
    id: "2",
    time: "11:30",
    duration: "2h",
    client: "Mme Martin",
    address: "45 avenue Victor Hugo, 69100 Villeurbanne",
    status: "r2" as RdvStatus,
    type: "Pompe à chaleur",
    distance: "8 km",
    travelTime: "15 min",
  },
  {
    id: "3",
    time: "14:00",
    duration: "1h30",
    client: "M. Bernard",
    address: "8 place Bellecour, 69002 Lyon",
    status: "r2_prestudy" as RdvStatus,
    type: "Photovoltaïque",
    distance: "45 km",
    travelTime: "50 min",
    alert: true,
  },
  {
    id: "4",
    time: "17:00",
    duration: "1h",
    client: "Mme Leroy",
    address: "23 rue de la République, 69003 Lyon",
    status: "signe" as RdvStatus,
    type: "Isolation",
    distance: "3 km",
    travelTime: "10 min",
  },
];

const Planning = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("jour");
  const [currentDate, setCurrentDate] = useState(new Date());

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (viewMode === "jour") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
    } else if (viewMode === "semaine") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const openNavigation = (address: string) => {
    const encoded = encodeURIComponent(address);
    // Essayer d'ouvrir Waze, sinon Google Maps
    window.open(`https://waze.com/ul?q=${encoded}&navigate=yes`, "_blank");
  };

  return (
    <MobileLayout title="Planning">
      <div className="p-4 space-y-4">
        {/* Sélecteur de vue */}
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="jour">Jour</TabsTrigger>
            <TabsTrigger value="semaine">Semaine</TabsTrigger>
            <TabsTrigger value="mois">Mois</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Navigation date */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate("prev")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-base font-semibold text-foreground capitalize">
            {formatDate(currentDate)}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate("next")}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Distance totale */}
        <Card className="bg-muted/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Car className="h-4 w-4" />
                <span>Distance totale</span>
              </div>
              <span className="font-semibold text-foreground">71 km</span>
            </div>
          </CardContent>
        </Card>

        {/* Liste des RDV */}
        <div className="space-y-3">
          {planningData.map((rdv, index) => (
            <div key={rdv.id} className="relative">
              {/* Ligne de trajet entre les RDV */}
              {index > 0 && (
                <div className="absolute -top-3 left-6 flex items-center gap-2 text-xs text-muted-foreground bg-background px-2 py-1 rounded z-10">
                  <Car className="h-3 w-3" />
                  <span>{rdv.travelTime}</span>
                  <span>•</span>
                  <span>{rdv.distance}</span>
                </div>
              )}

              <Card
                className={`shadow-card overflow-hidden ${
                  rdv.alert
                    ? "border-secondary/50 bg-secondary/5"
                    : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      {/* Heure et statut */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-primary font-semibold">
                          <Clock className="h-4 w-4" />
                          <span>{rdv.time}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          ({rdv.duration})
                        </span>
                        <StatusBadge status={rdv.status} />
                      </div>

                      {/* Client et type */}
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {rdv.client}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {rdv.type}
                        </p>
                      </div>

                      {/* Adresse */}
                      <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <span>{rdv.address}</span>
                      </div>

                      {/* Alerte trajet */}
                      {rdv.alert && (
                        <p className="text-xs text-secondary font-medium">
                          ⚠️ Trajet long - Prévoir du temps
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-full"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="h-9 w-9 rounded-full bg-gradient-hero"
                        onClick={() => openNavigation(rdv.address)}
                      >
                        <Navigation className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        {/* Info trajet retour */}
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="text-sm text-center text-muted-foreground">
              📍 Distance 1er RDV demain depuis dernier RDV :{" "}
              <span className="font-semibold text-foreground">32 km</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default Planning;
