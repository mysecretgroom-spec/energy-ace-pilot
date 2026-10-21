import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_appointments",
  title: "Consulter mes rendez-vous",
  description: "Read your own appointments in a date range of up to 31 days, including status and client reference.",
  inputSchema: {
    start: z.string().datetime({ offset: true }).describe("Inclusive start as ISO timestamp with timezone."),
    end: z.string().datetime({ offset: true }).describe("Exclusive end as ISO timestamp with timezone; at most 31 days after start."),
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum appointments returned, at most 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start, end, limit }, ctx) => {
    const userId = ctx.getUserId();
    if (!ctx.isAuthenticated() || !userId) return { content: [{ type: "text", text: "Sign in to access your appointments." }], isError: true };
    const duration = Date.parse(end) - Date.parse(start);
    if (duration <= 0 || duration > 31 * 86400000) return { content: [{ type: "text", text: "Choose a positive date range of at most 31 days." }], isError: true };
    const db = await supabaseForUser(ctx);
    const { data, error } = await db.from("rdv").select("id, date_heure, status, type_projet, client_id, regie_id").eq("user_id", userId).gte("date_heure", start).lt("date_heure", end).order("date_heure").order("id").limit(limit).abortSignal(ctx.signal);
    if (error) return { content: [{ type: "text", text: "Unable to load your appointments. Please retry." }], isError: true };
    const appointments = (data ?? []).map(row => ({ id: String(row.id), date_heure: String(row.date_heure), status: String(row.status), type_projet: row.type_projet == null ? null : String(row.type_projet), client_id: row.client_id == null ? null : String(row.client_id), regie_id: row.regie_id == null ? null : String(row.regie_id) }));
    return { content: [{ type: "text", text: JSON.stringify({ appointments, limit }) }], structuredContent: { appointments, limit } };
  },
});