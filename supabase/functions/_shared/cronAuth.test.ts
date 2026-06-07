import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { requireCronAuth } from "./cronAuth.ts";

function req(headers: Record<string, string> = {}, method = "POST"): Request {
  return new Request("https://example.test/", { method, headers });
}

Deno.test("cronAuth: rejects when no credentials provided", () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key-aaaa");
  Deno.env.set("CRON_SECRET", "cron-secret-bbb");
  const r = requireCronAuth(req());
  assertEquals(r?.status, 401);
});

Deno.test("cronAuth: accepts Bearer service key", () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key-aaaa");
  Deno.env.set("CRON_SECRET", "cron-secret-bbb");
  const r = requireCronAuth(req({ authorization: "Bearer service-key-aaaa" }));
  assertEquals(r, null);
});

Deno.test("cronAuth: accepts x-cron-secret", () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key-aaaa");
  Deno.env.set("CRON_SECRET", "cron-secret-bbb");
  const r = requireCronAuth(req({ "x-cron-secret": "cron-secret-bbb" }));
  assertEquals(r, null);
});

Deno.test("cronAuth: rejects wrong secret (timing-safe)", () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key-aaaa");
  Deno.env.set("CRON_SECRET", "cron-secret-bbb");
  const r = requireCronAuth(req({ authorization: "Bearer wrong-value-1234" }));
  assertEquals(r?.status, 401);
});

Deno.test("cronAuth: allows OPTIONS preflight", () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "k");
  const r = requireCronAuth(req({}, "OPTIONS"));
  assertEquals(r, null);
});

Deno.test("cronAuth: 503 when nothing configured", () => {
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("CRON_SECRET");
  const r = requireCronAuth(req({ authorization: "Bearer anything" }));
  assertEquals(r?.status, 503);
});
