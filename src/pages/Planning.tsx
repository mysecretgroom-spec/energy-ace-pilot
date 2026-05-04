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
import { PullToRefreshContainer } from "@/components/common/PullToRefreshContainer";
import { MonthCalendarView } from "@/components/planning/MonthCalendarView";
import { DayRdvCard } from "@/components/planning/DayRdvCard";
import { RouteMap } from "@/components/planning/RouteMap";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHejjaMode } from "@/hooks/useHejjaMode";
import { usePlanningRoutes } from "@/hooks/usePlanningRoutes";
import { useWorkingDays } from "@/hooks/useWorkingDays";
import { useOfflineData } from "@/hooks/useOfflineData";
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
  Building2,
  Filter,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Regie {
  id: string;
  nom: string;
  couleur: string | null;
  is_hejja: boolean;
}

type ViewMode = "jour" | "semaine" | "mois";

type RdvType = 'standard' | 'external_installation' | 'installation';

interface RdvData {
  id: string;
  date: Date;
  time: string;
  duration: string;
  client: string;
  clientPrenom?: string;
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
  regieId?: string | null;
  regieNom?: string | null;
  regieCouleur?: string | null;
  isDuplicateClient?: boolean;
  needsReconfirmation?: boolean;
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
  const { isActive: modeHejjaActive } = useHejjaMode();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("semaine");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [rdvList, setRdvList] = useState<RdvData[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickRdvOpen, setQuickRdvOpen] = useState(false);
  const [selectedRdv, setSelectedRdv] = useState<RdvData | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [regies, setRegies] = useState<Regie[]>([]);
  const [selectedRegieId, setSelectedRegieId] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Use planning routes hook for day view distances
  const { 
    rdvs: routeRdvs, 
    loading: routesLoading, 
    totalDistance, 
    tomorrowFirstDistance,
    refetch: refetchRoutes 
  } = usePlanningRoutes(currentDate);

  // Use working days settings
  const { workingDays } = useWorkingDays();

  // Use offline data hook - triggerCacheRefresh is called manually after initial load
  const { isOnline, cacheRdvList, getCachedRdvList, getCachedRegiesList, cacheRegiesList, triggerCacheRefresh } = useOfflineData();

  // Fetch regies (with offline fallback)
  useEffect(() => {
    const fetchRegies = async () => {
      if (!user) return;
      
      if (!isOnline) {
        // Use cached regies when offline
        const cachedRegies = await getCachedRegiesList();
        if (cachedRegies.length > 0) {
          setRegies(cachedRegies);
          return;
        }
      }

      const { data } = await supabase
        .from("regies")
        .select("id, nom, couleur, is_hejja, siret")
        .eq("user_id", user.id)
        .eq("actif", true)
        .order("nom");
      if (data) {
        const regiesForCache = data.map(r => ({ 
          id: r.id,
          nom: r.nom,
          couleur: r.couleur,
          siret: r.siret || null,
          is_hejja: r.is_hejja ?? false 
        }));
        setRegies(regiesForCache.map(r => ({ id: r.id, nom: r.nom, couleur: r.couleur, is_hejja: r.is_hejja })));
        // Cache regies for offline use
        await cacheRegiesList(regiesForCache);
      }
    };
    fetchRegies();
  }, [user, isOnline, getCachedRegiesList, cacheRegiesList]);

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

  // Parse address to extract street, postal code and city - memoized to avoid re-renders
  const parseAddress = useCallback((fullAddress: string | null) => {
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
  }, []);

  const fetchRdvs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setIsOfflineMode(false);

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

