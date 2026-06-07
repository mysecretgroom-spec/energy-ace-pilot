// =============================================================
// Zod validation for whatsapp-agent inbound payloads.
//
// Goal: harden the 12k-line entry point against malformed,
// oversized, or hostile payloads (prototype pollution, huge
// base64 blobs, SSRF-ish URLs, type confusion).
//
// Used by index.ts right after `await req.json()`.
// =============================================================

import { z } from "https://esm.sh/zod@3.23.8";

// ----- Limits (defensive bounds) -----
export const LIMITS = {
  MESSAGE_ID: 256,
  USER_NAME: 200,
  FROM_NUMBER: 64,
  CONTENT: 8_000,             // Twilio body cap is ~1600; web chat can be larger but we cap at 8k
  AUDIO_BASE64: 25_000_000,   // ~18MB decoded
  MEDIA_URL: 2_048,
  MEDIA_CONTENT_TYPE: 128,
  MEDIA_FILES: 25,
  REPLY_CONTENT: 4_000,
} as const;

// Allow only http(s) URLs, no javascript:, data:, file:, gopher:, etc.
const safeUrl = z
  .string()
  .max(LIMITS.MEDIA_URL)
  .refine(
    (u) => {
      try {
        const parsed = new URL(u);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL must be http(s)" },
  );

// MIME types: letters/digits/.+-/ only. Blocks header injection like "image/jpeg\r\nX-Evil:1".
const mimeType = z
  .string()
  .max(LIMITS.MEDIA_CONTENT_TYPE)
  .regex(/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/, "Invalid MIME type");

// Strict UUID (Supabase userId). We do NOT trust this for auth — the JWT path
// overrides it in index.ts — but rejecting garbage early is still useful.
const uuid = z.string().uuid("userId must be a UUID");

const MessageType = z.enum([
  "text",
  "image",
  "audio",
  "document",
  "multi_image",
  "multi_document",
  "multi_media",
  "media",
]);

const MediaFile = z.object({
  url: safeUrl,
  name: z.string().min(1).max(512),
  contentType: mimeType,
}).strict();

// Base64 charset only — protects downstream `atob()` from throwing on hostile input.
const base64String = z
  .string()
  .max(LIMITS.AUDIO_BASE64)
  .regex(/^[A-Za-z0-9+/=\s]+$/, "audioData must be base64");

export const AgentRequestSchema = z.object({
  messageId: z.string().min(1).max(LIMITS.MESSAGE_ID),
  userId: uuid,
  userName: z.string().max(LIMITS.USER_NAME).default(""),
  fromNumber: z.string().min(1).max(LIMITS.FROM_NUMBER),
  messageType: MessageType,
  // Content can be empty for media-only messages, but must be a string.
  content: z.string().max(LIMITS.CONTENT).default(""),

  mediaUrl: safeUrl.optional(),
  mediaContentType: mimeType.optional(),

  audioData: base64String.optional(),

  mediaFiles: z.array(MediaFile).max(LIMITS.MEDIA_FILES).optional(),
  mediaUrls: z.array(safeUrl).max(LIMITS.MEDIA_FILES).optional(),
  mediaContentTypes: z.array(mimeType).max(LIMITS.MEDIA_FILES).optional(),

  isReplyToMessage: z.boolean().optional(),
  replyToMessageId: z.string().max(LIMITS.MESSAGE_ID).nullable().optional(),
  replyToMessageContent: z.string().max(LIMITS.REPLY_CONTENT).nullable().optional(),
  repliedToTwilioSid: z.string().max(LIMITS.MESSAGE_ID).nullable().optional(),
}).strict(); // reject unknown keys → defends against prototype-pollution-style payloads

export type ValidatedAgentRequest = z.infer<typeof AgentRequestSchema>;

export interface ValidationFailure {
  ok: false;
  status: 400;
  body: { error: string; details: Record<string, string[]> };
}

export interface ValidationSuccess {
  ok: true;
  data: ValidatedAgentRequest;
}

/**
 * Parse + validate an inbound agent payload. Returns a discriminated union
 * so the caller can early-return the failure response.
 */
export function validateAgentRequest(input: unknown): ValidationSuccess | ValidationFailure {
  const parsed = AgentRequestSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    status: 400,
    body: {
      error: "Invalid request payload",
      details: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    },
  };
}
