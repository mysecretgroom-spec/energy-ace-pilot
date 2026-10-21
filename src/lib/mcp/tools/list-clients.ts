import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_clients",
  title: "Consulter mes clients",
  description: "List a page of your own clients with names, city and agency association, without private notes or documents.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("Number of clients, at most 50."),
    offset: z.number().int().min(0).max(10000).default(0).describe("Pagination offset."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, offset }, ctx) => {
    const userId = ctx.getUserId();
    if (!ctx.isAuthenticated() || !userId) return { content: [{ type: "text", text: "Sign in to access your clients." }], isError: true };
    const db = await supabaseForUser(ctx);
    const { data, error } = await db.from("clients").select("id, nom, prenom, ville, regie_id").eq("user_id", userId).order("created_at", { ascending: false }).order("id").range(offset, offset + limit - 1).abortSignal(ctx.signal);
    if (error) return { content: [{ type: "text", text: "Unable to load your clients. Please retry." }], isError: true };
    const clients = (data ?? []).map(row => ({ id: String(row.id), nom: String(row.nom ?? ""), prenom: String(row.prenom ?? ""), ville: row.ville == null ? null : String(row.ville), regie_id: row.regie_id == null ? null : String(row.regie_id) }));
    return { content: [{ type: "text", text: JSON.stringify({ clients, offset, limit }) }], structuredContent: { clients, offset, limit } };
  },
});