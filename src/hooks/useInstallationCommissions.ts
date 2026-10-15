import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVenteCommissions } from "@/hooks/useVenteCommissions";

interface RdvLike {
  id: string;
  typeRdv: "standard" | "external_installation" | "installation";
  venteId?: string | null;
}

interface VenteRow {
  id: string;
  montant_ht: number;
  montant_ttc: number;
  puissance_kwc: number | null;
  decom_montant: number | null;
  type_vente: "standard" | "external_installation";
  regie_id: string | null;
  etude_id: string | null;
  status: string;
  product_type: "PV" | "PAC" | "ITE" | null;
  gamme: string | null;
  commission_override: number | null;
}

/**
 * Charge les commissions des ventes liées aux RDV de pose (type_rdv = 'installation').
 * Retourne une Map<rdvId, commissionNette>.
 */
export function useInstallationCommissions(rdvList: RdvLike[], refreshToken?: unknown) {
  const [ventes, setVentes] = useState<VenteRow[]>([]);
  const [rdvToVente, setRdvToVente] = useState<Map<string, string>>(new Map());

  const installationVenteIds = useMemo(() => {
    const ids: { rdvId: string; venteId: string }[] = [];
    rdvList.forEach((r) => {
      if (r.typeRdv === "installation" && r.venteId) {
        ids.push({ rdvId: r.id, venteId: r.venteId });
      }
    });
    return ids;
  }, [rdvList]);

  const idsKey = useMemo(
    () => installationVenteIds.map((x) => x.venteId).sort().join(","),
    [installationVenteIds]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const map = new Map<string, string>();
      installationVenteIds.forEach((x) => map.set(x.rdvId, x.venteId));
      setRdvToVente(map);

      const uniqueIds = [...new Set(installationVenteIds.map((x) => x.venteId))];
      if (uniqueIds.length === 0) {
        setVentes([]);
        return;
      }
      const { data } = await supabase
        .from("ventes")
        .select(
          "id, montant_ht, montant_ttc, puissance_kwc, decom_montant, type_vente, regie_id, etude_id, status, product_type, gamme, commission_override"
        )
        .in("id", uniqueIds);
      if (!cancelled) setVentes((data as VenteRow[]) || []);
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, refreshToken]);

  const venteInputs = useMemo(
    () =>
      ventes.map((v) => ({
        id: v.id,
        montant_ht: Number(v.montant_ht) || 0,
        montant_ttc: Number(v.montant_ttc) || 0,
        puissance_kwc: v.puissance_kwc ? Number(v.puissance_kwc) : null,
        decom_montant: v.decom_montant ? Number(v.decom_montant) : 0,
        type_vente: v.type_vente,
        regie_id: v.regie_id,
        etude_id: v.etude_id,
        status: v.status,
        product_type: v.product_type,
        gamme: v.gamme,
        commission_override: v.commission_override,
      })),
    [ventes]
  );

  const { commissions } = useVenteCommissions(venteInputs);

  const commissionByRdv = useMemo(() => {
    const result = new Map<string, number>();
    rdvToVente.forEach((venteId, rdvId) => {
      const c = commissions.get(venteId);
      if (c) result.set(rdvId, c.commissionNette);
    });
    return result;
  }, [rdvToVente, commissions]);

  const venteStatusByRdv = useMemo(() => {
    const byId = new Map(ventes.map((v) => [v.id, v.status]));
    const result = new Map<string, string>();
    rdvToVente.forEach((venteId, rdvId) => {
      const st = byId.get(venteId);
      if (st) result.set(rdvId, st);
    });
    return result;
  }, [rdvToVente, ventes]);

  return { commissionByRdv, venteStatusByRdv };
}
