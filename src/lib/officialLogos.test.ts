import { describe, it, expect } from "vitest";
import { areOfficialLogosEnabled, setOfficialLogosEnabled } from "./officialLogos";
describe("official logos", () => {
  it("are off by default (HEJJA inactive)", () => { expect(areOfficialLogosEnabled()).toBe(false); });
  it("follow the HEJJA flag", () => { setOfficialLogosEnabled(true); expect(areOfficialLogosEnabled()).toBe(true); setOfficialLogosEnabled(false); expect(areOfficialLogosEnabled()).toBe(false); });
});
