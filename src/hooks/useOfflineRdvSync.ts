import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { preloadDayPack, getDayPack, PACK_EVENT, type DayPack } from "@/lib/offline/dayPack";
import { flushOutbox, listOutbox, OUTBOX_EVENT } from "@/lib/offline/outbox";

const REFRESH_MS = 15 * 60 * 1000;

/** Précharge le dossier du jour/lendemain et rejoue les écritures en attente. */
export function useOfflineRdvSync() {
  const { user } = useAuth();
  const [outboxCount, setOutboxCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const refresh = () => listOutbox().then((o) => setOutboxCount(o.length));
    const online = async () => { await flushOutbox(); preloadDayPack(user.id); };
    online();
    refresh();
    const t = setInterval(online, REFRESH_MS);
    window.addEventListener("online", online);
    window.addEventListener(OUTBOX_EVENT, refresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", online);
      window.removeEventListener(OUTBOX_EVENT, refresh);
    };
  }, [user]);

  return { outboxCount, flush: flushOutbox };
}

export function useDayPack() {
  const { user } = useAuth();
  const [pack, setPack] = useState<DayPack | undefined>();
  useEffect(() => {
    if (!user) return;
    const load = () => getDayPack(user.id).then(setPack);
    load();
    window.addEventListener(PACK_EVENT, load);
    return () => window.removeEventListener(PACK_EVENT, load);
  }, [user]);
  return pack;
}
