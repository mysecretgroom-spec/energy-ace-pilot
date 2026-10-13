import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Phone, MapPin, CloudOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavigationButton } from "./NavigationButton";
import { useDayPack } from "@/hooks/useOfflineRdvSync";
import { imminentRdvs } from "@/lib/offline/dayPack";

/** Infos du RDV en cours et du suivant, lisibles même sans réseau. */
export function NextRdvOfflineCard() {
  const pack = useDayPack();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const list = imminentRdvs(pack, now, 2);
  if (!list.length) return null;

  return (
    <section aria-label="Prochains rendez-vous" className="space-y-2">
      {list.map((r, i) => {
        const c = r.clients;
        const name = [c?.prenom, c?.nom].filter(Boolean).join(" ") || "Client";
        const address = r.adresse || [c?.adresse, c?.code_postal, c?.ville].filter(Boolean).join(" ");
        const phone = c?.telephone || c?.telephone_secondaire;
        const ready = pack?.ready.includes(r.id);
        return (
          <div key={r.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {i === 0 ? "Prochain RDV" : "Ensuite"} · {format(new Date(r.date_heure), "EEE d MMM HH:mm", { locale: fr })}
              </p>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground" title={ready ? "Disponible hors-ligne" : "Préchargement en cours"}>
                {ready ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <CloudOff className="h-3.5 w-3.5" />}
                {ready ? "Hors-ligne OK" : "Partiel"}
              </span>
            </div>
            <p className="mt-1 font-semibold text-foreground">{name}{r.regies?.nom ? <span className="font-normal text-muted-foreground"> · {r.regies.nom}</span> : null}</p>
            {address && <p className="mt-0.5 flex items-start gap-1 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{address}</p>}
            {r.commentaire && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.commentaire}</p>}
            <div className="mt-2 flex gap-2">
              {phone && (
                <Button asChild size="sm" variant="outline" className="gap-1">
                  <a href={`tel:${phone.replace(/\s/g, "")}`}><Phone className="h-4 w-4" />{phone}</a>
                </Button>
              )}
              {address && (
                <NavigationButton address={address} latitude={r.latitude ?? undefined} longitude={r.longitude ?? undefined} size="sm" />
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