      // Helper function to transform raw data to RdvData
      const transformRdvData = (data: Record<string, unknown>[]): RdvData[] => {
        return data.map((rdv) => {
          const dateHeure = new Date(rdv.date_heure as string);
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
          
          const regieData = rdv.regies as {
            id: string;
            nom: string;
            couleur: string | null;
          } | null;

          // Use RDV address first, fall back to client address
          const rdvAddress = (rdv.adresse as string) || "";
          const parsed = parseAddress(rdvAddress);
          
          // Prefer RDV address (appointment location), fall back to client home address
          const finalAddress = rdvAddress ? parsed.address : (clientData?.adresse || "");
          const finalPostalCode = rdvAddress ? parsed.postalCode : (clientData?.code_postal || "");
          const finalCity = rdvAddress ? parsed.city : (clientData?.ville || "");

          const durationMinutes = (rdv.duree_minutes as number) || 90;
          const hours = Math.floor(durationMinutes / 60);
          const mins = durationMinutes % 60;
          const durationStr = hours > 0 
            ? (mins > 0 ? `${hours}h${mins}` : `${hours}h`)
            : `${mins} min`;

          return {
            id: rdv.id as string,
            date: dateHeure,
            time: dateHeure.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
            duration: durationStr,
            client: clientData?.prenom 
              ? `${clientData.prenom} ${clientData.nom}`
              : clientData?.nom || "Inconnu",
            clientPrenom: clientData?.prenom || undefined,
            clientId: clientData?.id || "",
            phone: clientData?.telephone || null,
            address: finalAddress,
            city: finalCity,
            postalCode: finalPostalCode,
            status: rdv.status as RdvStatus,
            type: projectTypeLabels[rdv.type_projet as string] || (rdv.type_projet as string),
            typeRdv: ((rdv.type_rdv as RdvType) || 'standard'),
            distance: undefined,
            travelTime: undefined,
            alert: false,
            isR2: (rdv.is_r2 as boolean) || false,
            r2Type: rdv.r2_type as string | null,
            etudeId: rdv.etude_id as string | null,
            latitude: (rdv.latitude as number) || clientData?.latitude || undefined,
            longitude: (rdv.longitude as number) || clientData?.longitude || undefined,
            regieId: regieData?.id || null,
            regieNom: regieData?.nom || null,
            regieCouleur: regieData?.couleur || null,
            isDuplicateClient: !!(rdv.metadata as any)?.is_duplicate_client,
            needsReconfirmation: (rdv.needs_reconfirmation as boolean) || false,
          };
        });
      };

      // Check if we're offline - use cached data
      if (!isOnline) {
        console.log("[Planning] Offline mode - using cached RDVs");
        const cachedRdvs = await getCachedRdvList();
        
        // Filter cached RDVs by date range
        const filteredCached = cachedRdvs.filter(rdv => {
          const rdvDate = new Date(rdv.date_heure as string);
          return rdvDate >= startDate && rdvDate <= endDate;
        });

        // Apply regie filter if selected
        const regieFilteredCached = selectedRegieId
          ? filteredCached.filter(rdv => rdv.regie_id === selectedRegieId)
          : filteredCached;

        const transformedRdvs = transformRdvData(regieFilteredCached);
        setRdvList(transformedRdvs);
        setIsOfflineMode(true);
        setLoading(false);
        return;
      }

      let query = supabase
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
          regie_id,
          metadata,
          needs_reconfirmation,
          regies(
            id,
            nom,
            couleur
          ),
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

