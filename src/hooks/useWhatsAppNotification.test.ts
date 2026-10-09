import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWhatsAppNotification } from "./useWhatsAppNotification";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));

describe("agency notifications are text only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockImplementation((table: string) => {
      const data = table === "regies_contacts" ? { telephone: "+33600000000" } : null;
      const query = {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
      };
      return query;
    });
  });

  it.each(["positif", "r2_prestudy", "negatif"])("never attaches or downloads a PDF for %s", async (classification) => {
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
    expect(createElement).not.toHaveBeenCalled();
    open.mockRestore();
    createElement.mockRestore();
  });
});