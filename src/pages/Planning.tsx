import { useState, useEffect, useCallback } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { StatusBadge, RdvStatus } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RdvActions } from "@/components/planning/RdvActions";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickRdvForm } from "@/components/planning/QuickRdvForm";
import { GoogleCalendarSync } from "@/components/planning/GoogleCalendarSync";
import { GmailSync } from "@/components/planning/GmailSync";
import { WeekCalendarView } from "@/components/planning/WeekCalendarView";
import { MonthCalendarView } from "@/components/planning/MonthCalendarView";
import { RouteMap } from "@/components/planning/RouteMap";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlanningRoutes } from "@/hooks/usePlanningRoutes";
import {
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Car,
  CalendarX,
  Plus,
  RefreshCw,
  FileText,
  Wrench,
  Route,
  ArrowRight,
  Map,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

type ViewMode = "jour" | "semaine" | "mois";

type RdvType = 'standard' | 'external_installation';

interface RdvData {
  id: string;
  date: Date;
  time: string;
  duration: string;
  client: string;
  clientId: string;
  phone: string | null;
  address: string;
  city: string;
  postalCode: string;
  status: RdvStatus;
  type: string;
  typeRdv: RdvType;
  distance?: string;
  travelTime?: string;
  alert?: boolean;
  isR2?: boolean;
  r2Type?: string | null;
  etudeId?: string | null;
  latitude?: number;
  longitude?: number;
}

const projectTypeLabels: Record<string, string> = {
  photovoltaique: "Photovoltaïque",
  pompe_chaleur: "Pompe à chaleur",
  isolation: "Isolation",
  ballon_thermo: "Ballon thermodynamique",
  autre: "Autre",
};

const Planning = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("semaine");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [rdvList, setRdvList] = useState<RdvData[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickRdvOpen, setQuickRdvOpen] = useState(false);
  const [selectedRdv, setSelectedRdv] = useState<RdvData | null>(null);
  const [showMap, setShowMap] = useState(false);

  // Use planning routes hook for day view distances
  const { 
    rdvs: routeRdvs, 
    loading: routesLoading, 
    totalDistance, 
    tomorrowFirstDistance,
    refetch: refetchRoutes 
  } = usePlanningRoutes(currentDate);

  // Handle click on calendar RDV
  const handleCalendarRdvClick = (rdv: RdvData) => {
    setSelectedRdv(rdv);
    // Navigate to client detail or open RDV actions
    navigate(`/clients/${rdv.clientId}`);
  };

  // Handle click on calendar day (month view)
  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setViewMode("jour");
  };

  const formatDateHeader = (date: Date) => {
    if (viewMode === "jour") {
      return format(date, "EEEE d MMMM", { locale: fr });
    } else if (viewMode === "semaine") {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      return `${format(weekStart, "d", { locale: fr })} - ${format(weekEnd, "d MMMM yyyy", { locale: fr })}`;
    } else {
      return format(date, "MMMM yyyy", { locale: fr });
    }
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

  // Parse address to extract street, postal code and city
  const parseAddress = (fullAddress: string | null) => {
    if (!fullAddress) return { address: "", postalCode: "", city: "" };
    
    // Try to match pattern: "street, postalCode city" or "street postalCode city"
    const match = fullAddress.match(/^(.+?),?\s*(\d{5})\s+(.+)$/);
    if (match) {
      return {
        address: match[1].trim(),
        postalCode: match[2],
        city: match[3].trim(),
      };
    }
    
    return { address: fullAddress, postalCode: "", city: "" };
  };

  const fetchRdvs = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      let startDate: Date;
      let endDate: Date;

      if (viewMode === "jour") {
        startDate = new Date(currentDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(currentDate);
        endDate.setHours(23, 59, 59, 999);
      } else if (viewMode === "semaine") {
        // Start from Monday
        startDate = new Date(currentDate);
        const dayOfWeek = startDate.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startDate.setDate(startDate.getDate() + diff);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Month view
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
      }

      const { data, error } = await supabase
        .from("rdv")
        .select(`
          id,
          date_heure,
          duree_minutes,
          adresse,
          status,
          type_projet,
          type_rdv,
          client_id,
          is_r2,
          r2_type,
          etude_id,
          latitude,
          longitude,
          clients!inner(
            id,
            nom,
            prenom,
            telephone,
            adresse,
            code_postal,
            ville,
            latitude,
            longitude
          )
        `)
        .eq("user_id", user.id)
        .gte("date_heure", startDate.toISOString())
        .lte("date_heure", endDate.toISOString())
        .order("date_heure", { ascending: true });

      if (error) {
        console.error("Error fetching RDVs:", error);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setRdvList([]);
        setLoading(false);
        return;
      }

      // Transform data
      const transformedRdvs: RdvData[] = data.map((rdv) => {
        const dateHeure = new Date(rdv.date_heure);
        const clientData = rdv.clients as {
          id: string;
          nom: string;
          prenom: string | null;
          telephone: string | null;
          adresse: string | null;
          code_postal: string | null;
          ville: string | null;
          latitude: number | null;
          longitude: number | null;
        };

        // Use RDV address or client address
        const rdvAddress = rdv.adresse || clientData.adresse || "";
        const parsed = parseAddress(rdvAddress);
        
        // Prefer client's structured address data if available
        const finalAddress = clientData.adresse || parsed.address;
        const finalPostalCode = clientData.code_postal || parsed.postalCode;
        const finalCity = clientData.ville || parsed.city;

        const durationMinutes = rdv.duree_minutes || 90;
        const hours = Math.floor(durationMinutes / 60);
        const mins = durationMinutes % 60;
        const durationStr = hours > 0 
          ? (mins > 0 ? `${hours}h${mins}` : `${hours}h`)
          : `${mins} min`;

        return {
          id: rdv.id,
          date: dateHeure,
          time: dateHeure.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          duration: durationStr,
          client: clientData.prenom 
            ? `${clientData.prenom} ${clientData.nom}`
            : clientData.nom,
          clientId: clientData.id,
          phone: clientData.telephone,
          address: finalAddress,
          city: finalCity,
          postalCode: finalPostalCode,
          status: rdv.status as RdvStatus,
          type: projectTypeLabels[rdv.type_projet] || rdv.type_projet,
          typeRdv: (rdv.type_rdv as RdvType) || 'standard',
          // Distance/travel time will be merged from routes hook for day view
          distance: undefined,
          travelTime: undefined,
          alert: false,
          isR2: rdv.is_r2 || false,
          r2Type: rdv.r2_type,
          etudeId: rdv.etude_id,
          latitude: rdv.latitude || clientData.latitude || undefined,
          longitude: rdv.longitude || clientData.longitude || undefined,
        };
      });

      setRdvList(transformedRdvs);
    } catch (err) {
      console.error("Error in fetchRdvs:", err);
    } finally {
      setLoading(false);
    }
  }, [user, currentDate, viewMode]);

  // Merge route data with rdvList for day view
  const rdvListWithRoutes: RdvData[] = viewMode === "jour" && routeRdvs.length > 0
    ? rdvList.map((rdv) => {
        const routeRdv = routeRdvs.find((r) => r.id === rdv.id);
        if (routeRdv) {
          return {
            ...rdv,
            distance: routeRdv.distance,
            travelTime: routeRdv.travelTime,
            alert: routeRdv.alert,
          };
        }
        return rdv;
      })
    : rdvList;

  useEffect(() => {
    fetchRdvs();
  }, [fetchRdvs]);

  return (
    <MobileLayout title="Planning">
      <div className="p-4 space-y-4 pb-28">
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
        <div className="flex items-center justify-between py-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate("prev")}
            className="h-12 w-12"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <h2 className="text-base font-semibold text-foreground capitalize">
            {formatDateHeader(currentDate)}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate("next")}
            className="h-12 w-12"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        {/* Header stats simplifié */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              <span className="font-medium">{rdvListWithRoutes.length} RDV</span>
            </div>
            {viewMode === "jour" && totalDistance > 0 && (
              <div className="flex items-center gap-2 text-primary font-medium">
                <Route className="h-5 w-5" />
                <span>{totalDistance} km</span>
              </div>
            )}
          </div>
          
          {/* Actions regroupées */}
          <div className="flex items-center gap-2">
            {viewMode === "jour" && rdvListWithRoutes.length > 0 && (
              <Button
                variant={showMap ? "default" : "ghost"}
                size="icon"
                onClick={() => setShowMap(!showMap)}
              >
                <Map className="h-5 w-5" />
              </Button>
            )}
            <GoogleCalendarSync onSyncComplete={() => { fetchRdvs(); refetchRoutes(); }} />
            <GmailSync onSyncComplete={() => { fetchRdvs(); refetchRoutes(); }} />
          </div>
        </div>

        {/* FAB Nouveau RDV */}
        <Dialog open={quickRdvOpen} onOpenChange={setQuickRdvOpen}>
          <DialogTrigger asChild>
            <Button 
              size="lg" 
              className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full shadow-lg bg-gradient-hero"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
            <QuickRdvForm
              defaultDate={currentDate}
              onSuccess={() => {
                setQuickRdvOpen(false);
                fetchRdvs();
                refetchRoutes();
              }}
              onCancel={() => setQuickRdvOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Carte interactive */}
        {viewMode === "jour" && showMap && rdvListWithRoutes.length > 0 && (
          <RouteMap
            rdvList={rdvListWithRoutes.map(rdv => ({
              id: rdv.id,
              time: rdv.time,
              client: rdv.client,
              address: [rdv.address, rdv.postalCode, rdv.city].filter(Boolean).join(", "),
              status: rdv.status,
              latitude: rdv.latitude,
              longitude: rdv.longitude,
              isR2: rdv.isR2,
              typeRdv: rdv.typeRdv,
            }))}
            onClose={() => setShowMap(false)}
          />
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <Skeleton className="h-9 w-9 rounded-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state (day view only) */}
        {!loading && viewMode === "jour" && rdvListWithRoutes.length === 0 && (
          <Card className="shadow-card">
            <CardContent className="p-8 text-center">
              <CalendarX className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground mb-2">
                Aucun RDV prévu
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Vous n'avez pas de rendez-vous pour cette journée.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => setQuickRdvOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Créer un RDV
                </Button>
                <GmailSync 
                  onSyncComplete={() => { fetchRdvs(); refetchRoutes(); }} 
                  variant="outline"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Week Calendar View */}
        {!loading && viewMode === "semaine" && (
          <WeekCalendarView
            currentDate={currentDate}
            rdvList={rdvList}
            onRdvClick={handleCalendarRdvClick}
            onStatusChange={() => fetchRdvs()}
            onRefresh={() => fetchRdvs()}
          />
        )}

        {/* Month Calendar View */}
        {!loading && viewMode === "mois" && (
          <MonthCalendarView
            currentDate={currentDate}
            rdvList={rdvList}
            onDayClick={handleDayClick}
          />
        )}

        {/* Liste des RDV (only in day view) */}
        {!loading && viewMode === "jour" && rdvListWithRoutes.length > 0 && (
          <div className="space-y-4">
            {rdvListWithRoutes.map((rdv, index) => (
              <div key={rdv.id} className="relative">
                {/* Ligne de trajet entre les RDV */}
                {index > 0 && rdv.travelTime && rdv.distance && (
                  <div className={`flex items-center justify-center gap-3 py-2 mb-2 rounded-lg border border-dashed ${
                    rdv.alert ? "border-secondary bg-secondary/10" : "border-muted-foreground/30 bg-muted/30"
                  }`}>
                    <Car className={`h-4 w-4 ${rdv.alert ? "text-secondary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${rdv.alert ? "text-secondary" : "text-muted-foreground"}`}>
                      {rdv.travelTime}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className={`text-sm font-medium ${rdv.alert ? "text-secondary" : "text-muted-foreground"}`}>
                      {rdv.distance}
                    </span>
                    {rdv.alert && <span className="text-secondary text-xs">⚠️</span>}
                  </div>
                )}

                <Card
                  className={`shadow-card overflow-hidden ${
                    rdv.typeRdv === 'external_installation'
                      ? "border-l-4 border-l-amber-500 bg-amber-500/5"
                      : rdv.isR2
                      ? "border-2 border-status-r2 bg-status-r2/5"
                      : rdv.alert
                      ? "border-secondary/50 bg-secondary/5"
                      : ""
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        {/* Badge Installation Externe */}
                        {rdv.typeRdv === 'external_installation' && (
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-amber-500 text-white text-xs px-2 py-0.5 flex items-center gap-1">
                              <Wrench className="h-3 w-3" />
                              Installation Externe
                            </Badge>
                          </div>
                        )}
                        
                        {/* Badge R2 si applicable */}
                        {rdv.isR2 && (
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-status-r2 text-white text-xs px-2 py-0.5 flex items-center gap-1">
                              <RefreshCw className="h-3 w-3" />
                              {rdv.r2Type === "r2_prestudy" ? "R2 Pré-étude" : "R2"}
                            </Badge>
                            {rdv.etudeId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => navigate(`/etude/edit?etude=${rdv.etudeId}&client=${rdv.clientId}`)}
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Voir étude
                              </Button>
                            )}
                          </div>
                        )}
                        
                        {/* Heure et statut */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className={`flex items-center gap-1.5 font-semibold ${rdv.isR2 ? "text-status-r2" : "text-primary"}`}>
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

                        {/* Adresse complète */}
                        <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                          <span>
                            {[rdv.address, rdv.postalCode, rdv.city]
                              .filter(Boolean)
                              .join(", ") || "Adresse non renseignée"}
                          </span>
                        </div>

                        {/* Alerte trajet */}
                        {rdv.alert && (
                          <p className="text-xs text-secondary font-medium">
                            ⚠️ Trajet long - Prévoir du temps
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <RdvActions
                        rdvId={rdv.id}
                        clientId={rdv.clientId}
                        clientPhone={rdv.phone || undefined}
                        clientName={rdv.client}
                        address={rdv.address}
                        city={rdv.city}
                        postalCode={rdv.postalCode}
                        typeRdv={rdv.typeRdv}
                        currentStatus={rdv.status}
                        etudeId={rdv.etudeId}
                        onRefresh={() => { fetchRdvs(); refetchRoutes(); }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}

            {/* Distance vers le premier RDV du lendemain */}
            {tomorrowFirstDistance && (
              <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      <span>Vers 1er RDV demain</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-primary font-medium">
                        <Car className="h-4 w-4" />
                        <span>{tomorrowFirstDistance.duration_minutes} min</span>
                      </div>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-primary font-medium">{tomorrowFirstDistance.distance_km} km</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default Planning;