      // Apply regie filter if selected
      if (selectedRegieId) {
        query = query.eq("regie_id", selectedRegieId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching RDVs:", error);
        // Fallback to cache on error
        const cachedRdvs = await getCachedRdvList();
        if (cachedRdvs.length > 0) {
          const filteredCached = cachedRdvs.filter(rdv => {
            const rdvDate = new Date(rdv.date_heure as string);
            return rdvDate >= startDate && rdvDate <= endDate;
          });
          setRdvList(transformRdvData(filteredCached));
          setIsOfflineMode(true);
        }
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setRdvList([]);
        setLoading(false);
        return;
      }

      // Cache RDVs for offline use
      await cacheRdvList(data);

      // Filter out cancelled RDVs and handle postponed RDVs
      // For postponed RDVs: hide them if a follow-up RDV exists for the same client
      const postponedClientIds = data
        .filter(rdv => rdv.status === "reporte")
        .map(rdv => (rdv.clients as { id: string }).id);

      // Check if there are follow-up RDVs for postponed clients (non-reporte, non-annule status)
      const clientsWithFollowUp = new Set<string>();
      data.forEach(rdv => {
        const clientId = (rdv.clients as { id: string }).id;
        if (postponedClientIds.includes(clientId) && 
            rdv.status !== "reporte" && 
            rdv.status !== "annule" &&
            rdv.status !== "porte") {
          clientsWithFollowUp.add(clientId);
        }
      });

      // Filter: exclude annule, and exclude reporte if a follow-up exists
      const filteredData = data.filter(rdv => {
        // Always exclude cancelled RDVs
        if (rdv.status === "annule" || rdv.status === "porte") return false;
        
        // For postponed RDVs: hide if a follow-up RDV exists for this client
        if (rdv.status === "reporte") {
          const clientId = (rdv.clients as { id: string }).id;
          return !clientsWithFollowUp.has(clientId);
        }
        
        return true;
      });

      // Transform data using the helper function
      const transformedRdvs = transformRdvData(filteredData as Record<string, unknown>[]);

      setRdvList(transformedRdvs);
    } catch (err) {
      console.error("Error in fetchRdvs:", err);
      // On error, try cache - transformRdvData is defined earlier in this function
    } finally {
      setLoading(false);
      // Trigger background cache refresh after initial load completes
      // This won't interfere with display since data is already loaded
      triggerCacheRefresh();
    }
  }, [user, currentDate, viewMode, selectedRegieId, isOnline, getCachedRdvList, cacheRdvList, parseAddress, triggerCacheRefresh]);

  // Filter regies for display (hide hejja regies outside of hejja mode)
  const filteredRegies = modeHejjaActive 
    ? regies 
    : regies.filter(r => !r.is_hejja);

  // Filter RDVs to hide hejja regie RDVs outside of hejja mode
  const filteredRdvList = modeHejjaActive
    ? rdvList
    : rdvList.filter(rdv => {
        if (!rdv.regieId) return true;
        const regie = regies.find(r => r.id === rdv.regieId);
        return !regie?.is_hejja;
      });

  // Merge route data with rdvList for day view
  const rdvListWithRoutes: RdvData[] = viewMode === "jour" && routeRdvs.length > 0
    ? filteredRdvList.map((rdv) => {
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
    : filteredRdvList;

  useEffect(() => {
    fetchRdvs();
  }, [fetchRdvs]);

  return (
    <MobileLayout title="Planning">
      <PullToRefreshContainer onRefresh={fetchRdvs}>
      <div className="p-4 space-y-4 pb-32 sm:pb-28 max-w-5xl mx-auto">
        {/* Sélecteur de vue - responsive sizing */}
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-3 h-12 sm:h-10">
            <TabsTrigger value="jour" className="text-sm sm:text-base h-10 sm:h-8 touch-action-manipulation">Jour</TabsTrigger>
            <TabsTrigger value="semaine" className="text-sm sm:text-base h-10 sm:h-8 touch-action-manipulation">Semaine</TabsTrigger>
            <TabsTrigger value="mois" className="text-sm sm:text-base h-10 sm:h-8 touch-action-manipulation">Mois</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Navigation date */}
        <div className="flex items-center justify-between py-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate("prev")}
            className="h-12 w-12 sm:h-10 sm:w-10 active:scale-95 transition-transform"
          >
            <ChevronLeft className="h-6 w-6 sm:h-5 sm:w-5" />
          </Button>
          <h2 className="text-base sm:text-lg font-semibold text-foreground capitalize text-center flex-1">
            {formatDateHeader(currentDate)}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate("next")}
            className="h-12 w-12 sm:h-10 sm:w-10 active:scale-95 transition-transform"
          >
            <ChevronRight className="h-6 w-6 sm:h-5 sm:w-5" />
          </Button>
        </div>

        {/* Indicateur mode hors-ligne */}
        {isOfflineMode && (
          <div className="flex items-center justify-center gap-2 py-2 px-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-400">
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">Mode hors-ligne - données en cache</span>
          </div>
        )}

        {/* Header stats et filtre régie - responsive layout */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Car className="h-5 w-5" />
              <span className="font-medium">{rdvListWithRoutes.filter(r => r.status !== 'annule' && r.status !== 'reporte' && r.status !== 'porte').length} RDV</span>
            </div>
            {viewMode === "jour" && totalDistance > 0 && (
              <div className="flex items-center gap-2 text-primary font-medium text-sm">
                <Route className="h-4 w-4" />
                <span>{totalDistance} km</span>
              </div>
            )}
          </div>
          
          {/* Actions regroupées - responsive wrap */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Filtre Régie */}
            {filteredRegies.length > 0 && (
              <Select
                value={selectedRegieId || "all"}
                onValueChange={(value) => setSelectedRegieId(value === "all" ? null : value)}
              >
                <SelectTrigger className="w-[140px] sm:w-[180px] h-10 sm:h-9">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Régie" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {filteredRegies.map((regie) => (
                    <SelectItem key={regie.id} value={regie.id}>
                      <div className="flex items-center gap-2">
                        {regie.couleur && (
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: regie.couleur }}
                          />
                        )}
                        {regie.nom}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {viewMode === "jour" && rdvListWithRoutes.length > 0 && (
              <Button
                variant={showMap ? "default" : "ghost"}
                size="icon"
                onClick={() => setShowMap(!showMap)}
                className="h-10 w-10 sm:h-9 sm:w-9"
              >
                <Map className="h-5 w-5" />
              </Button>
            )}
            <GoogleCalendarSync onSyncComplete={() => { fetchRdvs(); refetchRoutes(); }} />
            <GmailSync onSyncComplete={() => { fetchRdvs(); refetchRoutes(); }} />
          </div>
        </div>

        {/* FAB Nouveau RDV - responsive positioning */}
        <Dialog open={quickRdvOpen} onOpenChange={setQuickRdvOpen}>
          <DialogTrigger asChild>
            <Button 
              size="lg" 
              className="fixed bottom-[calc(72px+env(safe-area-inset-bottom)+4rem)] left-4 z-30 h-14 w-14 rounded-full shadow-lg bg-gradient-hero active:scale-95 transition-transform sm:bottom-[calc(72px+env(safe-area-inset-bottom)+0.5rem)] sm:left-auto sm:right-4"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md p-0 max-h-[90vh] overflow-y-auto">
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
            workingDays={workingDays}
            onRdvClick={handleCalendarRdvClick}
            onDayClick={handleDayClick}
            onStatusChange={() => fetchRdvs()}
            onRefresh={() => fetchRdvs()}
          />
        )}

        {/* Month Calendar View */}
        {!loading && viewMode === "mois" && (
          <MonthCalendarView
            currentDate={currentDate}
            rdvList={rdvList}
            workingDays={workingDays}
            onDayClick={handleDayClick}
          />
        )}

        {/* Liste des RDV (only in day view) */}
        {!loading && viewMode === "jour" && rdvListWithRoutes.length > 0 && (
          <div className="space-y-4">
            {rdvListWithRoutes.map((rdv, index) => (
              <DayRdvCard
                key={rdv.id}
                rdv={rdv}
                index={index}
                onRefresh={() => { fetchRdvs(); refetchRoutes(); }}
                onBeforeNavigate={() => setShowMap(false)}
              />
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
                        <span>{tomorrowFirstDistance.duration_minutes < 60 ? `${Math.round(tomorrowFirstDistance.duration_minutes)} min` : `${Math.floor(tomorrowFirstDistance.duration_minutes / 60)}h${Math.round(tomorrowFirstDistance.duration_minutes % 60) > 0 ? String(Math.round(tomorrowFirstDistance.duration_minutes % 60)).padStart(2, "0") : ""}`}</span>
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
      </PullToRefreshContainer>
    </MobileLayout>
  );
};

export default Planning;
