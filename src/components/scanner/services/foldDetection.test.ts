import { describe, it, expect } from "vitest";
import { selectSplitFold } from "./foldDetection";

describe("selectSplitFold", () => {
  it("ignore les froissures excentrées ou faibles", () => {
    expect(selectSplitFold([
      { position: 0.1, direction: "vertical", confidence: 0.9 },
      { position: 0.5, direction: "horizontal", confidence: 0.4 },
    ])).toBeNull();
  });
  it("garde un seul pli central, le plus fiable", () => {
    const f = selectSplitFold([
      { position: 0.45, direction: "vertical", confidence: 0.7 },
      { position: 0.52, direction: "horizontal", confidence: 0.9 },
      { position: 0.2, direction: "vertical", confidence: 1 },
    ]);
    expect(f?.position).toBe(0.52);
  });
});
