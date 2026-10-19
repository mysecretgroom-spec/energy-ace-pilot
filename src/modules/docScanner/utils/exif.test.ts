// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeOrientation } from "./exif";

afterEach(() => vi.unstubAllGlobals());
describe("native photo orientation", () => {
  it("keeps browser-decoded portrait dimensions without applying EXIF twice", async () => {
    const drawImage = vi.fn();
    const transform = vi.fn();
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage, transform }) };
    vi.stubGlobal("document", { createElement: () => canvas });
    vi.stubGlobal("Image", class {
      naturalWidth = 1800; naturalHeight = 3200;
      onload?: () => void;
      set src(_value: string) { this.onload?.(); }
    });
    const result = await normalizeOrientation(new Blob(["native photo"]));
    expect(result.width).toBe(1800);
    expect(result.height).toBe(3200);
    expect(transform).not.toHaveBeenCalled();
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1800, 3200);
  });
  it("retains the 12 megapixel mobile memory bound", async () => {
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }) };
    vi.stubGlobal("document", { createElement: () => canvas });
    vi.stubGlobal("Image", class {
      naturalWidth = 6000; naturalHeight = 8000;
      onload?: () => void;
      set src(_value: string) { this.onload?.(); }
    });
    const result = await normalizeOrientation(new Blob(["large photo"]));
    expect([result.width, result.height]).toEqual([3000, 4000]);
  });
});