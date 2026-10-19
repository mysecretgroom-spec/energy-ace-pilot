// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { previewKind, resolvePreviewUrl } from "./previewMedia";

describe("media preview sources", () => {
  it("renders a PDF blob from its MIME type rather than treating it as a photo", () => {
    expect(previewKind({ id: "scan", nom: "Scan", url: "blob:local-pdf", mime_type: "application/pdf" })).toBe("pdf");
  });
  it("recognizes signed PDF URLs and image data URLs", () => {
    expect(previewKind({ id: "pdf", nom: "Rapport", url: "https://example.test/rapport.pdf?token=sample" })).toBe("pdf");
    expect(previewKind({ id: "photo", nom: "Photo", url: "data:image/png;base64,AA" })).toBe("image");
  });
  it("preserves local image and PDF data instead of interpreting them as storage paths", async () => {
    expect(await resolvePreviewUrl("data:application/pdf;base64,AA")).toBe("data:application/pdf;base64,AA");
    expect(await resolvePreviewUrl("blob:local-photo")).toBe("blob:local-photo");
  });
});