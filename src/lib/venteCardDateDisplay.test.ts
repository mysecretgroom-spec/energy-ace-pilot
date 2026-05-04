// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getVenteCardDateDisplay } from "./venteCardDateDisplay";
import type { VenteStatus } from "./venteStatusConfig";

const base = {
  date_signature: "2026-04-15",
  date_installation_prevue: "2026-05-05",
  date_installation_reelle: null as string | null,
};

describe("getVenteCardDateDisplay", () => {
  const installStatuses: VenteStatus[] = [
    "envoi_pose",
    "en_installation",
    "installe",
    "attente_paiement",
    "paye",
  ];

  it.each(installStatuses)(
    "shows planned install date with 'Pose' label when status=%s and no real date",
    (status) => {
      const r = getVenteCardDateDisplay({ ...base, status });
      expect(r).toEqual({ kind: "install", label: "Pose", date: "2026-05-05" });
    },
  );

  it.each(installStatuses)(
    "prefers real install date with 'Posé' label when present (status=%s)",
    (status) => {
      const r = getVenteCardDateDisplay({
        ...base,
        status,
        date_installation_reelle: "2026-04-29",
      });
      expect(r).toEqual({ kind: "install", label: "Posé", date: "2026-04-29" });
    },
  );

  const signatureStatuses: VenteStatus[] = [
    "en_negociation",
    "signe",
    "cq_a_faire",
    "cq_fait",
    "attente_financement",
    "annule",
    "refus_financement",
    "retracte",
  ];

  it.each(signatureStatuses)(
    "falls back to signature date when status=%s",
    (status) => {
      const r = getVenteCardDateDisplay({
        ...base,
        status,
        date_installation_reelle: "2026-04-29",
      });
      expect(r).toEqual({ kind: "signature", date: "2026-04-15" });
    },
  );

  it("falls back to signature when install statuses have no install date at all", () => {
    const r = getVenteCardDateDisplay({
      status: "envoi_pose",
      date_signature: "2026-04-15",
      date_installation_prevue: null,
      date_installation_reelle: null,
    });
    expect(r).toEqual({ kind: "signature", date: "2026-04-15" });
  });

  it("returns null when neither install date nor signature exists", () => {
    expect(
      getVenteCardDateDisplay({
        status: "en_negociation",
        date_signature: null,
      }),
    ).toBeNull();
  });
});
