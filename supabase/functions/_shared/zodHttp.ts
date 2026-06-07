// =============================================================
// Shared Zod HTTP validation helper for edge functions.
// Goal: identical contract everywhere — parse JSON / formData,
// validate with a schema, return a structured 400 on failure.
//
// Usage:
//   import { z } from "https://esm.sh/zod@3.23.8";
//   import { validateJson, badRequest } from "../_shared/zodHttp.ts";
//
//   const Schema = z.object({ days: z.number().int().min(1).max(90).optional() }).strict();
//   const v = await validateJson(req, Schema, corsHeaders);
//   if (!v.ok) return v.response;
//   const body = v.data;
// =============================================================

// deno-lint-ignore-file no-explicit-any
import { z, ZodError } from "https://esm.sh/zod@3.23.8";

export interface ValidationOk<T> {
  ok: true;
  data: T;
}
export interface ValidationFail {
  ok: false;
  response: Response;
}

export type CorsHeaders = Record<string, string>;

function jsonResponse(body: unknown, status: number, corsHeaders: CorsHeaders): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function badRequest(error: string, details: unknown, corsHeaders: CorsHeaders): Response {
  return jsonResponse({ error, details }, 400, corsHeaders);
}

/**
 * Parse JSON body and validate against a Zod schema.
 * Returns a discriminated union — caller checks `v.ok`.
 *
 * Empty body is allowed when the schema permits it (use defaults).
 */
export async function validateJson<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
  corsHeaders: CorsHeaders,
  { allowEmpty = true }: { allowEmpty?: boolean } = {},
): Promise<ValidationOk<z.infer<T>> | ValidationFail> {
  let raw: unknown = {};
  try {
    const text = await req.text();
    if (text && text.trim().length > 0) {
      raw = JSON.parse(text);
    } else if (!allowEmpty) {
      return { ok: false, response: badRequest("Empty request body", {}, corsHeaders) };
    }
  } catch (_err) {
    return { ok: false, response: badRequest("Invalid JSON body", {}, corsHeaders) };
  }

  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    response: badRequest(
      "Invalid request payload",
      (parsed.error as ZodError).flatten().fieldErrors,
      corsHeaders,
    ),
  };
}

/**
 * Parse application/x-www-form-urlencoded body and validate against a schema.
 * All form values arrive as strings — schemas should `.coerce` numbers if needed.
 */
export async function validateForm<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
  corsHeaders: CorsHeaders,
): Promise<ValidationOk<z.infer<T>> | ValidationFail> {
  let raw: Record<string, string> = {};
  try {
    const fd = await req.formData();
    fd.forEach((value, key) => {
      // Only keep string values (skip file uploads — separate path)
      if (typeof value === "string") raw[key] = value;
    });
  } catch (_err) {
    return { ok: false, response: badRequest("Invalid form body", {}, corsHeaders) };
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    response: badRequest(
      "Invalid form payload",
      (parsed.error as ZodError).flatten().fieldErrors,
      corsHeaders,
    ),
  };
}

// ============================================================
// Common reusable atoms — copy-paste safe across functions.
// ============================================================

/** http(s) URL only (defends against javascript:/data:/file:// SSRF). */
export const httpUrl = z
  .string()
  .max(2048)
  .refine(
    (u) => {
      try {
        const p = new URL(u);
        return p.protocol === "http:" || p.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL must be http(s)" },
  );

/** MIME with no CRLF or null bytes. */
export const mimeType = z
  .string()
  .max(128)
  .regex(/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/, "Invalid MIME type");

/** UUID. */
export const uuidStr = z.string().uuid();

/** Bounded ISO-date (YYYY-MM-DD). */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** Bounded ISO-datetime (RFC 3339-ish, max 35 chars). */
export const isoDateTime = z.string().min(10).max(35);
