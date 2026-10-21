// @vitest-environment node
import { describe, expect, it } from "vitest";
import { oauthReturnPath } from "./oauth-return-path";
describe("OAuth return paths", () => {
  it("preserves consent query and fragment", () => {
    expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc#request")).toBe("/.lovable/oauth/consent?authorization_id=abc#request");
  });
  it.each(["https://outside.example", "//outside.example", "/\\outside.example", "/a\n", null])("rejects unsafe return %s", value => {
    expect(oauthReturnPath(value)).toBe("/");
  });
});