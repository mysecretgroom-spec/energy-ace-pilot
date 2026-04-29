// Tests for the album-debounce routing logic.
//
// Goal: prove that `decideAlbumRouting` only chooses "extract_rdvs" when
// the leader image is classified as `rdv` (or when ambiguity / album size
// makes the RDV path the safe default), and yields to the single-image
// router otherwise. We also cover `classifyImage` end-to-end against a
// stubbed fetch so we know the leader intent we feed the decision is
// parsed correctly from the classify-image-intent edge function.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyImage,
  decideAlbumRouting,
  type ClassificationResult,
} from "./_image-routing.ts";

// ---------------------------------------------------------------------------
// Pure unit tests — decideAlbumRouting
// ---------------------------------------------------------------------------

const cls = (
  intent: ClassificationResult["intent"],
  confidence: number,
): ClassificationResult => ({ intent, confidence, reason: null });

Deno.test("decideAlbumRouting: single image classified as RDV → extract_rdvs", () => {
  assertEquals(decideAlbumRouting(cls("rdv", 0.95), 1), "extract_rdvs");
});

Deno.test("decideAlbumRouting: single image, finance with high confidence → yield", () => {
  assertEquals(
    decideAlbumRouting(cls("finance", 0.9), 1),
    "yield_to_single_router",
  );
});

Deno.test("decideAlbumRouting: single image, photo_etude high confidence → yield", () => {
  assertEquals(
    decideAlbumRouting(cls("photo_etude", 0.7), 1),
    "yield_to_single_router",
  );
});

Deno.test("decideAlbumRouting: single image, doc_client high confidence → yield", () => {
  assertEquals(
    decideAlbumRouting(cls("doc_client", 0.6), 1),
    "yield_to_single_router",
  );
});

Deno.test("decideAlbumRouting: single image, non-RDV but LOW confidence → extract (safe default)", () => {
  // confidence < 0.5 → keep the historical RDV-first behaviour
  assertEquals(decideAlbumRouting(cls("finance", 0.4), 1), "extract_rdvs");
  assertEquals(decideAlbumRouting(cls("autre", 0.49), 1), "extract_rdvs");
});

Deno.test("decideAlbumRouting: multi-image album always goes through extract_rdvs", () => {
  // Even if the leader image alone looks like finance, an album of >1
  // image is almost always an RDV report → don't yield.
  assertEquals(decideAlbumRouting(cls("finance", 0.99), 3), "extract_rdvs");
  assertEquals(decideAlbumRouting(cls("rdv", 0.8), 2), "extract_rdvs");
  assertEquals(decideAlbumRouting(cls("autre", 0.95), 5), "extract_rdvs");
});

Deno.test("decideAlbumRouting: confidence exactly at 0.5 threshold → yield", () => {
  assertEquals(
    decideAlbumRouting(cls("finance", 0.5), 1),
    "yield_to_single_router",
  );
});

// ---------------------------------------------------------------------------
// Integration test — classifyImage feeding decideAlbumRouting
// We stub global fetch so no network is hit; this verifies that the
// classifier response is correctly mapped to a routing decision.
// ---------------------------------------------------------------------------

function stubFetch(responseBody: unknown, status = 200) {
  const original = globalThis.fetch;
  globalThis.fetch = ((_input: RequestInfo | URL, _init?: RequestInit) => {
    return Promise.resolve(
      new Response(JSON.stringify(responseBody), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

Deno.test("integration: classifier says finance → decision is yield_to_single_router", async () => {
  const restore = stubFetch({
    success: true,
    intent: "finance",
    confidence: 0.92,
    reason: "ticket de caisse",
  });
  try {
    const leader = await classifyImage(
      { base64: "AAAA", contentType: "image/jpeg" },
      "https://example.test",
      "service-key",
    );
    assertEquals(leader.intent, "finance");
    assertEquals(decideAlbumRouting(leader, 1), "yield_to_single_router");
  } finally {
    restore();
  }
});

Deno.test("integration: classifier says rdv → decision is extract_rdvs", async () => {
  const restore = stubFetch({
    success: true,
    intent: "rdv",
    confidence: 0.88,
    reason: "fiche RDV",
  });
  try {
    const leader = await classifyImage(
      { base64: "AAAA", contentType: "image/jpeg" },
      "https://example.test",
      "service-key",
    );
    assertEquals(leader.intent, "rdv");
    assertEquals(decideAlbumRouting(leader, 1), "extract_rdvs");
  } finally {
    restore();
  }
});

Deno.test("integration: classifier HTTP failure → defaults to autre/0 → safe RDV path", async () => {
  const restore = stubFetch({ error: "boom" }, 500);
  try {
    const leader = await classifyImage(
      { base64: "AAAA", contentType: "image/jpeg" },
      "https://example.test",
      "service-key",
    );
    assertEquals(leader.intent, "autre");
    assertEquals(leader.confidence, 0);
    // Confidence 0 < 0.5 → extract_rdvs (safe default, user can cancel via menu)
    assertEquals(decideAlbumRouting(leader, 1), "extract_rdvs");
  } finally {
    restore();
  }
});

Deno.test("integration: multi-image album with finance leader still extracts RDVs", async () => {
  const restore = stubFetch({
    success: true,
    intent: "finance",
    confidence: 0.95,
    reason: "facture",
  });
  try {
    const leader = await classifyImage(
      { base64: "AAAA", contentType: "image/jpeg" },
      "https://example.test",
      "service-key",
    );
    assertEquals(decideAlbumRouting(leader, 4), "extract_rdvs");
  } finally {
    restore();
  }
});
