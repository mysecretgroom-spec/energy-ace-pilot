// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const notification = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast: notification }));
import { deliverFile, deliverFiles } from "./fileDelivery";

function setup(touch: boolean, active = true) {
  const share = vi.fn().mockResolvedValue(undefined);
  const click = vi.fn();
  const revoke = vi.fn();
  vi.stubGlobal("window", { matchMedia: () => ({ matches: touch }) });
  vi.stubGlobal("navigator", { share, canShare: () => true, userActivation: { isActive: active } });
  vi.stubGlobal("document", { createElement: () => ({ click, remove: vi.fn() }), body: { appendChild: vi.fn() } });
  vi.stubGlobal("URL", { createObjectURL: () => "blob:download", revokeObjectURL: revoke });
  return { share, click, revoke };
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers(); });
describe("native file delivery", () => {
  it("opens native OS file sharing for a PDF on a touch device", async () => {
    const { share, click } = setup(true);
    await deliverFile(new Blob(["%PDF-1.7"], { type: "application/pdf" }), "rapport.pdf");
    expect(share).toHaveBeenCalledOnce();
    const file = share.mock.calls[0][0].files[0];
    expect(file.name).toBe("rapport.pdf");
    expect(file.type).toBe("application/pdf");
    expect(click).not.toHaveBeenCalled();
  });
  it("requires a fresh Save tap when file preparation exhausted user activation", async () => {
    const { share } = setup(true, false);
    await deliverFile(new Blob(["image"], { type: "image/png" }), "photo.png");
    expect(share).not.toHaveBeenCalled();
    const options = notification.mock.calls[0][1];
    options.action.onClick();
    expect(share).toHaveBeenCalledOnce();
  });
  it("uses browser download on desktop and keeps its URL alive for 30 seconds", async () => {
    vi.useFakeTimers();
    const { share, click, revoke } = setup(false);
    await deliverFile(new Blob(["content"]), "export.csv");
    expect(click).toHaveBeenCalledOnce();
    expect(share).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30_000);
    expect(revoke).toHaveBeenCalledWith("blob:download");
  });
  it("does not download after the user cancels the native sheet", async () => {
    const { share, click } = setup(true);
    share.mockRejectedValueOnce(Object.assign(new Error("Cancelled"), { name: "AbortError" }));
    await deliverFile(new Blob(["pdf"]), "rapport.pdf");
    expect(click).not.toHaveBeenCalled();
    expect(notification.error).not.toHaveBeenCalled();
  });
  it("sends multiple receipts through a single native sheet", async () => {
    const { share } = setup(true);
    await deliverFiles([new File(["a"], "a.pdf"), new File(["b"], "b.pdf")]);
    expect(share).toHaveBeenCalledOnce();
    expect(share.mock.calls[0][0].files).toHaveLength(2);
  });
});