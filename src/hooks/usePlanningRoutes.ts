import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface RdvWithRoute {
  id: string;
  time: string;
  duration: string;
  client: string;
  address: string;
  status: string;
  type: string;
  distance?: string;
  travelTime?: string;
  alert?: boolean;
  latitude?: number;
  longitude?: number;
  client_id: string;
}

interface RouteInfo {
  distance_km: number;
  duration_minutes: number;
}

export function usePlanningRoutes(date: Date) {
  const { user } = useAuth();
  const [rdvs, setRdvs] = useState<RdvWithRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalDistance, setTotalDistance] = useState(0);
  const [tomorrowFirstDistance, setTomorrowFirstDistance] = useState<RouteInfo | null>(null);

  const projectTypeLabels: Record<string, string> = {
    photovoltaique: "Photovoltaïque",
    pompe_chaleur: "Pompe à chaleur",
    isolation: "Isolation",
    ballon_thermo: "Ballon thermodynamique",
    autre: "Autre",
  };

  const fetchRoutes = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get RDVs for the selected date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: rdvData, error } = await supabase
        .from("rdv")
        .select(`
          id,
          date_heure,
          duree_minutes,
          adresse,
          status,
          type_projet,
          latitude,
          longitude,
          distance_km,
          travel_time_minutes,
          client_id,
          clients!inner(nom, prenom)
        `)
        .eq("user_id", user.id)
        .gte("date_heure", startOfDay.toISOString())
        .lte("date_heure", endOfDay.toISOString())
        .order("date_heure", { ascending: true });

      if (error) {
        console.error("Error fetching RDVs:", error);
        return;
      }

      if (!rdvData || rdvData.length === 0) {
        setRdvs([]);
        setTotalDistance(0);
        setLoading(false);
        return;
      }

      // Filter out cancelled RDVs and handle postponed RDVs
      const postponedClientIds = rdvData
        .filter(rdv => rdv.status === "reporte")
        .map(rdv => rdv.client_id);

      // Check if there are follow-up RDVs for postponed clients
      const clientsWithFollowUp = new Set<string>();
      rdvData.forEach(rdv => {
        if (postponedClientIds.includes(rdv.client_id) && 
            rdv.status !== "reporte" && 
            rdv.status !== "annule") {
          clientsWithFollowUp.add(rdv.client_id);
        }
      });

      // Filter: exclude annule, and exclude reporte if a follow-up exists
      const filteredRdvData = rdvData.filter(rdv => {
        if (rdv.status === "annule") return false;
        if (rdv.status === "reporte") {
          return !clientsWithFollowUp.has(rdv.client_id);
        }
        return true;
      });

      // Process RDVs and calculate routes between consecutive appointments
      const processedRdvs: RdvWithRoute[] = [];
      let totalDist = 0;

      for (let i = 0; i < filteredRdvData.length; i++) {
        const rdv = filteredRdvData[i];
        const dateHeure = new Date(rdv.date_heure);
        const clientData = rdv.clients as { nom: string; prenom?: string };

        let routeInfo: RouteInfo | null = null;

        // If we have coordinates for both current and previous RDV, calculate route
        if (i > 0 && rdv.latitude && rdv.longitude) {
          const prevRdv = filteredRdvData[i - 1];
          if (prevRdv.latitude && prevRdv.longitude) {
            try {
              const response = await supabase.functions.invoke("calculate-route", {
                body: {
                  origin: { lat: prevRdv.latitude, lon: prevRdv.longitude },
                  destination: { lat: rdv.latitude, lon: rdv.longitude },
                },
              });
              if (response.data && !response.error) {
                routeInfo = response.data;
                totalDist += routeInfo.distance_km;
              }
            } catch (err) {
              console.error("Route calculation error:", err);
            }
          }
        }

        // Determine if this is an unrealistic planning (more than 50 min travel time)
        const isAlert = routeInfo ? routeInfo.duration_minutes > 50 : false;

        processedRdvs.push({
          id: rdv.id,
          time: dateHeure.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          duration: `${rdv.duree_minutes || 90} min`,
          client: clientData.prenom 
            ? `${clientData.prenom} ${clientData.nom}`
            : clientData.nom,
          address: rdv.adresse || "Adresse non renseignée",
          status: rdv.status,
          type: projectTypeLabels[rdv.type_projet] || rdv.type_projet,
          distance: routeInfo ? `${routeInfo.distance_km} km` : undefined,
          travelTime: routeInfo ? `${routeInfo.duration_minutes} min` : undefined,
          alert: isAlert,
          latitude: rdv.latitude || undefined,
          longitude: rdv.longitude || undefined,
          client_id: rdv.client_id,
        });
      }

      setRdvs(processedRdvs);
      setTotalDistance(Math.round(totalDist * 10) / 10);

      // Calculate distance from last RDV today to first RDV tomorrow
      if (processedRdvs.length > 0) {
        const lastRdv = processedRdvs[processedRdvs.length - 1];
        if (lastRdv.latitude && lastRdv.longitude) {
          const tomorrow = new Date(date);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);
          const tomorrowEnd = new Date(tomorrow);
          tomorrowEnd.setHours(23, 59, 59, 999);

          const { data: tomorrowRdvs } = await supabase
            .from("rdv")
            .select("id, latitude, longitude")
            .eq("user_id", user.id)
            .gte("date_heure", tomorrow.toISOString())
            .lte("date_heure", tomorrowEnd.toISOString())
            .order("date_heure", { ascending: true })
            .limit(1);

          if (tomorrowRdvs?.[0]?.latitude && tomorrowRdvs[0].longitude) {
            try {
              const response = await supabase.functions.invoke("calculate-route", {
                body: {
                  origin: { lat: lastRdv.latitude, lon: lastRdv.longitude },
                  destination: { lat: tomorrowRdvs[0].latitude, lon: tomorrowRdvs[0].longitude },
                },
              });
              if (response.data && !response.error) {
                setTomorrowFirstDistance(response.data);
              }
            } catch (err) {
              console.error("Tomorrow route error:", err);
            }
          }
        }
      }
    } catch (err) {
      console.error("Planning routes error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, date]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  return {
    rdvs,
    loading,
    totalDistance,
    tomorrowFirstDistance,
    refetch: fetchRoutes,
  };
}
