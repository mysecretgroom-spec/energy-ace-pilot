// =============================================================
// Security tests for whatsapp-agent payload validation.
//
// Verifies that the Zod schema rejects hostile / malformed payloads
// before they reach the 12k-line orchestration code.
//
// Run via: deno test supabase/functions/whatsapp-agent/_validation.test.ts
// =============================================================

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateAgentRequest, LIMITS } from "./_validation.ts";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function basePayload(extra: Record<string, unknown> = {}) {
  return {
    messageId: "msg_1",
    userId: VALID_UUID,
    userName: "Dylan",
    fromNumber: "+33612345678",
    messageType: "text",
    content: "salut",
    ...extra,
  };
}

Deno.test("accepts a minimal valid text payload", () => {
  const r = validateAgentRequest(basePayload());
  assert(r.ok, `expected ok, got ${JSON.stringify((r as any).body)}`);
});

Deno.test("accepts a web_chat with mediaFiles", () => {
  const r = validateAgentRequest(basePayload({
    fromNumber: "web_chat",
    messageType: "multi_media",
    mediaFiles: [
      { url: "https://example.com/a.jpg", name: "a.jpg", contentType: "image/jpeg" },
    ],
  }));
  assert(r.ok);
});

// ===== Injection / hostile payloads =====

Deno.test("rejects unknown fields (prototype-pollution-style)", () => {
  const r = validateAgentRequest(basePayload({ __proto__: { polluted: true }, isAdmin: true }));
  assert(!r.ok);
});

Deno.test("rejects non-UUID userId", () => {
  const r = validateAgentRequest(basePayload({ userId: "'; DROP TABLE users; --" }));
  assert(!r.ok);
  assert((r as any).body.details.userId);
});

Deno.test("rejects javascript: mediaUrl (XSS / SSRF surface)", () => {
  const r = validateAgentRequest(basePayload({
    messageType: "image",
    mediaUrl: "javascript:alert(1)",
  }));
  assert(!r.ok);
});

Deno.test("rejects data: mediaUrl", () => {
  const r = validateAgentRequest(basePayload({
    messageType: "image",
    mediaUrl: "data:image/png;base64,AAAA",
  }));
  assert(!r.ok);
});

Deno.test("rejects file:// mediaUrl (local-file SSRF)", () => {
  const r = validateAgentRequest(basePayload({
    messageType: "image",
    mediaUrl: "file:///etc/passwd",
  }));
  assert(!r.ok);
});

Deno.test("rejects MIME with CRLF header injection", () => {
  const r = validateAgentRequest(basePayload({
    messageType: "image",
    mediaUrl: "https://x.test/a.jpg",
    mediaContentType: "image/jpeg\r\nX-Injected: 1",
  }));
  assert(!r.ok);
});

Deno.test("rejects non-base64 audioData (atob bomb)", () => {
  const r = validateAgentRequest(basePayload({
    messageType: "audio",
    audioData: "<<<not base64!!!>>>",
  }));
  assert(!r.ok);
});

Deno.test("rejects oversized content (DoS surface)", () => {
  const r = validateAgentRequest(basePayload({
    content: "a".repeat(LIMITS.CONTENT + 1),
  }));
  assert(!r.ok);
});

Deno.test("rejects oversized audioData (memory DoS)", () => {
  const r = validateAgentRequest(basePayload({
    messageType: "audio",
    audioData: "A".repeat(LIMITS.AUDIO_BASE64 + 1),
  }));
  assert(!r.ok);
});

Deno.test("rejects too many mediaFiles (batch DoS)", () => {
  const files = Array.from({ length: LIMITS.MEDIA_FILES + 1 }, (_, i) => ({
    url: `https://x.test/${i}.jpg`,
    name: `${i}.jpg`,
    contentType: "image/jpeg",
  }));
  const r = validateAgentRequest(basePayload({
    messageType: "multi_image",
    mediaFiles: files,
  }));
  assert(!r.ok);
});

Deno.test("rejects unknown messageType", () => {
  const r = validateAgentRequest(basePayload({ messageType: "exec_shell" }));
  assert(!r.ok);
});

Deno.test("rejects type confusion on userId (object instead of string)", () => {
  const r = validateAgentRequest(basePayload({ userId: { $ne: null } }));
  assert(!r.ok);
});

Deno.test("rejects type confusion on content (array)", () => {
  const r = validateAgentRequest(basePayload({ content: ["a", "b"] }));
  assert(!r.ok);
});

Deno.test("rejects empty messageId", () => {
  const r = validateAgentRequest(basePayload({ messageId: "" }));
  assert(!r.ok);
});

Deno.test("rejects oversized fromNumber", () => {
  const r = validateAgentRequest(basePayload({
    fromNumber: "+" + "9".repeat(LIMITS.FROM_NUMBER + 1),
  }));
  assert(!r.ok);
});

Deno.test("rejects hostile URL inside mediaFiles array", () => {
  const r = validateAgentRequest(basePayload({
    messageType: "multi_image",
    mediaFiles: [
      { url: "https://ok.test/a.jpg", name: "a", contentType: "image/jpeg" },
      { url: "javascript:alert(1)", name: "b", contentType: "image/jpeg" },
    ],
  }));
  assert(!r.ok);
});

Deno.test("returns structured error details for the client", () => {
  const r = validateAgentRequest({});
  assert(!r.ok);
  if (!r.ok) {
    assertEquals(r.status, 400);
    assertEquals(typeof r.body.error, "string");
    assert(typeof r.body.details === "object");
  }
});

Deno.test("strips/rejects null bytes via length+format guard on MIME", () => {
  const r = validateAgentRequest(basePayload({
    messageType: "image",
    mediaUrl: "https://ok.test/a.jpg",
    mediaContentType: "image/\u0000jpeg",
  }));
  assert(!r.ok);
});
