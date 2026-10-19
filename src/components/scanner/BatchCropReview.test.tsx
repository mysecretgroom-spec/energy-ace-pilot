import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BatchCropReview } from "./BatchCropReview";
import { autoCropPage } from "./services/scanPipeline";

vi.mock("./services/scanPipeline", () => ({ autoCropPage: vi.fn() }));
vi.mock("./CropEditor", () => ({ CropEditor: () => null }));

describe("burst review preserves the selected images", () => {
  it("confirms all cropped pages but preserves an original when its crop is cancelled", async () => {
    vi.mocked(autoCropPage).mockImplementation(async (original) => ({
      corners: { topLeft: { x: 0, y: 0 }, topRight: { x: 1, y: 0 }, bottomRight: { x: 1, y: 1 }, bottomLeft: { x: 0, y: 1 } },
      image: `${original}-crop`, thumbnail: `${original}-thumb`,
    }));
    const onDone = vi.fn();
    const view = render(<BatchCropReview images={["first", "second"]} onDone={onDone} onCancel={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Tout valider/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Original" }));
    fireEvent.click(screen.getByRole("button", { name: /Tout valider/ }));
    expect(onDone.mock.calls[0][0].map((page: { imageData: string; cropped: boolean }) => [page.imageData, page.cropped]))
      .toEqual([["first", false], ["second-crop", true]]);
    view.unmount();
  });

  it("cannot confirm a batch while any page is still processing", async () => {
    let resolvePage: ((value: Awaited<ReturnType<typeof autoCropPage>>) => void) | undefined;
    vi.mocked(autoCropPage).mockImplementation(() => new Promise((resolve) => { resolvePage = resolve; }));
    const onDone = vi.fn();
    const view = render(<BatchCropReview images={["pending"]} onDone={onDone} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Préparation/ }));
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => resolvePage?.({ corners: null, image: "pending", thumbnail: "thumb" }));
    fireEvent.click(screen.getByRole("button", { name: /Tout valider/ }));
    expect(onDone.mock.calls[0][0][0].imageData).toBe("pending");
    view.unmount();
  });
});