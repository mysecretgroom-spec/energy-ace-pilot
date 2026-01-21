import { MobileLayout } from "@/components/layout/MobileLayout";
import { StatusBadge, RdvStatus } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  MapPin,
  Clock,
  Phone,
  Navigation,
  TrendingUp,
  Users,
  FileCheck,
  AlertCircle,
  ChevronRight,
  Sun,
} from "lucide-react";
import { Link } from "react-router-dom";

// Données de démonstration
const todayRdv = [
  {
    id: "1",
    time: "09:00",
    client: "M. Dupont",
    address: "12 rue de la Paix, Lyon",
    status: "nouveau" as RdvStatus,
    type: "Photovoltaïque",
  },
  {
    id: "2",
    time: "11:30",
    client: "Mme Martin",
    address: "45 avenue Victor Hugo, Villeurbanne",
    status: "r2" as RdvStatus,
    type: "Pompe à chaleur",
  },
  {
    id: "3",
    time: "14:00",
    client: "M. Bernard",
    address: "8 place Bellecour, Lyon",
    status: "r2_prestudy" as RdvStatus,
    type: "Photovoltaïque",
  },
];

const stats = {
  rdvToday: 3,
  rdvWeek: 12,
  signedMonth: 4,
  pendingStudies: 2,
};

const alerts = [
  {
    id: "1",
    type: "warning",
    message: "RDV de 14h éloigné de 45km - prévoir temps de trajet",
  },
  {
    id: "2",
    type: "info",
    message: "R2 à confirmer pour Mme Martin demain",
  },
];

const Index = () => {
  const currentDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <MobileLayout>
      <div className="p-4 space-y-6">
        {/* Header avec date */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground capitalize">
              {currentDate}
            </p>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Bonjour 👋
            </h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-gradient-hero">
            <Sun className="h-4 w-4 text-primary-foreground" />
            <span className="text-sm font-medium text-primary-foreground">
              SolarFlow
            </span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.rdvToday}
                  </p>
                  <p className="text-xs text-muted-foreground">RDV aujourd'hui</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <TrendingUp className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.signedMonth}
                  </p>
                  <p className="text-xs text-muted-foreground">Signés ce mois</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent">
                  <Users className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.rdvWeek}
                  </p>
                  <p className="text-xs text-muted-foreground">RDV semaine</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-status-r2-prestudy/10">
                  <FileCheck className="h-5 w-5 text-status-r2-prestudy" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.pendingStudies}
                  </p>
                  <p className="text-xs text-muted-foreground">Études en cours</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alertes */}
        {alerts.length > 0 && (
          <Card className="border-secondary/30 bg-secondary/5 shadow-card">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <p
                      key={alert.id}
                      className="text-sm text-foreground leading-relaxed"
                    >
                      {alert.message}
                    </p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* RDV du jour */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold text-foreground">
              RDV du jour
            </h2>
            <Link to="/planning">
              <Button variant="ghost" size="sm" className="text-primary">
                Voir tout
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="space-y-3">
            {todayRdv.map((rdv, index) => (
              <Card
                key={rdv.id}
                className="shadow-card overflow-hidden animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-primary font-medium">
                          <Clock className="h-4 w-4" />
                          <span>{rdv.time}</span>
                        </div>
                        <StatusBadge status={rdv.status} />
                      </div>

                      <div>
                        <h3 className="font-semibold text-foreground">
                          {rdv.client}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {rdv.type}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{rdv.address}</span>
                      </div>
                    </div>

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
                      >
                        <Navigation className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Bouton Hôtel */}
        <Card className="shadow-card bg-gradient-dark text-primary-foreground">
          <CardContent className="p-4">
            <Button
              variant="secondary"
              className="w-full font-semibold"
              onClick={() => {
                // Redirection Booking.com avec ville du 1er RDV J+1
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const checkIn = new Date().toISOString().split("T")[0];
                const checkOut = tomorrow.toISOString().split("T")[0];
                window.open(
                  `https://www.booking.com/searchresults.fr.html?ss=Lyon&checkin=${checkIn}&checkout=${checkOut}`,
                  "_blank"
                );
              }}
            >
              🏨 Trouver un hôtel pour ce soir
            </Button>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default Index;
