import { describe, it, expect } from "vitest";
import { prioritizeRdvs, imminentRdvs, type DayPack, type PackRdv } from "./dayPack";

const r = (id: string, iso: string, status = "nouveau") =>
  ({ id, date_heure: iso, duree_minutes: 90, status } as unknown as PackRdv);

describe("préchargement hors-ligne des RDV", () => {
  const now = new Date("2026-10-14T11:00:00.000Z");
  const rdvs = [r("a", "2026-10-14T07:00:00.000Z"), r("b", "2026-10-14T10:30:00.000Z"), r("c", "2026-10-14T14:00:00.000Z"), r("d", "2026-10-15T08:00:00.000Z")];

  it("précharge d'abord le RDV en cours puis le suivant, puis le lendemain", () => {
    expect(prioritizeRdvs(rdvs, now).map((x) => x.id)).toEqual(["b", "c", "d", "a"]);
  });

  it("le RDV imminent et le suivant sont toujours disponibles, annulés exclus", () => {
    const pack: DayPack = { userId: "u", at: 0, ready: [], rdvs: [...rdvs.slice(0, 2), r("c", "2026-10-14T14:00:00.000Z", "annule"), rdvs[3]] };
    expect(imminentRdvs(pack, now).map((x) => x.id)).toEqual(["b", "d"]);
  });
});
