import { afterEach, describe, expect, it, vi } from "vitest";
import { captureStill } from "./stillCapture";

afterEach(() => vi.unstubAllGlobals());

function video(width = 1920, height = 1080, readyState = 2) {
  return { videoWidth: width, videoHeight: height, readyState } as HTMLVideoElement;
}
function canvas() {
  const drawImage = vi.fn();
  const toDataURL = vi.fn(() => "data:image/jpeg;base64,frame");
  return { width: 0, height: 0, getContext: () => ({ drawImage }), toDataURL };
}

describe("Safari video capture fallback", () => {
  it("rejects a frame without dimensions before it can become a PDF page", async () => {
    const c = canvas();
    await expect(captureStill(null, video(0, 0), c as unknown as HTMLCanvasElement)).rejects.toThrow();
    expect(c.toDataURL).not.toHaveBeenCalled();
  });
  it("rejects undecoded pixels even when metadata dimensions are present", async () => {
    const c = canvas();
    await expect(captureStill(null, video(1920, 1080, 1), c as unknown as HTMLCanvasElement)).rejects.toThrow();
    expect(c.toDataURL).not.toHaveBeenCalled();
  });
  it("captures decoded video at its full negotiated resolution without ImageCapture", async () => {
    const c = canvas();
    const result = await captureStill(null, video(), c as unknown as HTMLCanvasElement);
    expect(result).toMatchObject({ width: 1920, height: 1080, source: "video", matchesPreviewFraming: true });
    expect(c.width).toBe(1920);
    expect(c.height).toBe(1080);
  });
  it("falls back to the video when the sensor photo fails", async () => {
    vi.stubGlobal("ImageCapture", class { async takePhoto() { throw new Error("unavailable"); } });
    const result = await captureStill({} as MediaStreamTrack, video(), canvas() as unknown as HTMLCanvasElement);
    expect(result.source).toBe("video");
  });
});