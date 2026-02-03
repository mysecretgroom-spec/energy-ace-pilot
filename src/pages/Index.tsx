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
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const Index = () => {
  const { user } = useAuth();
  
  const currentDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Fetch today's RDVs
  const { data: todayRdvs = [], isLoading: loadingTodayRdvs } = useQuery({
    queryKey: ["today-rdvs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from("rdv")
        .select(`
          id,
          date_heure,
          adresse,
          status,
          type_projet,
          latitude,
          longitude,
          clients!inner(nom, prenom, ville, code_postal)
        `)
        .eq("user_id", user.id)
        .gte("date_heure", today.toISOString())
        .lt("date_heure", tomorrow.toISOString())
        .order("date_heure", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch tomorrow's first RDV for hotel search
  const { data: tomorrowFirstRdv } = useQuery({
    queryKey: ["tomorrow-first-rdv", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      const { data, error } = await supabase
        .from("rdv")
        .select(`
          id,
          adresse,
          latitude,
          longitude,
          clients!inner(ville, code_postal)
        `)
        .eq("user_id", user.id)
        .gte("date_heure", tomorrow.toISOString())
        .lt("date_heure", dayAfter.toISOString())
        .order("date_heure", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Get the best location for hotel search (last RDV today OR first RDV tomorrow)
  const getHotelSearchLocation = (): { city: string; lat?: number; lon?: number } => {
    // Priority 1: First RDV tomorrow
    if (tomorrowFirstRdv) {
      const client = tomorrowFirstRdv.clients as { ville?: string; code_postal?: string };
      if (client?.ville) {
        return {
          city: client.ville,
          lat: tomorrowFirstRdv.latitude || undefined,
          lon: tomorrowFirstRdv.longitude || undefined,
        };
      }
      // Extract city from address
      if (tomorrowFirstRdv.adresse) {
        const cityMatch = tomorrowFirstRdv.adresse.match(/\d{5}\s+([^,]+)/);
        if (cityMatch) {
          return {
            city: cityMatch[1].trim(),
            lat: tomorrowFirstRdv.latitude || undefined,
            lon: tomorrowFirstRdv.longitude || undefined,
          };
        }
      }
    }

    // Priority 2: Last RDV today
    if (todayRdvs.length > 0) {
      const lastRdv = todayRdvs[todayRdvs.length - 1];
      const client = lastRdv.clients as { ville?: string; code_postal?: string };
      if (client?.ville) {
        return {
          city: client.ville,
          lat: lastRdv.latitude || undefined,
          lon: lastRdv.longitude || undefined,
        };
      }
      // Extract city from address
      if (lastRdv.adresse) {
        const cityMatch = lastRdv.adresse.match(/\d{5}\s+([^,]+)/);
        if (cityMatch) {
          return {
            city: cityMatch[1].trim(),
            lat: lastRdv.latitude || undefined,
            lon: lastRdv.longitude || undefined,
          };
        }
      }
    }

    // Default fallback
    return { city: "France" };
  };

  const openHotelSearch = () => {
    const location = getHotelSearchLocation();
    const checkIn = new Date().toISOString().split("T")[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const checkOut = tomorrow.toISOString().split("T")[0];

    // Use coordinates if available for more precise results
    let bookingUrl = `https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(location.city)}&checkin=${checkIn}&checkout=${checkOut}&group_adults=1&no_rooms=1`;
    
    if (location.lat && location.lon) {
      // Add coordinates for more precise search
      bookingUrl = `https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(location.city)}&checkin=${checkIn}&checkout=${checkOut}&group_adults=1&no_rooms=1&latitude=${location.lat}&longitude=${location.lon}&radius=10`;
    }

    window.open(bookingUrl, "_blank");
  };

  // Format RDVs for display
  const formattedRdvs = todayRdvs.map((rdv) => {
    const dateHeure = new Date(rdv.date_heure);
    const client = rdv.clients as { nom: string; prenom?: string };
    return {
      id: rdv.id,
      time: dateHeure.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      client: client.prenom ? `${client.prenom} ${client.nom}` : client.nom,
      address: rdv.adresse || "Adresse non renseignée",
      status: rdv.status as RdvStatus,
      type: rdv.type_projet || "Projet",
    };
  });

  // Calculate stats
  const stats = {
    rdvToday: todayRdvs.length,
    rdvWeek: 0, // Could add another query for this
    signedMonth: 0,
    pendingStudies: 0,
  };

  const alerts: { id: string; type: string; message: string }[] = [];

  // Get location info for hotel button
  const hotelLocation = getHotelSearchLocation();

  return (
    <MobileLayout>
      <div className="p-4 space-y-6">
        {/* Header avec date */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground capitalize">
              {currentDate}
            </p>
            <h1 className="text-xl font-display font-bold text-foreground">
              Bonjour
            </h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-gradient-hero">
            <Sun className="h-4 w-4 text-primary-foreground" />
            <span className="text-sm font-medium text-primary-foreground">
              DébalePro
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
                    {loadingTodayRdvs ? "-" : stats.rdvToday}
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

          {loadingTodayRdvs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : formattedRdvs.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-6 text-center">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Aucun RDV aujourd'hui</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {formattedRdvs.map((rdv, index) => (
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
          )}
        </div>

        {/* Bouton Hôtel - Now with real location */}
        <Card className="shadow-card bg-gradient-dark text-primary-foreground">
          <CardContent className="p-4">
            <Button
              variant="secondary"
              className="w-full font-semibold"
              onClick={openHotelSearch}
            >
              🏨 Trouver un hôtel près de {hotelLocation.city !== "France" ? hotelLocation.city : "votre prochain RDV"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default Index;
