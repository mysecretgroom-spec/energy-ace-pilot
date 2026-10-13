// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWhatsAppNotification } from "./useWhatsAppNotification";

const { from, signatureStudyPdf } = vi.hoisted(() => ({ from: vi.fn(), signatureStudyPdf: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("@/lib/signatureStudyPdf", () => ({ signatureStudyPdf }));

describe("agency signature attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signatureStudyPdf.mockResolvedValue(null);
    vi.stubGlobal("window", { open: vi.fn() });
    vi.stubGlobal("navigator", { share: vi.fn() });
    vi.stubGlobal("document", { createElement: vi.fn() });
    from.mockImplementation((table: string) => {
      const data = table === "regies_contacts" ? { telephone: "+33600000000" } : null;
      const query = {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
      };
      return query;
    });
  });

  it("retains saved CQ and original appointment values even with a custom template", async () => {
    from.mockImplementation((table: string) => {
      const data = table === "regies_contacts" ? { telephone: "+33600000000" }
        : table === "whatsapp_templates" ? { template_text: "📞 *CQ prévu:*\n{{client_name}}\n{{comment}}" }
        : table === "etudes" ? { rdv_id: "initial", cq_date_heure: "2026-10-14T14:45:00", puissance_kwc: 6 }
        : table === "rdv" ? {
          date_heure: "2026-10-12T16:30:00", adresse: "12 rue des Tests",
          commentaire: "Accès par le portail", type_projet: "photovoltaique", duree_minutes: 120,
          parent_rdv_id: null, clients: { nom: "Test", prenom: "Jean", telephone: "0612345678", ville: "Paris", code_postal: "75001" },
        } : null;
      return {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
      };
    });
    const { sendWhatsAppNotification } = useWhatsAppNotification();
    expect(await sendWhatsAppNotification({
      clientName: "Test", classification: "positif", userId: "owner", regieId: "agency", etudeId: "study",
    })).toBe(true);
    const url = new URL(String(vi.mocked(window.open).mock.calls[0]?.[0]));
    const message = url.searchParams.get("text") || "";
    expect(message.indexOf("14 octobre 2026 à 14:45")).toBeGreaterThan(-1);
    expect(message.indexOf("14 octobre 2026 à 14:45")).toBeLessThan(message.indexOf("Commentaire"));
    expect(message.match(/CQ prévu/g)).toHaveLength(1);
    expect(message).not.toContain("Rendez-vous initial");
    for (const value of ["12 rue des Tests", "0612345678", "75001", "Paris"]) expect(message).toContain(value);
  });

  it.each(["r2_prestudy", "negatif"])("never attaches or downloads a PDF for %s", async (classification) => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const share = vi.fn();
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    const createElement = vi.spyOn(document, "createElement");
    const { sendWhatsAppNotification } = useWhatsAppNotification();
    const success = await sendWhatsAppNotification({
      clientName: "Test", classification, userId: "owner", regieId: "agency",
      comment: "Le client souhaite une installation de 6 kWc",
      venteDetails: { consommationKwh: 8500, factureAnnuelleEuros: 1800, puissanceKwc: 6, prixTTC: 26900, mensualiteCredit: 230.78 },
    });
    expect(success).toBe(true);
    const url = new URL(String(open.mock.calls[0]?.[0]));
    expect(url.hostname).toBe("wa.me");
    expect(share).not.toHaveBeenCalled();
    expect(signatureStudyPdf).not.toHaveBeenCalled();
    expect(createElement).not.toHaveBeenCalled();
    open.mockRestore();
    createElement.mockRestore();
  });

  it("shares the signature message and study PDF together", async () => {
    const file = new File(["%PDF-1.7"], "Etude_signature.pdf", { type: "application/pdf" });
    signatureStudyPdf.mockResolvedValue(file);
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: vi.fn().mockReturnValue(true) });
    const success = await useWhatsAppNotification().sendWhatsAppNotification({
      clientName: "Test", classification: "positif", userId: "owner", regieId: "agency",
    });
    expect(success).toBe(true);
    expect(share).toHaveBeenCalledWith({ files: [file], text: expect.stringContaining("VENTE SIGNÉE"), title: "Signature — étude" });
    expect(window.open).not.toHaveBeenCalled();
  });
});