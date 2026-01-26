import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Intent types
type Intent = 
  | "create_rdv" 
  | "update_rdv" 
  | "update_vente_status" 
  | "mark_signe"           // Marquer une vente comme signée (workflow complet)
  | "update_vente_pipeline" // Mettre à jour le statut pipeline d'une vente (posé, payé, annulé, etc.)
  | "import_document" 
  | "import_facture" 
  | "query_commissions"
  | "query_stats"
  | "query_client_info"
  | "query_rdv_planning"
  | "query_rdv_detail"     // Topo détaillé sur un RDV spécifique (infos Gmail, conso, profil)
  | "query_ventes"
  | "user_feedback"        // Correction ou préférence utilisateur à mémoriser
  | "confirm_action"       // Confirmer une action en attente (oui/ok/confirme)
  | "cancel_action"        // Annuler une action en attente (non/annule)
  | "approve_whatsapp"     // Approuver l'envoi d'un message WhatsApp
  | "decline_whatsapp"     // Refuser l'envoi d'un message WhatsApp
  | "conversation"
  | "unknown";

// Workflow states for multi-step actions
type WorkflowState = 
  | "awaiting_confirmation"      // En attente de confirmation utilisateur
  | "collecting_signe_data"      // Collecte des données pour signature (puissance, prix, etc.)
  | "awaiting_whatsapp_approval" // En attente d'approbation du message WhatsApp
  | null;

interface PendingAction {
  intent: Intent;
  entities: Record<string, unknown>;
  workflowState: WorkflowState;
  collectedData?: {
    clientId?: string;
    clientName?: string;
    rdvId?: string;
    rdvIds?: string[];  // Pour les actions en masse
    regieId?: string;
    puissanceKwc?: number;
    prixTTC?: number;
    cqTime?: string;
    commentaire?: string;
    surcoutsIds?: string[];
    whatsappMessage?: string;
    confirmateurPhone?: string;
    action?: string;     // Pour update_rdv: "annule", "reporte", etc.
    newDate?: string;
    newTime?: string;
  };
  createdAt: string;
}

interface AgentRequest {
  messageId: string;
  userId: string;
  userName: string;
  fromNumber: string;
  messageType: "text" | "image" | "audio" | "document";
  content: string;
  mediaUrl?: string;
  mediaContentType?: string;
  // For web chat: audio data sent directly as base64 (no Twilio)
  audioData?: string;
}

interface AgentResponse {
  intent: Intent;
  confidence: number;
  entities: Record<string, unknown>;
  actionTaken?: string;
  entityId?: string;
  entityType?: string;
  responseMessage: string;
}

interface MediaDownloadResult {
  data: Uint8Array;
  base64: string;
  contentType: string;
  filename: string;
}

// Analysis result types matching analyze-document function
interface FinanceAnalysisResult {
  type: "finance";
  success: boolean;
  montant_ttc: number | null;
  montant_ht: number | null;
  tva: number | null;
  taux_tva: number | null;
  date: string | null;
  fournisseur: string | null;
  description: string | null;
  categorie: string | null;
  error_message?: string;
}

interface ClientDocAnalysisResult {
  type: "client_docs";
  success: boolean;
  document_type: string | null;
  confidence: number;
  description: string | null;
  error_message?: string;
}

type DocumentAnalysisResult = FinanceAnalysisResult | ClientDocAnalysisResult;

// ==================== MEMORY SYSTEM ====================

interface AgentMemory {
  id: string;
  memory_type: string;
  key: string;
  value: Record<string, unknown>;
  confidence: number;
  usage_count: number;
}

// User-defined prompt tokens for agent customization
interface AgentPrompt {
  id: string;
  prompt_type: string;
  title: string;
  content: string;
  priority: number;
}

// Load user's custom prompt tokens
// deno-lint-ignore no-explicit-any
async function loadUserPrompts(
  supabase: any,
  userId: string
): Promise<AgentPrompt[]> {
  try {
    const { data, error } = await supabase
      .from("whatsapp_agent_prompts")
      .select("id, prompt_type, title, content, priority")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(20);
    
    if (error) {
      console.error("Error loading user prompts:", error);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

// Format user prompts for AI system prompt
function formatPromptsForSystem(prompts: AgentPrompt[]): string {
  if (!prompts || prompts.length === 0) {
    return "";
  }
  
  const grouped: Record<string, string[]> = {
    persona: [],
    instruction: [],
    rule: [],
    context: [],
  };
  
  for (const prompt of prompts) {
    const type = prompt.prompt_type || "instruction";
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(`• ${prompt.content}`);
  }
  
  let result = "\n\n🎯 INSTRUCTIONS PERSONNALISÉES DE L'UTILISATEUR:";
  
  if (grouped.persona?.length) {
    result += `\n\n👤 PERSONNALITÉ/TON:\n${grouped.persona.join("\n")}`;
  }
  if (grouped.instruction?.length) {
    result += `\n\n📋 INSTRUCTIONS:\n${grouped.instruction.join("\n")}`;
  }
  if (grouped.rule?.length) {
    result += `\n\n⚠️ RÈGLES IMPÉRATIVES:\n${grouped.rule.join("\n")}`;
  }
  if (grouped.context?.length) {
    result += `\n\n💼 CONTEXTE MÉTIER:\n${grouped.context.join("\n")}`;
  }
  
  result += "\n\n⚡ Ces instructions priment sur le comportement par défaut.";
  
  return result;
}

// Load user's agent memories
// deno-lint-ignore no-explicit-any
async function loadUserMemories(
  supabase: any,
  userId: string
): Promise<AgentMemory[]> {
  try {
    const { data, error } = await supabase
      .from("whatsapp_agent_memory")
      .select("id, memory_type, key, value, confidence, usage_count")
      .eq("user_id", userId)
      .order("usage_count", { ascending: false })
      .limit(50);
    
    if (error) {
      console.error("Error loading memories:", error);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

// Save or update a memory
// deno-lint-ignore no-explicit-any
async function saveMemory(
  supabase: any,
  userId: string,
  memoryType: string,
  key: string,
  value: Record<string, unknown>,
  confidence: number = 0.8
): Promise<void> {
  try {
    // Upsert memory - if exists, increment usage_count and update
    const { error } = await supabase
      .from("whatsapp_agent_memory")
      .upsert({
        user_id: userId,
        memory_type: memoryType,
        key: key,
        value: value,
        confidence: confidence,
        usage_count: 1,
        last_used_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,memory_type,key",
      });
    
    if (error) {
      console.error("Error saving memory:", error);
    } else {
      console.log(`Memory saved: ${memoryType}/${key}`);
    }
  } catch (err) {
    console.error("Failed to save memory:", err);
  }
}

// Increment usage count for a memory
// deno-lint-ignore no-explicit-any
async function useMemory(
  supabase: any,
  memoryId: string
): Promise<void> {
  try {
    // Use raw SQL to increment
    await supabase.rpc("increment_memory_usage", { memory_id: memoryId });
  } catch {
    // Fallback: just update last_used_at
    await supabase
      .from("whatsapp_agent_memory")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", memoryId);
  }
}

// Format memories for AI prompt
function formatMemoriesForPrompt(memories: AgentMemory[]): string {
  if (!memories || memories.length === 0) {
    return "Aucune mémoire spécifique pour cet utilisateur.";
  }
  
  const grouped: Record<string, string[]> = {};
  
  for (const mem of memories) {
    const type = mem.memory_type;
    if (!grouped[type]) grouped[type] = [];
    
    let display = "";
    const v = mem.value;
    
    if (type === "alias" && v.original && v.alias) {
      display = `"${v.alias}" = "${v.original}"`;
    } else if (type === "preference") {
      display = String(v.description || JSON.stringify(v));
    } else if (type === "pattern") {
      display = String(v.pattern || JSON.stringify(v));
    } else if (type === "shortcut" && v.shortcut && v.meaning) {
      display = `"${v.shortcut}" signifie "${v.meaning}"`;
    } else if (type === "correction" && v.wrong && v.correct) {
      display = `"${v.wrong}" doit être compris comme "${v.correct}"`;
    } else {
      display = `${mem.key}: ${JSON.stringify(v)}`;
    }
    
    grouped[type].push(display);
  }
  
  let result = "";
  if (grouped.alias?.length) {
    result += `\n🏷️ ALIAS DE CLIENTS:\n${grouped.alias.map(a => `  - ${a}`).join("\n")}`;
  }
  if (grouped.preference?.length) {
    result += `\n⭐ PRÉFÉRENCES:\n${grouped.preference.map(p => `  - ${p}`).join("\n")}`;
  }
  if (grouped.shortcut?.length) {
    result += `\n⚡ RACCOURCIS:\n${grouped.shortcut.map(s => `  - ${s}`).join("\n")}`;
  }
  if (grouped.correction?.length) {
    result += `\n📝 CORRECTIONS:\n${grouped.correction.map(c => `  - ${c}`).join("\n")}`;
  }
  if (grouped.pattern?.length) {
    result += `\n🔄 HABITUDES:\n${grouped.pattern.map(p => `  - ${p}`).join("\n")}`;
  }
  if (grouped.context?.length) {
    result += `\n💭 CONTEXTE:\n${grouped.context.map(c => `  - ${c}`).join("\n")}`;
  }
  
  return result || "Aucune mémoire spécifique pour cet utilisateur.";
}

// Extract learnings from user interaction
// deno-lint-ignore no-explicit-any
async function learnFromInteraction(
  supabase: any,
  userId: string,
  userMessage: string,
  intent: string,
  entities: Record<string, unknown>,
  actionResult: { actionTaken?: string; entityId?: string }
): Promise<void> {
  try {
    // Learn client aliases
    if (entities.client_name && actionResult.actionTaken && actionResult.entityId) {
      const clientName = String(entities.client_name);
      const messageLower = userMessage.toLowerCase();
      
      // Check if user used a nickname or alias
      const aliasPatterns = [
        /(?:le|la|mon|ma|notre)\s+(?:client(?:e)?|prospect)\s+(?:de\s+)?(.+?)(?:\s|$)/i,
        /(?:chez|pour)\s+(.+?)(?:\s|$)/i,
      ];
      
      for (const pattern of aliasPatterns) {
        const match = messageLower.match(pattern);
        if (match && match[1] && match[1].length > 2 && match[1].length < 30) {
          const alias = match[1].trim();
          if (alias !== clientName.toLowerCase()) {
            await saveMemory(supabase, userId, "alias", `alias_${alias}`, {
              alias: alias,
              original: clientName,
              client_id: actionResult.entityId,
            }, 0.7);
          }
        }
      }
    }
    
    // Learn status shortcuts
    if (intent === "update_vente_pipeline" || intent === "update_vente_status") {
      const status = entities.status || entities.pipeline_status;
      if (status) {
        // Store the raw message as a shortcut pattern
        const words = userMessage.toLowerCase().split(/\s+/);
        for (const word of words) {
          if (word.length >= 3 && !["client", "vente", "rdv", "status"].includes(word)) {
            // Could be a personal shortcut
            const existingShortcut = await supabase
              .from("whatsapp_agent_memory")
              .select("id, usage_count")
              .eq("user_id", userId)
              .eq("memory_type", "shortcut")
              .eq("key", `shortcut_${word}`)
              .maybeSingle();
            
            if (existingShortcut.data) {
              // Increment usage
              await supabase
                .from("whatsapp_agent_memory")
                .update({ 
                  usage_count: (existingShortcut.data.usage_count || 0) + 1,
                  last_used_at: new Date().toISOString()
                })
                .eq("id", existingShortcut.data.id);
            }
          }
        }
      }
    }
    
    // Learn time preferences
    if (entities.time && (intent === "create_rdv" || intent === "update_rdv")) {
      const time = String(entities.time);
      // Track preferred RDV times
      await saveMemory(supabase, userId, "pattern", "preferred_rdv_time", {
        pattern: "time_preference",
        value: time,
        last_used: new Date().toISOString(),
      }, 0.5);
    }
    
  } catch (err) {
    console.error("Error learning from interaction:", err);
  }
}

// ==================== FUZZY CLIENT SEARCH ====================

// Calculate Levenshtein distance between two strings
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Calculate similarity ratio (0-1, 1 = identical)
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

// Normalize a name for comparison (remove accents, lowercase, trim)
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s]/g, "")     // Remove special chars
    .trim();
}

interface ClientMatch {
  id: string;
  nom: string;
  prenom: string | null;
  fullName: string;
  score: number;
  matchType: "exact" | "partial" | "fuzzy";
}

// Find clients by name with fuzzy matching
// deno-lint-ignore no-explicit-any
async function findClientByName(
  supabase: any,
  userId: string,
  searchName: string,
  options: { limit?: number; minScore?: number } = {}
): Promise<{ 
  clients: ClientMatch[]; 
  exactMatch: ClientMatch | null;
  suggestions: ClientMatch[];
  notFound: boolean;
}> {
  const { limit = 5, minScore = 0.5 } = options;
  const normalizedSearch = normalizeName(searchName);
  
  if (!normalizedSearch || normalizedSearch.length < 2) {
    return { clients: [], exactMatch: null, suggestions: [], notFound: true };
  }
  
  // Split search into words to handle "Legeron Camille" → ["legeron", "camille"]
  const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length >= 2);
  console.log(`Searching for client: "${searchName}" → words: [${searchWords.join(", ")}]`);
  
  // Build OR conditions for each search word
  // This handles cases like "Legeron Camille" by searching each word in both nom and prenom
  const orConditions: string[] = [];
  for (const word of searchWords) {
    orConditions.push(`nom.ilike.%${word}%`);
    orConditions.push(`prenom.ilike.%${word}%`);
  }
  
  // Also try the full search string as-is
  orConditions.push(`nom.ilike.%${searchName}%`);
  orConditions.push(`prenom.ilike.%${searchName}%`);
  
  const { data: exactClients, error: searchError } = await supabase
    .from("clients")
    .select("id, nom, prenom")
    .eq("user_id", userId)
    .or(orConditions.join(","))
    .limit(20);
  
  if (searchError) {
    console.error("Client search error:", searchError);
  }
  
  console.log(`ILIKE search returned ${exactClients?.length || 0} clients`);
  
  if (exactClients && exactClients.length > 0) {
    const matches: ClientMatch[] = exactClients.map((c: { id: string; nom: string; prenom: string | null }) => {
      const fullName = `${c.prenom || ""} ${c.nom}`.trim();
      const fullNameReversed = `${c.nom} ${c.prenom || ""}`.trim();
      const normalizedNom = normalizeName(c.nom);
      const normalizedPrenom = normalizeName(c.prenom || "");
      const normalizedFull = normalizeName(fullName);
      const normalizedFullReversed = normalizeName(fullNameReversed);
      
      // Calculate score based on match quality
      let score = 0;
      let matchType: "exact" | "partial" | "fuzzy" = "partial";
      
      // Exact match on nom only
      if (normalizedNom === normalizedSearch) {
        score = 1;
        matchType = "exact";
      } 
      // Exact match on prenom only
      else if (normalizedPrenom === normalizedSearch) {
        score = 0.95;
        matchType = "exact";
      }
      // Exact match on full name (prenom + nom)
      else if (normalizedFull === normalizedSearch || normalizedFullReversed === normalizedSearch) {
        score = 1;
        matchType = "exact";
      }
      // Check if ALL search words match (any order)
      else if (searchWords.length > 1) {
        const clientWords = `${normalizedPrenom} ${normalizedNom}`.split(/\s+/);
        const allWordsMatch = searchWords.every(sw => 
          clientWords.some(cw => cw === sw || cw.startsWith(sw) || sw.startsWith(cw))
        );
        if (allWordsMatch) {
          score = 0.98;
          matchType = "exact";
        }
      }
      
      // Partial matches
      if (score === 0) {
        if (normalizedNom.startsWith(normalizedSearch) || normalizedPrenom.startsWith(normalizedSearch)) {
          score = 0.9;
          matchType = "partial";
        } else if (normalizedSearch.startsWith(normalizedNom) || normalizedSearch.startsWith(normalizedPrenom)) {
          score = 0.85;
          matchType = "partial";
        } else {
          // Generic contains match
          score = 0.7;
          matchType = "partial";
        }
      }
      
      return { id: c.id, nom: c.nom, prenom: c.prenom, fullName, score, matchType };
    });
    
    matches.sort((a, b) => b.score - a.score);
    const exactMatch = matches.find(m => m.matchType === "exact") || (matches.length === 1 ? matches[0] : null);
    
    console.log(`Best match: ${exactMatch?.fullName} (score: ${exactMatch?.score})`);
    
    return {
      clients: matches.slice(0, limit),
      exactMatch,
      suggestions: exactMatch ? [] : matches.slice(0, 3),
      notFound: false
    };
  }
  
  // No exact match - try fuzzy search on all clients
  console.log(`No exact match for "${searchName}", trying fuzzy search...`);
  
  const { data: allClients } = await supabase
    .from("clients")
    .select("id, nom, prenom")
    .eq("user_id", userId)
    .limit(500); // Get more clients for fuzzy matching
  
  if (!allClients || allClients.length === 0) {
    return { clients: [], exactMatch: null, suggestions: [], notFound: true };
  }
  
  // Calculate similarity for each client
  const fuzzyMatches: ClientMatch[] = [];
  
  for (const c of allClients as { id: string; nom: string; prenom: string | null }[]) {
    const fullName = `${c.prenom || ""} ${c.nom}`.trim();
    const normalizedNom = normalizeName(c.nom);
    const normalizedPrenom = normalizeName(c.prenom || "");
    
    // Calculate similarity scores
    const nomScore = similarity(normalizedSearch, normalizedNom);
    const prenomScore = c.prenom ? similarity(normalizedSearch, normalizedPrenom) : 0;
    
    // Also check if search contains common typos (transposed letters, missing letters)
    const searchWords = normalizedSearch.split(/\s+/);
    const nomWords = normalizedNom.split(/\s+/);
    
    let wordMatchScore = 0;
    for (const sw of searchWords) {
      for (const nw of nomWords) {
        const wscore = similarity(sw, nw);
        if (wscore > wordMatchScore) wordMatchScore = wscore;
      }
    }
    
    // Best score across all comparisons
    const bestScore = Math.max(nomScore, prenomScore, wordMatchScore);
    
    if (bestScore >= minScore) {
      fuzzyMatches.push({
        id: c.id,
        nom: c.nom,
        prenom: c.prenom,
        fullName,
        score: bestScore,
        matchType: "fuzzy"
      });
    }
  }
  
  // Sort by score descending
  fuzzyMatches.sort((a, b) => b.score - a.score);
  
  const topMatches = fuzzyMatches.slice(0, limit);
  const highConfidenceMatch = topMatches.length > 0 && topMatches[0].score >= 0.8 
    ? topMatches[0] 
    : null;
  
  console.log(`Fuzzy search found ${fuzzyMatches.length} matches, best score: ${topMatches[0]?.score || 0}`);
  
  return {
    clients: topMatches,
    exactMatch: highConfidenceMatch,
    suggestions: highConfidenceMatch ? [] : topMatches.slice(0, 3),
    notFound: topMatches.length === 0
  };
}

// ==================== ACTION LOGGING ====================

// Log an agent action for audit trail and undo capability
// deno-lint-ignore no-explicit-any
async function logAgentAction(
  supabase: any,
  userId: string,
  messageId: string | null,
  actionType: string,
  targetTable: string,
  targetId: string,
  actionData: Record<string, unknown>,
  previousData: Record<string, unknown> | null,
  description: string
): Promise<void> {
  try {
    await supabase.from("whatsapp_agent_actions").insert({
      user_id: userId,
      message_id: messageId,
      action_type: actionType,
      target_table: targetTable,
      target_id: targetId,
      action_data: actionData,
      previous_data: previousData,
      description: description,
    });
    console.log(`Action logged: ${actionType} on ${targetTable}/${targetId}`);
  } catch (error) {
    console.error("Failed to log agent action:", error);
    // Don't throw - logging failure should not break the main flow
  }
}

// Get previous data snapshot for undo capability
// deno-lint-ignore no-explicit-any
async function getPreviousData(
  supabase: any,
  table: string,
  id: string,
  userId: string
): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    
    if (error || !data) return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const request: AgentRequest = await req.json();
    console.log("Processing agent request:", request);

    let processedContent = request.content;
    let mediaData: MediaDownloadResult | null = null;
    let uploadedDocumentUrl: string | null = null;
    let documentAnalysisResult: DocumentAnalysisResult | null = null;

    // Download media from Twilio if present (WhatsApp source)
    if (request.mediaUrl && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      console.log("Downloading media from Twilio...");
      mediaData = await downloadTwilioMedia(
        request.mediaUrl,
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN,
        request.mediaContentType || ""
      );
      console.log(`Downloaded ${mediaData.contentType}, size: ${mediaData.data.length} bytes`);
    }

    // Handle audio transcription with Gemini
    if (request.messageType === "audio") {
      // Web chat: audio data sent directly as base64
      if (request.audioData) {
        console.log("Transcribing web audio with Gemini...");
        const audioBytes = Uint8Array.from(atob(request.audioData), c => c.charCodeAt(0));
        const webMediaData: MediaDownloadResult = {
          data: audioBytes,
          base64: request.audioData,
          contentType: "audio/webm",
          filename: "voice_message.webm"
        };
        processedContent = await transcribeAudioWithGemini(webMediaData, LOVABLE_API_KEY);
        console.log("Transcribed web audio:", processedContent);
      } 
      // WhatsApp: audio from Twilio
      else if (mediaData) {
        console.log("Transcribing Twilio audio with Gemini...");
        processedContent = await transcribeAudioWithGemini(mediaData, LOVABLE_API_KEY);
        console.log("Transcribed Twilio audio:", processedContent);
      }
    }

    // Handle image/document analysis - detect context based on content hints
    if ((request.messageType === "image" || request.messageType === "document") && mediaData) {
      console.log("Analyzing media with structured extraction...");
      
      // Determine context: look for finance-related keywords in message
      const messageText = (request.content || "").toLowerCase();
      const isFinanceContext = 
        messageText.includes("frais") ||
        messageText.includes("ticket") ||
        messageText.includes("note") ||
        messageText.includes("essence") ||
        messageText.includes("carburant") ||
        messageText.includes("péage") ||
        messageText.includes("repas") ||
        messageText.includes("restaurant") ||
        messageText.includes("parking") ||
        messageText.includes("hotel") ||
        (messageText.includes("facture") && !messageText.includes("energie") && !messageText.includes("edf"));

      // First try to detect if it's a receipt/invoice or a client document
      documentAnalysisResult = await analyzeMediaStructured(
        mediaData,
        isFinanceContext ? "finance" : "client_docs",
        LOVABLE_API_KEY
      );

      console.log("Structured analysis result:", documentAnalysisResult);

      // Build processed content from analysis
      if (documentAnalysisResult && documentAnalysisResult.success) {
        if (documentAnalysisResult.type === "finance") {
          const fin = documentAnalysisResult as FinanceAnalysisResult;
          processedContent = request.content 
            ? `${request.content}\n\n[Analyse note de frais: ${fin.fournisseur || "?"}, ${fin.montant_ttc || "?"}€, ${fin.date || "?"}, catégorie: ${fin.categorie || "?"}]`
            : `[Analyse note de frais: ${fin.fournisseur || "?"}, ${fin.montant_ttc || "?"}€, ${fin.date || "?"}, catégorie: ${fin.categorie || "?"}]`;
        } else {
          const doc = documentAnalysisResult as ClientDocAnalysisResult;
          processedContent = request.content 
            ? `${request.content}\n\n[Analyse document client: type=${doc.document_type || "?"}, confiance=${doc.confidence}%, ${doc.description || ""}]`
            : `[Analyse document client: type=${doc.document_type || "?"}, confiance=${doc.confidence}%, ${doc.description || ""}]`;
        }
      } else if (documentAnalysisResult) {
        processedContent = request.content 
          ? `${request.content}\n\n[Document reçu mais analyse échouée: ${documentAnalysisResult.error_message || "erreur inconnue"}]`
          : `[Document reçu mais analyse échouée: ${documentAnalysisResult.error_message || "erreur inconnue"}]`;
      }
    }

    // Get conversation context, user memories, and custom prompts in parallel
    const [conversationResult, userMemories, userPrompts] = await Promise.all([
      supabase
        .from("whatsapp_conversations")
        .select("context, pending_action")
        .eq("user_id", request.userId)
        .single(),
      loadUserMemories(supabase, request.userId),
      loadUserPrompts(supabase, request.userId)
    ]);

    const conversationContext = (conversationResult.data?.context || []) as Array<{ role: string; content: string }>;
    const pendingAction = conversationResult.data?.pending_action as PendingAction | null;

    console.log(`Loaded ${userMemories.length} memories and ${userPrompts.length} custom prompts for user`);

    // Check if we have a pending action that needs workflow handling
    let actionResult: { actionTaken?: string; entityId?: string; entityType?: string; newPendingAction?: PendingAction | null; customResponse?: string } = {};
    let aiResponse: { intent: Intent; confidence: number; entities: Record<string, unknown>; requiresConfirmation: boolean; responseMessage: string };
    let skipAiAnalysis = false;

    // Handle pending workflow states
    if (pendingAction?.workflowState) {
      const handled = await handlePendingWorkflow(
        supabase,
        request.userId,
        request.userName,
        processedContent,
        pendingAction,
        TWILIO_ACCOUNT_SID!,
        TWILIO_AUTH_TOKEN!
      );
      
      if (handled) {
        skipAiAnalysis = true;
        aiResponse = {
          intent: handled.intent || "conversation",
          confidence: 100,
          entities: {},
          requiresConfirmation: false,
          responseMessage: handled.responseMessage,
        };
        actionResult = handled;
      }
    }

    // If not handling a pending workflow, analyze intent with AI (with memories and custom prompts)
    if (!skipAiAnalysis) {
      aiResponse = await analyzeIntent(
        processedContent,
        request.userName,
        conversationContext,
        pendingAction,
        userMemories,
        userPrompts,
        LOVABLE_API_KEY
      );
    }

    console.log("AI analysis result:", aiResponse!);

    // Execute action based on intent (only if not already handled by workflow)
    if (!skipAiAnalysis && aiResponse!.intent !== "unknown" && aiResponse!.intent !== "conversation" && aiResponse!.confidence >= 70) {
      // For import intents, we need to upload the media first
      if ((aiResponse!.intent === "import_document" || aiResponse!.intent === "import_facture") && mediaData) {
        console.log("Uploading media to storage...");
        uploadedDocumentUrl = await uploadMediaToStorage(
          supabase,
          mediaData,
          request.userId,
          aiResponse!.intent === "import_facture" ? "frais" : "documents"
        );
        console.log("Uploaded to:", uploadedDocumentUrl);
      }

      actionResult = await executeAction(
        supabase,
        request.userId,
        request.userName,
        request.messageId,
        aiResponse!.intent,
        aiResponse!.entities,
        uploadedDocumentUrl,
        mediaData,
        documentAnalysisResult,
        TWILIO_ACCOUNT_SID!,
        TWILIO_AUTH_TOKEN!
      );
    }

    // Format response message based on query results or custom workflow response
    let finalResponseMessage = actionResult.customResponse || aiResponse!.responseMessage;
    
    if (actionResult.actionTaken?.startsWith("query_") && actionResult.entityId) {
      finalResponseMessage = formatQueryResponse(
        actionResult.actionTaken,
        actionResult.entityId,
        request.userName
      );
    }

    // Determine pending action to store
    const newPendingAction = actionResult.newPendingAction !== undefined 
      ? actionResult.newPendingAction 
      : (aiResponse!.requiresConfirmation ? { 
          intent: aiResponse!.intent, 
          entities: aiResponse!.entities, 
          workflowState: "awaiting_confirmation" as WorkflowState,
          createdAt: new Date().toISOString()
        } : null);

    // Update conversation context (keep last 5 messages)
    const newContext = [
      ...conversationContext.slice(-4),
      {
        role: "user",
        content: processedContent,
        timestamp: new Date().toISOString(),
      },
      {
        role: "assistant",
        content: finalResponseMessage,
        timestamp: new Date().toISOString(),
      },
    ];

    // Learn from this interaction (non-blocking, in background)
    if (actionResult.actionTaken && !actionResult.actionTaken.startsWith("error")) {
      learnFromInteraction(
        supabase,
        request.userId,
        processedContent,
        aiResponse!.intent,
        aiResponse!.entities,
        actionResult
      ).catch(err => console.error("Learning error:", err));
    }

    await supabase
      .from("whatsapp_conversations")
      .upsert({
        user_id: request.userId,
        phone_number: request.fromNumber,
        context: newContext,
        pending_action: newPendingAction,
        last_message_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    const response: AgentResponse = {
      intent: aiResponse!.intent,
      confidence: aiResponse!.confidence,
      entities: aiResponse!.entities,
      actionTaken: actionResult.actionTaken,
      entityId: actionResult.entityId,
      entityType: actionResult.entityType,
      responseMessage: finalResponseMessage,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Agent error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        responseMessage: "Une erreur s'est produite. Veuillez réessayer.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Download media from Twilio (requires basic auth)
async function downloadTwilioMedia(
  mediaUrl: string,
  accountSid: string,
  authToken: string,
  contentType: string
): Promise<MediaDownloadResult> {
  const response = await fetch(mediaUrl, {
    headers: {
      "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.status}`);
  }

  const data = new Uint8Array(await response.arrayBuffer());
  const base64 = encodeBase64(data);
  const actualContentType = response.headers.get("content-type") || contentType;
  
  // Generate filename based on content type
  const ext = getExtensionFromContentType(actualContentType);
  const filename = `whatsapp_${Date.now()}.${ext}`;

  return {
    data,
    base64,
    contentType: actualContentType,
    filename,
  };
}

function getExtensionFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/amr": "amr",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  return map[contentType] || "bin";
}

// Transcribe audio using Gemini (supports audio in base64)
async function transcribeAudioWithGemini(
  media: MediaDownloadResult,
  apiKey: string
): Promise<string> {
  // Gemini supports audio via inline_data
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Tu es un assistant qui transcrit des messages vocaux WhatsApp en français.
Transcris fidèlement le contenu audio et identifie les éléments importants :
- Noms de clients mentionnés
- Dates et heures
- Adresses
- Statuts de RDV (positif, négatif, reporté, absent, etc.)
- Montants
- Types de documents

Retourne uniquement la transcription, sans commentaires.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcris ce message vocal WhatsApp :"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${media.contentType};base64,${media.base64}`
              }
            }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini audio transcription error:", error);
    // Fallback message if transcription fails
    return "[Message vocal reçu - transcription non disponible. Veuillez reformuler en texte.]";
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "[Transcription non disponible]";
}

// Analyze media with structured output (same logic as analyze-document function)
async function analyzeMediaStructured(
  media: MediaDownloadResult,
  context: "finance" | "client_docs",
  apiKey: string
): Promise<DocumentAnalysisResult> {
  const imageUrl = `data:${media.contentType};base64,${media.base64}`;

  let prompt: string;

  if (context === "finance") {
    prompt = `Analyse cette image de facture/ticket de caisse et extrais les informations en JSON.

IMPORTANT: Si l'image est floue, illisible, ou n'est pas une facture/ticket, retourne success: false avec une explication.

Champs à extraire:
- success: true si tu as pu lire et comprendre le document, false sinon
- montant_ttc: le montant TOTAL TTC en euros (nombre décimal)
- montant_ht: le montant HT si visible (nombre décimal ou null)
- tva: le montant de TVA en euros si visible (nombre ou null)
- taux_tva: le taux de TVA en % si visible (ex: 20 pour 20%)
- date: la date au format YYYY-MM-DD
- fournisseur: le nom du commerce/enseigne
- description: courte description de la dépense
- categorie: une des catégories: "carburant", "peage", "repas", "hotel", "parking", "autre"
- error_message: si success=false, explique pourquoi

Réponds UNIQUEMENT avec le JSON, sans markdown. Exemple succès:
{"success": true, "montant_ttc": 54.60, "montant_ht": 45.50, "tva": 9.10, "taux_tva": 20, "date": "2026-01-21", "fournisseur": "Total", "description": "Plein essence", "categorie": "carburant"}

Exemple échec:
{"success": false, "montant_ttc": null, "montant_ht": null, "tva": null, "taux_tva": null, "date": null, "fournisseur": null, "description": null, "categorie": null, "error_message": "Image trop floue, impossible de lire le texte"}`;
  } else {
    prompt = `Analyse cette image de document client et détermine son type.

IMPORTANT: Si l'image est floue, illisible, ou si tu n'arrives pas à identifier le type de document, retourne success: false.

Types de documents possibles:
- Photos techniques: "photo_tableau" (tableau électrique), "photo_compteur" (compteur électrique), "photo_toiture" (toit), "photo_chantier" (chantier)
- Identité: "cni_monsieur_recto", "cni_monsieur_verso", "cni_madame_recto", "cni_madame_verso"
- Justificatifs domicile: "justificatif_domicile", "taxe_fonciere", "acte_notarie"
- Financiers: "rib", "avis_impots", "fiche_paie_monsieur", "fiche_paie_madame", "attestation_retraite", "attestation_invalidite", "bilans"
- Projet: "facture_energie", "bon_commande", "devis", "contrat", "plan", "assurance"
- Autre: "autre"

Retourne un JSON avec:
- success: true si tu as pu identifier le document, false sinon
- document_type: le type de document parmi la liste ci-dessus
- confidence: niveau de confiance de 0 à 100
- description: courte description de ce que tu vois
- error_message: si success=false, explique pourquoi

Réponds UNIQUEMENT avec le JSON, sans markdown. Exemple:
{"success": true, "document_type": "photo_compteur", "confidence": 95, "description": "Photo d'un compteur Linky"}

Exemple échec:
{"success": false, "document_type": null, "confidence": 0, "description": null, "error_message": "Image floue, impossible d'identifier le document"}`;
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI Gateway error:", errorText);
    
    if (context === "finance") {
      return {
        type: "finance",
        success: false,
        montant_ttc: null,
        montant_ht: null,
        tva: null,
        taux_tva: null,
        date: null,
        fournisseur: null,
        description: null,
        categorie: null,
        error_message: "Erreur de l'API d'analyse",
      };
    } else {
      return {
        type: "client_docs",
        success: false,
        document_type: null,
        confidence: 0,
        description: null,
        error_message: "Erreur de l'API d'analyse",
      };
    }
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content || "";

  try {
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleanContent);
    
    if (context === "finance") {
      return {
        type: "finance",
        success: parsed.success ?? false,
        montant_ttc: parsed.montant_ttc ?? null,
        montant_ht: parsed.montant_ht ?? null,
        tva: parsed.tva ?? null,
        taux_tva: parsed.taux_tva ?? null,
        date: parsed.date ?? null,
        fournisseur: parsed.fournisseur ?? null,
        description: parsed.description ?? null,
        categorie: parsed.categorie ?? null,
        error_message: parsed.error_message,
      };
    } else {
      return {
        type: "client_docs",
        success: parsed.success ?? false,
        document_type: parsed.document_type ?? null,
        confidence: parsed.confidence ?? 0,
        description: parsed.description ?? null,
        error_message: parsed.error_message,
      };
    }
  } catch {
    console.error("Failed to parse AI response:", content);
    if (context === "finance") {
      return {
        type: "finance",
        success: false,
        montant_ttc: null,
        montant_ht: null,
        tva: null,
        taux_tva: null,
        date: null,
        fournisseur: null,
        description: null,
        categorie: null,
        error_message: "Impossible de traiter la réponse de l'IA",
      };
    } else {
      return {
        type: "client_docs",
        success: false,
        document_type: null,
        confidence: 0,
        description: null,
        error_message: "Impossible de traiter la réponse de l'IA",
      };
    }
  }
}

// Upload media to Supabase Storage
// deno-lint-ignore no-explicit-any
async function uploadMediaToStorage(
  supabase: any,
  media: MediaDownloadResult,
  userId: string,
  bucket: string
): Promise<string> {
  const timestamp = Date.now();
  const filePath = `whatsapp/${userId}/${timestamp}_${media.filename}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(bucket === "frais" ? "receipts" : "documents")
    .upload(filePath, media.data, {
      contentType: media.contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw new Error(`Failed to upload: ${uploadError.message}`);
  }

  // Get signed URL (1 year validity)
  const { data: urlData } = await supabase.storage
    .from(bucket === "frais" ? "receipts" : "documents")
    .createSignedUrl(filePath, 60 * 60 * 24 * 365);

  if (!urlData?.signedUrl) {
    throw new Error("Failed to generate signed URL");
  }

  return urlData.signedUrl;
}

// Format query response into readable WhatsApp message
function formatQueryResponse(
  actionTaken: string,
  entityData: string,
  userName: string
): string {
  try {
    const data = JSON.parse(entityData);

    switch (actionTaken) {
      case "query_commissions_result": {
        const { en_cours, a_facturer, total } = data;
        return `💰 *Tes commissions ${userName.split(" ")[0]}*\n\n` +
          `📊 En cours: ${en_cours.count} vente(s) → *${en_cours.total.toLocaleString("fr-FR")}€*\n` +
          `✅ À facturer: ${a_facturer.count} vente(s) → *${a_facturer.total.toLocaleString("fr-FR")}€*\n\n` +
          `💵 Total: *${total.toLocaleString("fr-FR")}€*`;
      }

      case "query_stats_result": {
        const { period, rdv, ventes, ca, taux_conversion } = data;
        const periodLabel = period === "today" ? "Aujourd'hui" : 
                           period === "week" ? "Cette semaine" : 
                           period === "all" ? "Tout temps" : "Ce mois";
        return `📈 *Stats - ${periodLabel}*\n\n` +
          `📅 RDV: *${rdv}*\n` +
          `✍️ Ventes: *${ventes}*\n` +
          `💶 CA: *${ca.toLocaleString("fr-FR")}€ HT*\n` +
          `📊 Taux: *${taux_conversion}%*`;
      }

      case "query_client_result": {
        if (!Array.isArray(data) || data.length === 0) {
          return "❌ Aucun client trouvé avec ce nom.";
        }
        let msg = `👤 *Client(s) trouvé(s)*\n`;
        for (const c of data.slice(0, 10)) {
          msg += `\n*${c.nom}*\n`;
          if (c.telephone) msg += `📱 ${c.telephone}\n`;
          if (c.telephone2) msg += `📞 ${c.telephone2}\n`;
          if (c.email) msg += `✉️ ${c.email}\n`;
          if (c.adresse) msg += `📍 ${c.adresse}\n`;
        }
        return msg.trim();
      }

      case "query_rdv_result": {
        const { period, count, rdvs } = data;
        const periodLabel = period === "today" ? "Aujourd'hui" : 
                           period === "week" ? "Cette semaine" : "Ce mois";
        if (count === 0) {
          return `📅 *${periodLabel}*: Aucun RDV prévu 🎉`;
        }
        let msg = `📅 *Planning - ${periodLabel}* (${count} RDV)\n`;
        for (const r of rdvs.slice(0, 15)) {
          msg += `\n⏰ *${r.heure}* - ${r.client}`;
          if (r.telephone) msg += ` 📱${r.telephone}`;
          if (r.adresse) msg += `\n   📍 ${r.adresse}`;
          msg += `\n   ${r.type} • ${r.statut}`;
        }
        if (count > 15) msg += `\n\n... et ${count - 15} autre(s)`;
        return msg;
      }

      case "query_ventes_result": {
        const { count, ventes: ventesList } = data;
        if (count === 0) {
          return "📊 Aucune vente trouvée.";
        }
        let msg = `🏆 *Ventes* (${count})\n`;
        for (const v of ventesList.slice(0, 15)) {
          const status = v.installe ? "✅" : v.statut === "positif" ? "📝" : "⏳";
          msg += `\n${status} *${v.client}*`;
          if (v.puissance) msg += ` - ${v.puissance}kWc`;
          if (v.montant) msg += ` - ${v.montant.toLocaleString("fr-FR")}€`;
          msg += `\n   ${v.statut}${v.installe ? " (installé)" : ""}`;
        }
        if (count > 15) msg += `\n\n... et ${count - 15} autre(s)`;
        return msg;
      }

      default:
        return "✅ Demande traitée.";
    }
  } catch {
    return "✅ Demande traitée.";
  }
}

// Handle pending workflow states (multi-step actions)
// deno-lint-ignore no-explicit-any
async function handlePendingWorkflow(
  supabase: any,
  userId: string,
  userName: string,
  userMessage: string,
  pendingAction: PendingAction,
  twilioAccountSid: string,
  twilioAuthToken: string
): Promise<{ intent?: Intent; actionTaken?: string; entityId?: string; entityType?: string; newPendingAction?: PendingAction | null; responseMessage: string; customResponse?: string } | null> {
  const messageLower = userMessage.toLowerCase().trim();
  
  // Check for cancellation
  const cancelPatterns = ["non", "annule", "annuler", "stop", "arrête", "arreter", "laisse tomber", "oublie"];
  if (cancelPatterns.some(p => messageLower.includes(p))) {
    return {
      intent: "cancel_action",
      actionTaken: "cancelled",
      newPendingAction: null,
      responseMessage: "❌ Action annulée. Comment puis-je t'aider ?",
    };
  }
  
  switch (pendingAction.workflowState) {
    case "collecting_signe_data": {
      // Parse the user's response for signing data
      const collectedData = pendingAction.collectedData || {};
      
      // Try to extract numbers from message
      const numbers = userMessage.match(/(\d+(?:[.,]\d+)?)/g);
      
      if (!collectedData.puissanceKwc && numbers && numbers.length >= 1) {
        // First ask for power
        const puissance = parseFloat(numbers[0].replace(",", "."));
        if (puissance > 0 && puissance <= 100) {
          collectedData.puissanceKwc = puissance;
        }
      }
      
      if (collectedData.puissanceKwc && !collectedData.prixTTC && numbers && numbers.length >= 1) {
        // Then price - look for larger numbers
        for (const num of numbers) {
          const prix = parseFloat(num.replace(",", "."));
          if (prix > 1000) {
            collectedData.prixTTC = prix;
            break;
          }
        }
      }
      
      // Check for time pattern (HH:MM)
      const timeMatch = userMessage.match(/(\d{1,2})[h:](\d{2})?/i);
      if (timeMatch) {
        const hours = timeMatch[1].padStart(2, "0");
        const mins = timeMatch[2] || "00";
        collectedData.cqTime = `${hours}:${mins}`;
      }
      
      // Check for "ok" / "oui" / "confirme" to validate
      const confirmPatterns = ["oui", "ok", "confirme", "valide", "c'est bon", "parfait", "envoie"];
      const isConfirming = confirmPatterns.some(p => messageLower.includes(p));
      
      if (isConfirming && collectedData.puissanceKwc && collectedData.prixTTC) {
        // We have enough data - proceed to create the vente
        const venteResult = await createSignedVente(
          supabase,
          userId,
          collectedData
        );
        
        if (venteResult.success) {
          // Now generate WhatsApp message for confirmateur approval
          const whatsappMsg = generateConfirmateurMessage(
            collectedData.clientName || "Client",
            collectedData.puissanceKwc!,
            collectedData.prixTTC!,
            collectedData.cqTime || "10:00",
            collectedData.commentaire
          );
          
          // Get confirmateur phone
          const confirmateurPhone = await getConfirmateurPhone(supabase, userId, collectedData.regieId);
          
          if (confirmateurPhone) {
            return {
              intent: "mark_signe",
              actionTaken: "awaiting_whatsapp_approval",
              entityId: venteResult.venteId,
              entityType: "vente",
              newPendingAction: {
                intent: "approve_whatsapp",
                entities: {},
                workflowState: "awaiting_whatsapp_approval",
                collectedData: {
                  ...collectedData,
                  whatsappMessage: whatsappMsg,
                  confirmateurPhone,
                },
                createdAt: new Date().toISOString(),
              },
              responseMessage: `✅ *Vente créée !*\n\n📱 Voici le message qui sera envoyé au confirmateur:\n\n---\n${whatsappMsg}\n---\n\n*Confirmes-tu l'envoi ?* (Oui/Non)`,
            };
          } else {
            return {
              intent: "mark_signe",
              actionTaken: "vente_created_no_confirmateur",
              entityId: venteResult.venteId,
              entityType: "vente",
              newPendingAction: null,
              responseMessage: `✅ *Vente créée !* ${collectedData.clientName} - ${collectedData.puissanceKwc}kWc - ${collectedData.prixTTC?.toLocaleString("fr-FR")}€\n\n⚠️ Aucun confirmateur configuré pour envoyer le message WhatsApp.`,
            };
          }
        } else {
          return {
            intent: "mark_signe",
            actionTaken: "error",
            newPendingAction: null,
            responseMessage: `❌ Erreur lors de la création de la vente: ${venteResult.error}`,
          };
        }
      }
      
      // Need more data
      let nextQuestion = "";
      if (!collectedData.puissanceKwc) {
        nextQuestion = "📊 Quelle est la *puissance* installée (en kWc) ?";
      } else if (!collectedData.prixTTC) {
        nextQuestion = "💰 Quel est le *prix TTC* de la vente ?";
      } else if (!collectedData.cqTime) {
        collectedData.cqTime = "10:00"; // Default
        nextQuestion = `⏰ Heure du CQ demain ? (par défaut 10h)\n\nRécap:\n• Puissance: ${collectedData.puissanceKwc}kWc\n• Prix: ${collectedData.prixTTC?.toLocaleString("fr-FR")}€\n• CQ: ${collectedData.cqTime}\n\n*Confirmes-tu ?* (Oui/Non)`;
      }
      
      return {
        intent: "mark_signe",
        actionTaken: "collecting_data",
        newPendingAction: {
          ...pendingAction,
          collectedData,
        },
        responseMessage: nextQuestion || `Récap:\n• Puissance: ${collectedData.puissanceKwc}kWc\n• Prix: ${collectedData.prixTTC?.toLocaleString("fr-FR")}€\n• CQ: ${collectedData.cqTime || "10:00"}\n\n*Confirmes-tu ?* (Oui/Non)`,
      };
    }
    
    case "awaiting_whatsapp_approval": {
      const confirmPatterns = ["oui", "ok", "confirme", "envoie", "envoi", "go", "valide"];
      const isApproved = confirmPatterns.some(p => messageLower.includes(p));
      
      if (isApproved && pendingAction.collectedData?.whatsappMessage && pendingAction.collectedData?.confirmateurPhone) {
        // Send WhatsApp message to confirmateur
        const twilioNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
        if (twilioNumber) {
          try {
            await sendTwilioWhatsApp(
              twilioAccountSid,
              twilioAuthToken,
              twilioNumber,
              pendingAction.collectedData.confirmateurPhone,
              pendingAction.collectedData.whatsappMessage
            );
            
            return {
              intent: "approve_whatsapp",
              actionTaken: "whatsapp_sent",
              newPendingAction: null,
              responseMessage: `✅ Message envoyé au confirmateur ! 📲`,
            };
          } catch (err) {
            console.error("Error sending WhatsApp:", err);
            return {
              intent: "approve_whatsapp",
              actionTaken: "whatsapp_error",
              newPendingAction: null,
              responseMessage: `⚠️ Erreur lors de l'envoi: ${err instanceof Error ? err.message : "erreur inconnue"}`,
            };
          }
        }
      }
      
      return {
        intent: "decline_whatsapp",
        actionTaken: "whatsapp_declined",
        newPendingAction: null,
        responseMessage: "❌ Envoi annulé. La vente est enregistrée mais le confirmateur n'a pas été notifié.",
      };
    }
    
    case "awaiting_confirmation": {
      // Generic confirmation for other actions (including mass update_rdv)
      const confirmPatterns = ["oui", "ok", "confirme", "valide", "go", "yes", "c'est bon"];
      if (confirmPatterns.some(p => messageLower.includes(p))) {
        // Handle update_rdv mass action
        if (pendingAction.intent === "update_rdv" && pendingAction.collectedData?.rdvIds) {
          const rdvIds = pendingAction.collectedData.rdvIds;
          const action = pendingAction.collectedData.action;
          
          let updateData: Record<string, unknown> = {};
          
          if (action === "annule") {
            updateData = { status: "annule" };
          } else if (action === "reporte" || action === "decale") {
            if (pendingAction.collectedData.newDate || pendingAction.collectedData.newTime) {
              // Would need individual date handling - for now just update status
              updateData = { status: "reporte" };
            } else {
              updateData = { status: "reporte" };
            }
          }
          
          // Execute the mass update
          const { error: updateError, count } = await supabase
            .from("rdv")
            .update(updateData)
            .in("id", rdvIds);
          
          if (updateError) {
            console.error("Error mass updating RDVs:", updateError);
            return {
              intent: "update_rdv",
              actionTaken: "error",
              newPendingAction: null,
              responseMessage: `❌ Erreur lors de la mise à jour: ${updateError.message}`,
            };
          }
          
          // Log each action for undo capability
          for (const rdvId of rdvIds) {
            await logAgentAction(
              supabase,
              userId,
              null,
              "update_rdv",
              "rdv",
              rdvId,
              updateData,
              { status: "planifie" }, // Simplified previous state
              `RDV ${action === "annule" ? "annulé" : "modifié"} (action en masse)`
            );
          }
          
          const actionLabel = action === "annule" ? "annulé(s)" : action === "reporte" ? "reporté(s)" : "modifié(s)";
          return {
            intent: "update_rdv",
            actionTaken: "mass_rdv_updated",
            newPendingAction: null,
            responseMessage: `✅ ${rdvIds.length} RDV ${actionLabel} avec succès !`,
          };
        }
        
        // For other pending actions, return null to let main flow handle
        return null;
      }
      return {
        intent: "cancel_action",
        actionTaken: "cancelled",
        newPendingAction: null,
        responseMessage: "❌ Action annulée.",
      };
    }
    
    default:
      return null;
  }
}

// Create a signed vente from collected data
// deno-lint-ignore no-explicit-any
async function createSignedVente(
  supabase: any,
  userId: string,
  data: PendingAction["collectedData"]
): Promise<{ success: boolean; venteId?: string; error?: string }> {
  if (!data?.clientId || !data.rdvId) {
    return { success: false, error: "Données client/RDV manquantes" };
  }
  
  const puissance = data.puissanceKwc || 3;
  const prixTTC = data.prixTTC || 0;
  const tauxTVA = puissance <= 3 ? 1.10 : 1.20;
  const prixHT = prixTTC / tauxTVA;
  
  // Create or update vente
  const { data: vente, error } = await supabase
    .from("ventes")
    .insert({
      user_id: userId,
      client_id: data.clientId,
      rdv_id: data.rdvId,
      regie_id: data.regieId,
      puissance_kwc: puissance,
      montant_ttc: prixTTC,
      montant_ht: prixHT,
      status: "positif",
      date_signature: new Date().toISOString().split("T")[0],
      source: "whatsapp",
    })
    .select("id")
    .single();
  
  if (error) {
    console.error("Error creating vente:", error);
    return { success: false, error: error.message };
  }
  
  // Update RDV status
  await supabase
    .from("rdv")
    .update({ status: "positif" })
    .eq("id", data.rdvId);
  
  return { success: true, venteId: vente?.id };
}

// Generate confirmateur WhatsApp message
function generateConfirmateurMessage(
  clientName: string,
  puissanceKwc: number,
  prixTTC: number,
  cqTime: string,
  commentaire?: string
): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const formatDate = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  
  let msg = `*🎉 NOUVELLE VENTE SIGNÉE*\n\n`;
  msg += `👤 Client: *${clientName}*\n`;
  msg += `📅 Date: ${formatDate(now)}\n`;
  msg += `⚡ Puissance: *${puissanceKwc} kWc*\n`;
  msg += `💰 Prix: *${prixTTC.toLocaleString("fr-FR")}€ TTC*\n\n`;
  msg += `*📞 CQ prévu:*\n`;
  msg += `${formatDate(tomorrow)} à ${cqTime}\n`;
  
  if (commentaire) {
    msg += `\n💬 Note: ${commentaire}\n`;
  }
  
  msg += `\n---\n_Envoyé depuis DébalePro_`;
  
  return msg;
}

// Get confirmateur phone number
// deno-lint-ignore no-explicit-any
async function getConfirmateurPhone(
  supabase: any,
  userId: string,
  regieId?: string | null
): Promise<string | null> {
  // First try régie contact
  if (regieId) {
    const { data: regieContact } = await supabase
      .from("regies_contacts")
      .select("telephone")
      .eq("regie_id", regieId)
      .eq("is_principal", true)
      .eq("actif", true)
      .maybeSingle();
    
    if (regieContact?.telephone) {
      return `whatsapp:${regieContact.telephone.replace(/[^+\d]/g, "")}`;
    }
  }
  
  // Fallback to global settings
  const { data: settings } = await supabase
    .from("settings_notifications")
    .select("confirmateur_phone")
    .eq("user_id", userId)
    .maybeSingle();
  
  if (settings?.confirmateur_phone) {
    return `whatsapp:${settings.confirmateur_phone.replace(/[^+\d]/g, "")}`;
  }
  
  return null;
}

// Send WhatsApp message via Twilio
async function sendTwilioWhatsApp(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  toNumber: string,
  message: string
): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: message,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Twilio send error:", errorText);
    throw new Error(`Failed to send WhatsApp: ${response.status}`);
  }
  
  console.log(`WhatsApp sent to ${toNumber}`);
}

// Analyze intent with AI
async function analyzeIntent(
  content: string,
  userName: string,
  conversationContext: Array<{ role: string; content: string }>,
  pendingAction: unknown,
  userMemories: AgentMemory[],
  userPrompts: AgentPrompt[],
  apiKey: string
): Promise<{
  intent: Intent;
  confidence: number;
  entities: Record<string, unknown>;
  requiresConfirmation: boolean;
  responseMessage: string;
}> {
  const today = new Date().toISOString().split("T")[0];
  const memoriesSection = formatMemoriesForPrompt(userMemories);
  const customPromptsSection = formatPromptsForSystem(userPrompts);
  
  const systemPrompt = `Tu es l'assistant IA WhatsApp de DébalePro pour installateurs ENR.

MÉMOIRE UTILISATEUR:
${memoriesSection}
${customPromptsSection}

⚠️ CLASSIFICATION PRIORITAIRE - AVANT TOUTE CHOSE, DÉTERMINE:
Est-ce une ACTION (créer/modifier des données) ou une REMARQUE/CORRECTION (feedback sur mon comportement)?

SIGNAUX DE REMARQUE/CORRECTION (→ user_feedback):
- Commence par "non", "pas ça", "c'est pas ce que", "je voulais dire"
- Contient "tu dois", "il faut que tu", "rappelle-toi", "n'oublie pas"
- Contient "toujours", "jamais", "désormais", "à partir de maintenant"
- Contient "quand je dis X c'est Y", "X veut dire Y", "X = Y"
- Critique/corrige une réponse précédente: "non c'était pas bon", "tu as oublié de"
- Donne une instruction sur le format: "donne-moi aussi", "inclus toujours", "mets le jour"

SIGNAUX D'ACTION (→ autres intents):
- Mentionne un NOM DE CLIENT spécifique + une action concrète
- Demande explicite: "crée", "ajoute", "modifie", "supprime", "annule"
- Question sur des données: "planning", "combien", "mes ventes", "stats"
- Confirmation/annulation après une question de l'agent: "oui", "non", "confirme"

INTENTIONS DISPONIBLES:
- create_rdv: Créer RDV (ex: "rdv Dupont demain 14h")
- update_rdv: Modifier/annuler RDV (ex: "annule rdv Martin")
- mark_signe: Signature vente - workflow complet (ex: "Martin signé", "j'ai vendu chez Dupont")
- update_vente_status: Statut RDV (négatif, absent, r2, reporté) - NE PAS utiliser pour signé/positif
- update_vente_pipeline: Pipeline vente existante (posé, payé, CQ fait, annulé)
- import_document: Document client (CNI, RIB, facture énergie)
- import_facture: Note de frais (ticket, carburant, péage)
- query_commissions: "mes coms", "combien je gagne", "à facturer"
- query_stats: "stats", "CA", "taux conversion", "chiffres"
- query_client_info: "téléphone de X", "adresse de X"
- query_rdv_planning: "planning", "rdv demain", "agenda" → TOUJOURS citer JOUR + DATE + HEURE + NOM CLIENT
- query_rdv_detail: "topo Dupont", "infos rdv Martin", "brief client X" → Fiche détaillée avec CONSOMMATION, PROFIL CLIENT, COMMENTAIRES GMAIL
- query_ventes: "mes ventes", "ventes en cours"
- user_feedback: Corrections/préférences → EXTRAIRE feedback_type, feedback_key, feedback_value
- conversation: salutations simples
- unknown: non compris

STATUTS RDV: nouveau, positif, negatif, absent, reporte, r2, annule
STATUTS PIPELINE VENTE: cq_a_faire, cq_fait, attente_financement, envoi_pose, en_installation, installe, attente_paiement, paye, annule

⚠️ RÈGLES MÉTIER EXCLUSIONS:
- RDV "annule" ou "reporte" → JAMAIS comptés dans le planning actif, stats, ni actions en cours
- Ventes "annule" → JAMAIS comptées dans les ventes en cours, commissions, ni CA
- Quand l'utilisateur demande "mes rdv" ou "planning" → NE PAS inclure les annulés/reportés
- Quand l'utilisateur demande "mes ventes" ou "ventes en cours" → NE PAS inclure les annulées
- Les dossiers annulés sont considérés comme fermés définitivement

RÈGLES CRITIQUES:
1. Pour "signé/positif/vente/j'ai vendu" → TOUJOURS mark_signe (workflow complet avec collecte données)
2. Pour "posé/installé" → update_vente_pipeline avec installe
3. Pour "payé" → update_vente_pipeline avec paye
4. Pour "absent/négatif" → update_vente_status
5. Actions en masse: LISTER d'abord, demander confirmation explicite
6. Si le message CRITIQUE ou CORRIGE mon comportement → TOUJOURS user_feedback

EXEMPLES DE CLASSIFICATION:
- "Dupont posé" → update_vente_pipeline (ACTION: client + statut)
- "quand tu donnes le planning mets toujours le jour" → user_feedback (REMARQUE: instruction format)
- "non c'est pas ça, je voulais dire Martin pas Dupont" → user_feedback (CORRECTION)
- "rappelle-toi que X veut dire Y" → user_feedback (RÈGLE)
- "mes rdv demain" → query_rdv_planning (ACTION: demande données)
- "tu as oublié de donner l'heure" → user_feedback (CRITIQUE comportement)

Format réponse JSON:
{"intent":"...","confidence":0-100,"entities":{"client_name":"...","date":"YYYY-MM-DD","time":"HH:MM","status":"...","pipeline_status":"...","period":"today|week|month|all","amount":number,"feedback_type":"correction|preference|rule|alias","feedback_key":"ce que je dois retenir","feedback_value":"la règle/correction exacte"},"requiresConfirmation":true/false,"responseMessage":"..."}

Pour requêtes (query_*): responseMessage très court ("📊"), les données sont formatées automatiquement.
Contexte: ${userName} | Date: ${today}
${pendingAction ? `En attente: ${JSON.stringify(pendingAction)}` : ""}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationContext.slice(-4).map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content
    })),
    { role: "user", content }
  ];

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      max_tokens: 4000,
      tools: [
        {
          type: "function",
          function: {
            name: "analyze_intent",
            description: "Analyze the user's intent and extract entities",
            parameters: {
              type: "object",
              properties: {
                intent: {
                  type: "string",
                  enum: ["create_rdv", "update_rdv", "mark_signe", "update_vente_status", "update_vente_pipeline", "import_document", "import_facture", "query_commissions", "query_stats", "query_client_info", "query_rdv_planning", "query_rdv_detail", "query_ventes", "user_feedback", "confirm_action", "cancel_action", "conversation", "unknown"]
                },
                confidence: { type: "number", minimum: 0, maximum: 100 },
                entities: {
                  type: "object",
                  properties: {
                    client_name: { type: "string" },
                    date: { type: "string" },
                    time: { type: "string" },
                    address: { type: "string" },
                    status: { type: "string" },
                    pipeline_status: { type: "string", enum: ["cq_a_faire", "cq_fait", "attente_financement", "envoi_pose", "en_installation", "installe", "attente_paiement", "paye", "annule"] },
                    amount: { type: "number" },
                    document_type: { type: "string" },
                    period: { type: "string", enum: ["today", "week", "month", "all"] },
                    query_type: { type: "string", enum: ["list", "total", "detail"] },
                    feedback_type: { type: "string", enum: ["correction", "preference", "rule", "alias"] },
                    feedback_key: { type: "string", description: "What the user wants to correct or define (e.g. 'planning response', 'client name Martin')" },
                    feedback_value: { type: "string", description: "The correction or preference value (e.g. 'always include date and time', 'means Jean-Martin Dupont')" }
                  }
                },
                requiresConfirmation: { type: "boolean" },
                responseMessage: { type: "string" }
              },
              required: ["intent", "confidence", "entities", "requiresConfirmation", "responseMessage"]
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "analyze_intent" } }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("AI API error:", error);
    throw new Error("Failed to analyze intent");
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  
  if (toolCall?.function?.arguments) {
    return JSON.parse(toolCall.function.arguments);
  }

  // Fallback response
  return {
    intent: "unknown",
    confidence: 0,
    entities: {},
    requiresConfirmation: false,
    responseMessage: "Je n'ai pas compris votre demande. Pouvez-vous reformuler ? 🤔"
  };
}

// Execute action based on intent
// deno-lint-ignore no-explicit-any
async function executeAction(
  supabase: any,
  userId: string,
  userName: string,
  messageId: string,
  intent: Intent,
  entities: Record<string, unknown>,
  uploadedDocumentUrl: string | null,
  mediaData: MediaDownloadResult | null,
  analysisResult: DocumentAnalysisResult | null,
  twilioAccountSid: string,
  twilioAuthToken: string
): Promise<{ actionTaken?: string; entityId?: string; entityType?: string; newPendingAction?: PendingAction | null; customResponse?: string }> {
  console.log(`Executing action: ${intent}`, entities);

  switch (intent) {
    case "create_rdv": {
      // Search for client by name with fuzzy matching
      const clientName = entities.client_name as string;
      if (!clientName) {
        return { actionTaken: "missing_client" };
      }

      const searchResult = await findClientByName(supabase, userId, clientName);
      
      if (searchResult.notFound) {
        return { 
          actionTaken: "client_not_found",
          customResponse: `❌ Aucun client trouvé pour "${clientName}". Vérifie l'orthographe ou crée d'abord le client.`
        };
      }
      
      // If no exact match but we have suggestions
      if (!searchResult.exactMatch && searchResult.suggestions.length > 0) {
        const suggestionList = searchResult.suggestions
          .map(s => `• ${s.fullName} (${Math.round(s.score * 100)}%)`)
          .join("\n");
        return {
          actionTaken: "client_ambiguous",
          customResponse: `🔍 Pas de correspondance exacte pour "${clientName}". Tu voulais peut-être:\n${suggestionList}\n\nPrécise le nom complet.`
        };
      }

      const client = searchResult.exactMatch || searchResult.clients[0];
      
      // Parse date and time
      const dateStr = entities.date as string || new Date().toISOString().split("T")[0];
      const timeStr = entities.time as string || "10:00";
      const dateHeure = `${dateStr}T${timeStr}:00`;

      // Create RDV
      const { data: rdv, error: rdvError } = await supabase
        .from("rdv")
        .insert({
          user_id: userId,
          client_id: client.id,
          date_heure: dateHeure,
          adresse: entities.address as string || null,
          status: "planifie",
          type_rdv: "R1",
          type_projet: "pv",
          source: "whatsapp",
        })
        .select("id")
        .single();

      if (rdvError) {
        console.error("Error creating RDV:", rdvError);
        return { actionTaken: "error" };
      }

      // Log the action for audit trail
      await logAgentAction(
        supabase,
        userId,
        messageId,
        "create_rdv",
        "rdv",
        rdv?.id,
        { date_heure: dateHeure, client_id: client.id, status: "planifie" },
        null, // No previous data for creation
        `Création RDV ${client.prenom || ""} ${client.nom} le ${dateStr} à ${timeStr}`
      );

      return { 
        actionTaken: "rdv_created", 
        entityId: rdv?.id, 
        entityType: "rdv" 
      };
    }

    case "update_rdv": {
      const clientName = entities.client_name as string;
      const action = entities.action as string; // "annule", "reporte", "decale"
      const newDate = entities.date as string;
      const newTime = entities.time as string;
      const period = entities.period as string; // "today", "week", "month", "all"
      const regieFilter = entities.regie_name as string;
      
      // Build query for RDVs to modify
      let query = supabase
        .from("rdv")
        .select(`
          id,
          date_heure,
          status,
          client_id,
          clients!inner(nom, prenom)
        `)
        .eq("user_id", userId);
      
      // Apply filters
      if (clientName) {
        query = query.or(`clients.nom.ilike.%${clientName}%,clients.prenom.ilike.%${clientName}%`);
      }
      
      // Apply period filter
      const now = new Date();
      if (period === "today") {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        query = query.gte("date_heure", todayStart.toISOString()).lt("date_heure", todayEnd.toISOString());
      } else if (period === "week") {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        query = query.gte("date_heure", weekStart.toISOString()).lt("date_heure", weekEnd.toISOString());
      } else if (period === "next_week") {
        const nextWeekStart = new Date(now);
        nextWeekStart.setDate(now.getDate() - now.getDay() + 8); // Next Monday
        nextWeekStart.setHours(0, 0, 0, 0);
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
        query = query.gte("date_heure", nextWeekStart.toISOString()).lt("date_heure", nextWeekEnd.toISOString());
      } else if (period === "month") {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        query = query.gte("date_heure", monthStart.toISOString()).lt("date_heure", monthEnd.toISOString());
      }
      
      // Filter by status - only modifiable statuses
      query = query.in("status", ["planifie", "confirme", "a_rappeler", "reporte"]);
      query = query.order("date_heure", { ascending: true });
      
      const { data: rdvsToModify, error: rdvError } = await query;
      
      if (rdvError) {
        console.error("Error fetching RDVs:", rdvError);
        return { actionTaken: "error" };
      }
      
      if (!rdvsToModify || rdvsToModify.length === 0) {
        return { 
          actionTaken: "rdv_not_found",
          customResponse: "❌ Aucun RDV trouvé correspondant à ta demande.",
        };
      }
      
      // If multiple RDVs found, require confirmation
      if (rdvsToModify.length > 1) {
        // Build the list of RDVs for confirmation
        const rdvList = rdvsToModify.map((r: { id: string; date_heure: string; clients: { nom: string; prenom: string | null } }) => {
          const d = new Date(r.date_heure);
          const dateStr = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
          const timeStr = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
          const clientFullName = `${r.clients.prenom || ""} ${r.clients.nom}`.trim();
          return { id: r.id, display: `${dateStr} ${timeStr}: ${clientFullName}` };
        });
        
        // Build filter description
        const filterParts: string[] = [];
        if (period) {
          const periodLabels: Record<string, string> = {
            today: "aujourd'hui",
            week: "cette semaine",
            next_week: "semaine prochaine",
            month: "ce mois",
            all: "tout",
          };
          filterParts.push(periodLabels[period] || period);
        }
        if (regieFilter) filterParts.push(`régie: ${regieFilter}`);
        if (clientName) filterParts.push(`client: ${clientName}`);
        
        const filterDesc = filterParts.length > 0 ? `Filtre: ${filterParts.join(", ")}` : "";
        
        // Create pending action for confirmation
        const actionLabel = action === "annule" ? "annuler" : action === "reporte" ? "reporter" : "modifier";
        
        const pendingAction: PendingAction = {
          intent: "update_rdv",
          entities,
          workflowState: "awaiting_confirmation",
          collectedData: {
            rdvIds: rdvList.map((r: { id: string }) => r.id),
            action,
            newDate,
            newTime,
          },
          createdAt: new Date().toISOString(),
        };
        
        let confirmMsg = `📋 *RDV à ${actionLabel}* (${rdvsToModify.length})\n`;
        if (filterDesc) confirmMsg += `_${filterDesc}_\n`;
        confirmMsg += "\n";
        
        for (const r of rdvList.slice(0, 10)) {
          confirmMsg += `• ${r.display}\n`;
        }
        if (rdvList.length > 10) {
          confirmMsg += `... et ${rdvList.length - 10} autre(s)\n`;
        }
        
        confirmMsg += `\n*Confirmes-tu l'action sur ces ${rdvsToModify.length} RDV ?* (Oui/Non)`;
        
        return {
          actionTaken: "awaiting_confirmation",
          entityType: "workflow",
          newPendingAction: pendingAction,
          customResponse: confirmMsg,
        };
      }
      
      // Single RDV - execute directly
      const rdv = rdvsToModify[0];
      let newStatus = rdv.status;
      let updateData: Record<string, unknown> = {};
      
      if (action === "annule") {
        newStatus = "annule";
        updateData = { status: newStatus };
      } else if (action === "reporte" || action === "decale") {
        if (newDate || newTime) {
          const currentDate = new Date(rdv.date_heure);
          const targetDate = newDate ? new Date(newDate) : currentDate;
          if (newTime) {
            const [hours, mins] = newTime.split(":").map(Number);
            targetDate.setHours(hours, mins, 0, 0);
          } else {
            targetDate.setHours(currentDate.getHours(), currentDate.getMinutes(), 0, 0);
          }
          updateData = { date_heure: targetDate.toISOString(), status: "reporte" };
          newStatus = "reporte";
        } else {
          updateData = { status: "reporte" };
          newStatus = "reporte";
        }
      }
      
      // Get previous data for undo capability
      const previousRdvData = await getPreviousData(supabase, "rdv", rdv.id, userId);
      
      const { error: updateError } = await supabase
        .from("rdv")
        .update(updateData)
        .eq("id", rdv.id);
      
      if (updateError) {
        console.error("Error updating RDV:", updateError);
        return { actionTaken: "error" };
      }
      
      // Log the action
      const clientInfo = rdv.clients as { nom: string; prenom?: string };
      const clientFullName = `${clientInfo?.prenom || ""} ${clientInfo?.nom || ""}`.trim();
      await logAgentAction(
        supabase,
        userId,
        messageId,
        "update_rdv",
        "rdv",
        rdv.id,
        updateData,
        previousRdvData,
        `Modification RDV ${clientFullName}: ${action === "annule" ? "annulé" : action === "reporte" ? "reporté" : "modifié"}`
      );
      
      return {
        actionTaken: "rdv_updated",
        entityId: rdv.id,
        entityType: "rdv",
      };
    }

    case "update_vente_status": {
      const clientName = entities.client_name as string;
      const status = entities.status as string;

      if (!clientName || !status) {
        return { actionTaken: "missing_data" };
      }

      // Find client with fuzzy search
      const searchResult = await findClientByName(supabase, userId, clientName);
      
      if (searchResult.notFound) {
        return { 
          actionTaken: "client_not_found",
          customResponse: `❌ Aucun client "${clientName}" trouvé.`
        };
      }
      
      if (!searchResult.exactMatch && searchResult.suggestions.length > 0) {
        const suggestionList = searchResult.suggestions
          .map(s => `• ${s.fullName}`)
          .join("\n");
        return {
          actionTaken: "client_ambiguous",
          customResponse: `🔍 Pas de correspondance exacte pour "${clientName}". Tu voulais:\n${suggestionList}`
        };
      }

      const matchedClient = searchResult.exactMatch || searchResult.clients[0];

      // Find the most recent RDV for this client
      const { data: rdvs, error: rdvError } = await supabase
        .from("rdv")
        .select(`
          id,
          client_id,
          clients!inner(nom, prenom)
        `)
        .eq("user_id", userId)
        .eq("client_id", matchedClient.id)
        .order("date_heure", { ascending: false })
        .limit(1);

      if (rdvError || !rdvs || rdvs.length === 0) {
        return { actionTaken: "rdv_not_found" };
      }

      const rdv = rdvs[0];

      // Map status to enum value
      const statusMap: Record<string, string> = {
        positif: "positif",
        negatif: "negatif",
        absent: "absent",
        reporte: "reporte",
        a_rappeler: "a_rappeler",
      };

      const mappedStatus = statusMap[status] || status;

      // Get previous data for undo
      const previousRdvData = await getPreviousData(supabase, "rdv", rdv.id, userId);

      // Update RDV status
      const { error: updateError } = await supabase
        .from("rdv")
        .update({ status: mappedStatus })
        .eq("id", rdv.id);

      if (updateError) {
        console.error("Error updating RDV:", updateError);
        return { actionTaken: "error" };
      }

      // Log the action
      const clientInfo = rdv.clients as { nom: string; prenom?: string };
      const clientFullName = `${clientInfo?.prenom || ""} ${clientInfo?.nom || ""}`.trim();
      await logAgentAction(
        supabase,
        userId,
        messageId,
        "update_vente_status",
        "rdv",
        rdv.id,
        { status: mappedStatus },
        previousRdvData,
        `Statut RDV ${clientFullName} → ${mappedStatus}`
      );

      return { 
        actionTaken: "status_updated", 
        entityId: rdv.id, 
        entityType: "rdv" 
      };
    }

    case "update_vente_pipeline": {
      // Update the pipeline status of an existing vente
      const clientName = entities.client_name as string;
      const pipelineStatus = entities.pipeline_status as string;
      const installDate = entities.date as string;
      
      if (!clientName) {
        return {
          actionTaken: "missing_data",
          customResponse: "❌ Indique-moi le nom du client pour mettre à jour la vente.",
        };
      }
      
      if (!pipelineStatus) {
        return {
          actionTaken: "missing_data",
          customResponse: "❌ Je n'ai pas compris le statut. Précise : posé, payé, CQ fait, installation demain, annulé, etc.",
        };
      }
      
      // Find client with fuzzy search
      const searchResult = await findClientByName(supabase, userId, clientName);
      
      if (searchResult.notFound) {
        return { 
          actionTaken: "client_not_found",
          customResponse: `❌ Aucun client "${clientName}" trouvé. Vérifie l'orthographe.`
        };
      }
      
      if (!searchResult.exactMatch && searchResult.suggestions.length > 0) {
        const suggestionList = searchResult.suggestions
          .map(s => `• ${s.fullName}`)
          .join("\n");
        return {
          actionTaken: "client_ambiguous",
          customResponse: `🔍 Pas de correspondance exacte pour "${clientName}". Tu voulais:\n${suggestionList}`
        };
      }

      const matchedClient = searchResult.exactMatch || searchResult.clients[0];
      
      // Find the vente for this client
      const { data: ventes, error: venteError } = await supabase
        .from("ventes")
        .select(`
          id,
          status,
          montant_ttc,
          puissance_kwc,
          date_installation,
          clients!inner(id, nom, prenom)
        `)
        .eq("user_id", userId)
        .eq("client_id", matchedClient.id)
        .not("status", "eq", "annule")
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (venteError || !ventes || ventes.length === 0) {
        return {
          actionTaken: "vente_not_found",
          customResponse: `❌ Aucune vente trouvée pour "${matchedClient.fullName}". Vérifie le statut de la vente.`,
        };
      }
      
      const vente = ventes[0];
      // deno-lint-ignore no-explicit-any
      const client = vente.clients as any;
      const clientFullName = `${client?.prenom || ""} ${client?.nom || ""}`.trim();
      
      // Get previous data for undo
      const previousVenteData = await getPreviousData(supabase, "ventes", vente.id, userId);
      
      // Prepare update data
      // deno-lint-ignore no-explicit-any
      const updateData: any = { status: pipelineStatus };
      
      // If "installe" status, set installation date
      if (pipelineStatus === "installe" && !vente.date_installation) {
        updateData.date_installation = new Date().toISOString().split("T")[0];
      }
      
      // If installation date mentioned (e.g., "installation demain")
      if (installDate && (pipelineStatus === "envoi_pose" || pipelineStatus === "en_installation")) {
        updateData.date_installation = installDate;
      }
      
      const { error: updateError } = await supabase
        .from("ventes")
        .update(updateData)
        .eq("id", vente.id);
      
      if (updateError) {
        console.error("Error updating vente:", updateError);
        return { actionTaken: "error" };
      }
      
      // Log the action
      const statusLabels: Record<string, string> = {
        cq_a_faire: "CQ à faire",
        cq_fait: "CQ fait",
        attente_financement: "Attente financement",
        envoi_pose: "Envoi pose",
        en_installation: "En installation",
        installe: "Posé ✅",
        attente_paiement: "Attente paiement",
        paye: "Payé 💰",
        annule: "Annulé ❌",
      };
      
      await logAgentAction(
        supabase,
        userId,
        messageId,
        "update_vente_pipeline",
        "ventes",
        vente.id,
        updateData,
        previousVenteData,
        `Vente ${clientFullName} → ${statusLabels[pipelineStatus] || pipelineStatus}`
      );
      
      return {
        actionTaken: "vente_pipeline_updated",
        entityId: vente.id,
        entityType: "vente",
        customResponse: `✅ Vente ${clientFullName} mise à jour: ${statusLabels[pipelineStatus] || pipelineStatus}${updateData.date_installation ? ` (${updateData.date_installation})` : ""}`,
      };
    }

    case "mark_signe": {
      // Start the signing workflow - collect required data
      const clientName = entities.client_name as string;
      
      let matchedClient: ClientMatch | null = null;
      let rdv: { id: string; client_id: string; regie_id: string | null } | null = null;
      
      // First, find the client using fuzzy search
      if (clientName) {
        const searchResult = await findClientByName(supabase, userId, clientName);
        
        if (searchResult.notFound) {
          return { 
            actionTaken: "client_not_found",
            customResponse: `❌ Aucun client "${clientName}" trouvé. Vérifie l'orthographe.`
          };
        }
        
        if (!searchResult.exactMatch && searchResult.suggestions.length > 0) {
          const suggestionList = searchResult.suggestions
            .map(s => `• ${s.fullName}`)
            .join("\n");
          return {
            actionTaken: "client_ambiguous",
            customResponse: `🔍 Pas de correspondance exacte pour "${clientName}". Tu voulais:\n${suggestionList}`
          };
        }
        
        matchedClient = searchResult.exactMatch || searchResult.clients[0];
        
        // Find RDV for this client
        const { data: rdvs } = await supabase
          .from("rdv")
          .select("id, client_id, regie_id")
          .eq("user_id", userId)
          .eq("client_id", matchedClient.id)
          .order("date_heure", { ascending: false })
          .limit(1);
        
        if (rdvs && rdvs.length > 0) {
          rdv = rdvs[0];
        }
      } else {
        // No client name - get most recent RDV
        const { data: rdvs, error: rdvError } = await supabase
          .from("rdv")
          .select(`id, client_id, regie_id, clients!inner(id, nom, prenom)`)
          .eq("user_id", userId)
          .order("date_heure", { ascending: false })
          .limit(1);
        
        if (rdvError || !rdvs || rdvs.length === 0) {
          return { 
            actionTaken: "rdv_not_found",
            customResponse: "❌ Aucun RDV trouvé. Indique-moi le nom du client pour la vente.",
          };
        }
        
        rdv = rdvs[0];
        // deno-lint-ignore no-explicit-any
        const clientData = (rdvs[0] as any).clients;
        matchedClient = {
          id: clientData.id,
          nom: clientData.nom,
          prenom: clientData.prenom,
          fullName: `${clientData.prenom || ""} ${clientData.nom}`.trim(),
          score: 1,
          matchType: "exact"
        };
      }
      
      if (!matchedClient) {
        return { 
          actionTaken: "client_not_found",
          customResponse: "❌ Aucun client trouvé. Indique-moi le nom du client.",
        };
      }
      
      const clientFullName = matchedClient.fullName;
      
      // Check if price was mentioned in the message
      const amount = entities.amount as number;
      const puissance = entities.puissance_kwc as number;
      
      // Start the multi-step workflow
      const pendingAction: PendingAction = {
        intent: "mark_signe",
        entities,
        workflowState: "collecting_signe_data",
        collectedData: {
          clientId: matchedClient.id,
          clientName: clientFullName,
          rdvId: rdv?.id,
          regieId: rdv?.regie_id || undefined,
          puissanceKwc: puissance || undefined,
          prixTTC: amount || undefined,
        },
        createdAt: new Date().toISOString(),
      };
      
      let responseMsg = `✍️ *Nouvelle vente pour ${clientFullName}* 🎉\n\n`;
      
      if (!puissance) {
        responseMsg += "📊 Quelle est la *puissance* installée (en kWc) ?";
      } else if (!amount) {
        responseMsg += "💰 Quel est le *prix TTC* de la vente ?";
      } else {
        responseMsg += `Récap:\n• Puissance: ${puissance}kWc\n• Prix: ${amount.toLocaleString("fr-FR")}€\n• CQ: 10h\n\n*Confirmes-tu ?* (Oui/Non)`;
      }
      
      return {
        actionTaken: "collecting_signe_data",
        entityType: "workflow",
        newPendingAction: pendingAction,
        customResponse: responseMsg,
      };
    }

    case "import_document": {
      if (!uploadedDocumentUrl) {
        return { actionTaken: "no_media" };
      }

      // Get document type from analysis result if available
      let documentType = entities.document_type as string || "autre";
      if (analysisResult && analysisResult.type === "client_docs" && analysisResult.success) {
        documentType = analysisResult.document_type || documentType;
      }
      
      const clientName = entities.client_name as string;
      
      // Try to find the client if name was mentioned using fuzzy search
      let clientId: string | null = null;
      let fuzzyMatchInfo: string | null = null;
      
      if (clientName) {
        const searchResult = await findClientByName(supabase, userId, clientName);
        
        if (searchResult.exactMatch) {
          clientId = searchResult.exactMatch.id;
        } else if (searchResult.clients.length > 0 && searchResult.clients[0].score >= 0.7) {
          // Use best fuzzy match if score is high enough
          clientId = searchResult.clients[0].id;
          fuzzyMatchInfo = searchResult.clients[0].fullName;
          console.log(`Fuzzy matched "${clientName}" to "${fuzzyMatchInfo}"`);
        }
      }

      // If no client found, get the most recent one with active RDV
      if (!clientId) {
        const { data: recentRdv } = await supabase
          .from("rdv")
          .select("client_id")
          .eq("user_id", userId)
          .order("date_heure", { ascending: false })
          .limit(1);
        
        if (recentRdv && recentRdv.length > 0) {
          clientId = recentRdv[0].client_id;
        }
      }

      if (!clientId) {
        return { actionTaken: "no_client_found" };
      }

      // Map document type to enum - extended with all types from analyze-document
      const docTypeMap: Record<string, string> = {
        cni: "cni",
        cni_monsieur_recto: "cni",
        cni_monsieur_verso: "cni",
        cni_madame_recto: "cni",
        cni_madame_verso: "cni",
        rib: "rib",
        facture_energie: "facture_energie",
        avis_impots: "avis_imposition",
        avis_imposition: "avis_imposition",
        photo_compteur: "photo_compteur",
        photo_tableau: "photo_tableau",
        photo_toiture: "photo_toiture",
        photo_chantier: "photo_chantier",
        justificatif_domicile: "justificatif_domicile",
        taxe_fonciere: "taxe_fonciere",
        bon_commande: "bon_commande",
        devis: "devis",
        contrat: "contrat",
        autre: "autre",
      };

      // Build metadata from analysis result
      const metadata: Record<string, unknown> = {};
      if (analysisResult && analysisResult.type === "client_docs") {
        metadata.ai_document_type = analysisResult.document_type;
        metadata.ai_confidence = analysisResult.confidence;
        metadata.ai_description = analysisResult.description;
      }

      // Create document record
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          user_id: userId,
          client_id: clientId,
          nom: `${documentType}_whatsapp_${Date.now()}`,
          type_document: docTypeMap[documentType] || "autre",
          url: uploadedDocumentUrl,
          mime_type: mediaData?.contentType || "application/octet-stream",
          context_source: "whatsapp",
          metadata,
        })
        .select("id")
        .single();

      if (docError) {
        console.error("Error creating document:", docError);
        return { actionTaken: "error" };
      }

      return {
        actionTaken: "document_imported",
        entityId: doc?.id,
        entityType: "document",
      };
    }

    case "import_facture": {
      if (!uploadedDocumentUrl) {
        return { actionTaken: "no_media" };
      }

      // Use structured analysis result for finance data
      let montant = 0;
      let dateStr = new Date().toISOString().split("T")[0];
      let fournisseur = "";
      let description = "Import WhatsApp";
      let categorie = "autre";
      
      if (analysisResult && analysisResult.type === "finance" && analysisResult.success) {
        const fin = analysisResult as FinanceAnalysisResult;
        montant = fin.montant_ttc || 0;
        dateStr = fin.date || dateStr;
        fournisseur = fin.fournisseur || "";
        description = fin.description || `${fournisseur} - Import WhatsApp`;
        categorie = fin.categorie || "autre";
      } else {
        // Fallback to entities
        montant = entities.amount as number || 0;
      }

      // Build OCR data from analysis
      const ocrData: Record<string, unknown> = {};
      if (analysisResult && analysisResult.type === "finance") {
        const fin = analysisResult as FinanceAnalysisResult;
        ocrData.montant_ttc = fin.montant_ttc;
        ocrData.montant_ht = fin.montant_ht;
        ocrData.tva = fin.tva;
        ocrData.taux_tva = fin.taux_tva;
        ocrData.fournisseur = fin.fournisseur;
        ocrData.date = fin.date;
        ocrData.categorie = fin.categorie;
        ocrData.description = fin.description;
      }

      // Create frais record
      const { data: frais, error: fraisError } = await supabase
        .from("frais")
        .insert({
          user_id: userId,
          categorie: categorie,
          montant: montant,
          date_frais: dateStr,
          description: description,
          justificatif_url: uploadedDocumentUrl,
          ocr_data: ocrData,
        })
        .select("id")
        .single();

      if (fraisError) {
        console.error("Error creating frais:", fraisError);
        return { actionTaken: "error" };
      }

      // Log the action
      await logAgentAction(
        supabase,
        userId,
        messageId,
        "create_frais",
        "frais",
        frais?.id,
        { montant, categorie, date_frais: dateStr, fournisseur },
        null, // No previous data for creation
        `Note de frais ${fournisseur || "importée"}: ${montant}€ (${categorie})`
      );

      return {
        actionTaken: "frais_imported",
        entityId: frais?.id,
        entityType: "frais",
      };
    }

    case "query_commissions": {
      // Get commission stats
      const { data: ventes, error: ventesError } = await supabase
        .from("ventes")
        .select(`
          id,
          montant_ttc,
          montant_ht,
          puissance_kwc,
          date_signature,
          date_pose,
          status,
          type_vente,
          decom_montant,
          clients(nom, prenom),
          regies(nom, mode_calcul_commission)
        `)
        .eq("user_id", userId)
        .not("status", "eq", "annule");

      if (ventesError) {
        console.error("Error fetching ventes:", ventesError);
        return { actionTaken: "error" };
      }

      // Calculate commissions
      let totalEnCours = 0;
      let totalAFacturer = 0;
      let countEnCours = 0;
      let countAFacturer = 0;
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      for (const v of ventes || []) {
        // Skip external installations for regular commission calc
        const isExternal = v.type_vente === "external_installation";
        
        let commission = 0;
        if (isExternal) {
          commission = (v.montant_ht || 0) - (v.decom_montant || 0);
        } else {
          // Bouquet mode: Fixed per kWc + 50% survente HT
          const puissance = v.puissance_kwc || 0;
          const fixeParKwc = 250; // Default
          const fixe = puissance * fixeParKwc;
          
          // Calculate commission based on puissance
          const totalTTC = v.montant_ttc || 0;
          // Use a simple commission formula: fixed per kWc + percentage
          const tva = puissance <= 3 ? 1.10 : 1.20;
          const totalHT = totalTTC / tva;
          
          // Base commission: 250€ per kWc
          commission = puissance * 250;
          
          // Add bonus for higher amounts (simplified survente)
          const basePrice = puissance * 2500; // Average base price per kWc
          if (totalHT > basePrice) {
            const surventeHT = totalHT - basePrice;
            commission += surventeHT * 0.5;
          }
        }

        if (v.date_pose) {
          const datePose = new Date(v.date_pose);
          if (datePose >= twoWeeksAgo) {
            // Installed < 2 weeks = pending
            totalEnCours += commission;
            countEnCours++;
          } else {
            // Installed >= 2 weeks = ready to invoice
            totalAFacturer += commission;
            countAFacturer++;
          }
        } else if (v.status === "positif" || v.status === "signe" || v.status === "cq_a_faire" || v.status === "cq_fait") {
          // Not installed yet
          totalEnCours += commission;
          countEnCours++;
        }
      }

      const responseData = {
        en_cours: { count: countEnCours, total: Math.round(totalEnCours) },
        a_facturer: { count: countAFacturer, total: Math.round(totalAFacturer) },
        total: Math.round(totalEnCours + totalAFacturer)
      };

      return {
        actionTaken: "query_commissions_result",
        entityType: "commissions",
        entityId: JSON.stringify(responseData),
      };
    }

    case "query_stats": {
      const period = (entities.period as string) || "month";
      let startDate: Date;
      const now = new Date();
      
      switch (period) {
        case "today":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "all":
          startDate = new Date(2020, 0, 1);
          break;
        default: // month
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Count RDV (exclure annulés et reportés)
      const { count: rdvCount } = await supabase
        .from("rdv")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("status", "in", "(annule,reporte)")
        .gte("date_heure", startDate.toISOString());

      // Count ventes positives
      const { data: ventesData } = await supabase
        .from("ventes")
        .select("id, montant_ht, status")
        .eq("user_id", userId)
        .in("status", ["positif", "signe", "installe", "cq_a_faire", "cq_fait", "attente_financement", "envoi_pose", "en_installation", "attente_paiement", "paye"])
        .gte("created_at", startDate.toISOString());

      const ventesCount = ventesData?.length || 0;
      const ca = ventesData?.reduce((sum: number, v: { montant_ht: number | null }) => sum + (v.montant_ht || 0), 0) || 0;

      // Conversion rate
      const tauxConversion = rdvCount && rdvCount > 0 ? Math.round((ventesCount / rdvCount) * 100) : 0;

      const responseData = {
        period,
        rdv: rdvCount || 0,
        ventes: ventesCount,
        ca: Math.round(ca),
        taux_conversion: tauxConversion
      };

      return {
        actionTaken: "query_stats_result",
        entityType: "stats",
        entityId: JSON.stringify(responseData),
      };
    }

    case "query_client_info": {
      const clientName = entities.client_name as string;
      if (!clientName) {
        return { actionTaken: "missing_client_name" };
      }

      const searchResult = await findClientByName(supabase, userId, clientName);
      
      if (searchResult.notFound) {
        return { 
          actionTaken: "client_not_found",
          customResponse: `❌ Aucun client trouvé pour "${clientName}".`
        };
      }
      
      // If no exact match but we have suggestions
      if (!searchResult.exactMatch && searchResult.suggestions.length > 0) {
        const suggestionList = searchResult.suggestions
          .map(s => `• ${s.fullName} (${Math.round(s.score * 100)}%)`)
          .join("\n");
        return {
          actionTaken: "client_ambiguous",
          customResponse: `🔍 Pas de correspondance exacte pour "${clientName}". Tu voulais peut-être:\n${suggestionList}`
        };
      }
      
      // Get full client info for matched clients
      const matchedIds = searchResult.exactMatch 
        ? [searchResult.exactMatch.id]
        : searchResult.clients.slice(0, 3).map(c => c.id);

      const { data: clients, error } = await supabase
        .from("clients")
        .select("id, nom, prenom, telephone, telephone_secondaire, email, adresse, code_postal, ville")
        .eq("user_id", userId)
        .in("id", matchedIds);

      if (error || !clients || clients.length === 0) {
        return { actionTaken: "client_not_found" };
      }

      // deno-lint-ignore no-explicit-any
      const responseData = clients.map((c: any) => ({
        nom: `${c.prenom || ""} ${c.nom}`.trim(),
        telephone: c.telephone,
        telephone2: c.telephone_secondaire,
        email: c.email,
        adresse: c.adresse ? `${c.adresse}, ${c.code_postal || ""} ${c.ville || ""}`.trim() : null
      }));

      return {
        actionTaken: "query_client_result",
        entityType: "client",
        entityId: JSON.stringify(responseData),
      };
    }

    case "query_rdv_planning": {
      const period = (entities.period as string) || "today";
      let startDate: Date;
      let endDate: Date;
      const now = new Date();
      
      switch (period) {
        case "week":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
        default: // today
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
      }

      const { data: rdvs, error } = await supabase
        .from("rdv")
        .select(`
          id,
          date_heure,
          adresse,
          status,
          type_rdv,
          clients(nom, prenom, telephone)
        `)
        .eq("user_id", userId)
        .not("status", "in", "(annule,reporte)") // Exclure annulés et reportés
        .gte("date_heure", startDate.toISOString())
        .lt("date_heure", endDate.toISOString())
        .order("date_heure", { ascending: true })
        .limit(50);

      if (error) {
        console.error("Error fetching RDV:", error);
        return { actionTaken: "error" };
      }

      // Format days in French
      const joursFr = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
      
      // deno-lint-ignore no-explicit-any
      const responseData = (rdvs || []).map((r: any) => {
        const client = r.clients as { nom: string; prenom: string; telephone: string } | null;
        const rdvDate = new Date(r.date_heure);
        const jour = joursFr[rdvDate.getDay()];
        const dateFormatted = rdvDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
        const heure = rdvDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const clientNom = client ? `${client.prenom || ""} ${client.nom}`.trim() : "?";
        
        return {
          display: `${jour} ${dateFormatted} à ${heure} - ${clientNom}`,
          jour,
          date: dateFormatted,
          heure,
          client: clientNom,
          telephone: client?.telephone || null,
          adresse: r.adresse,
          type: r.type_rdv,
          statut: r.status
        };
      });

      return {
        actionTaken: "query_rdv_result",
        entityType: "planning",
        entityId: JSON.stringify({ period, count: responseData.length, rdvs: responseData }),
      };
    }

    case "query_rdv_detail": {
      const clientName = entities.client_name as string;
      
      if (!clientName) {
        return {
          actionTaken: "error",
          customResponse: "Quel client ? Dis-moi 'topo Dupont' ou 'infos rdv Martin'.",
        };
      }

      // Find client with fuzzy search
      const searchResult = await findClientByName(supabase, userId, clientName);
      
      if (searchResult.notFound) {
        return { 
          actionTaken: "not_found",
          customResponse: `❌ Aucun client "${clientName}" trouvé. Vérifie l'orthographe.`
        };
      }
      
      if (!searchResult.exactMatch && searchResult.suggestions.length > 0) {
        const suggestionList = searchResult.suggestions
          .map(s => `• ${s.fullName}`)
          .join("\n");
        return {
          actionTaken: "client_ambiguous",
          customResponse: `🔍 Pas de correspondance exacte pour "${clientName}". Tu voulais:\n${suggestionList}`
        };
      }

      const matchedClient = searchResult.exactMatch || searchResult.clients[0];

      // Search for RDV matching client
      const { data: rdvs, error: rdvError } = await supabase
        .from("rdv")
        .select(`
          id,
          date_heure,
          adresse,
          status,
          type_projet,
          type_rdv,
          commentaire,
          metadata,
          source,
          is_r2,
          clients!inner(
            id,
            nom,
            prenom,
            telephone,
            telephone_secondaire,
            email,
            adresse,
            code_postal,
            ville,
            notes,
            metadata,
            source
          ),
          regies(nom, couleur)
        `)
        .eq("user_id", userId)
        .eq("client_id", matchedClient.id)
        .order("date_heure", { ascending: false })
        .limit(1);

      if (rdvError || !rdvs || rdvs.length === 0) {
        return {
          actionTaken: "not_found",
          customResponse: `Aucun RDV trouvé pour "${matchedClient.fullName}".`,
        };
      }

      const rdv = rdvs[0];
      // deno-lint-ignore no-explicit-any
      const client = rdv.clients as any;
      // deno-lint-ignore no-explicit-any
      const regie = rdv.regies as any;
      const clientMeta = client?.metadata || {};
      const rdvMeta = rdv.metadata || {};

      // Format date
      const joursFr = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
      const rdvDate = new Date(rdv.date_heure);
      const jour = joursFr[rdvDate.getDay()];
      const dateFormatted = rdvDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      const heure = rdvDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

      // Build detailed response
      const sections: string[] = [];
      
      // Header
      const clientNom = `${client?.prenom || ""} ${client?.nom || ""}`.trim();
      sections.push(`📋 *TOPO RDV - ${clientNom}*`);
      sections.push(`📅 ${jour} ${dateFormatted} à ${heure}`);
      
      // Status and type
      const statusLabels: Record<string, string> = {
        nouveau: "🆕 Nouveau",
        positif: "✅ Positif",
        negatif: "❌ Négatif",
        absent: "🚫 Absent",
        reporte: "📆 Reporté",
        r2: "🔄 R2",
        annule: "🗑️ Annulé"
      };
      sections.push(`Statut: ${statusLabels[rdv.status] || rdv.status}`);
      if (rdv.is_r2) sections.push("🔄 C'est un R2");
      if (regie?.nom) sections.push(`Régie: ${regie.nom}`);

      // Contact
      sections.push("");
      sections.push("📞 *CONTACT*");
      if (client?.telephone) sections.push(`Tél: ${client.telephone}`);
      if (client?.telephone_secondaire) sections.push(`Tél2: ${client.telephone_secondaire}`);
      if (client?.email) sections.push(`Email: ${client.email}`);
      
      // Address
      const fullAddress = [client?.adresse, client?.code_postal, client?.ville].filter(Boolean).join(", ");
      if (fullAddress) sections.push(`📍 ${fullAddress}`);

      // Consumption & Profile from metadata (Gmail import)
      const conso = clientMeta.consommation_annuelle || clientMeta.consommation || rdvMeta.consommation_annuelle;
      const facture = clientMeta.facture_annuelle || clientMeta.montant_facture || rdvMeta.facture_annuelle;
      const chauffage = clientMeta.type_chauffage || rdvMeta.type_chauffage;
      const surface = clientMeta.surface || rdvMeta.surface;
      const nbPersonnes = clientMeta.nb_personnes || clientMeta.occupants || rdvMeta.nb_personnes;
      const typeLogement = clientMeta.type_logement || rdvMeta.type_logement;
      const proprietaire = clientMeta.proprietaire !== undefined ? (clientMeta.proprietaire ? "Oui" : "Non") : null;

      if (conso || facture || chauffage || surface || nbPersonnes) {
        sections.push("");
        sections.push("⚡ *PROFIL ÉNERGÉTIQUE*");
        if (conso) sections.push(`Conso: ${conso} kWh/an`);
        if (facture) sections.push(`Facture: ${facture}€/an`);
        if (chauffage) sections.push(`Chauffage: ${chauffage}`);
        if (typeLogement) sections.push(`Logement: ${typeLogement}`);
        if (surface) sections.push(`Surface: ${surface}m²`);
        if (nbPersonnes) sections.push(`Occupants: ${nbPersonnes}`);
        if (proprietaire) sections.push(`Propriétaire: ${proprietaire}`);
      }

      // Comments from RDV and client notes
      const allComments: string[] = [];
      if (rdv.commentaire) allComments.push(rdv.commentaire);
      if (client?.notes) allComments.push(client.notes);
      if (clientMeta.commentaires) allComments.push(clientMeta.commentaires);
      if (clientMeta.notes_importees) allComments.push(clientMeta.notes_importees);
      if (rdvMeta.commentaires) allComments.push(rdvMeta.commentaires);

      if (allComments.length > 0) {
        sections.push("");
        sections.push("💬 *COMMENTAIRES*");
        sections.push(allComments.join("\n"));
      }

      // Source info
      if (rdv.source || client?.source) {
        sections.push("");
        sections.push(`📧 Source: ${rdv.source || client?.source}`);
      }

      return {
        actionTaken: "query_rdv_detail_result",
        entityType: "rdv_detail",
        entityId: rdv.id,
        customResponse: sections.join("\n"),
      };
    }

    case "query_ventes": {
      const clientName = entities.client_name as string;
      
      let query = supabase
        .from("ventes")
        .select(`
          id,
          montant_ttc,
          montant_ht,
          puissance_kwc,
          status,
          date_signature,
          date_pose,
          clients(nom, prenom)
        `)
        .eq("user_id", userId)
        .not("status", "eq", "annule") // Exclure les ventes annulées
        .order("created_at", { ascending: false })
        .limit(50);

      if (clientName) {
        query = query.or(`clients.nom.ilike.%${clientName}%,clients.prenom.ilike.%${clientName}%`);
      }

      const { data: ventes, error } = await query;

      if (error) {
        console.error("Error fetching ventes:", error);
        return { actionTaken: "error" };
      }

      // deno-lint-ignore no-explicit-any
      const responseData = (ventes || []).map((v: any) => {
        const client = v.clients as { nom: string; prenom: string } | null;
        return {
          client: client ? `${client.prenom || ""} ${client.nom}`.trim() : "?",
          montant: v.montant_ttc,
          puissance: v.puissance_kwc,
          statut: v.status,
          date_signature: v.date_signature,
          installe: !!v.date_pose
        };
      });

      return {
        actionTaken: "query_ventes_result",
        entityType: "ventes",
        entityId: JSON.stringify({ count: responseData.length, ventes: responseData }),
      };
    }

    case "user_feedback": {
      const feedbackType = (entities.feedback_type as string) || "preference";
      const feedbackKey = (entities.feedback_key as string) || "general";
      const feedbackValue = (entities.feedback_value as string) || "";
      
      if (!feedbackValue) {
        return {
          actionTaken: "error",
          customResponse: "Je n'ai pas compris ce que tu veux que je retienne. Reformule avec 'rappelle-toi que...' ou 'quand je dis X, c'est Y'.",
        };
      }
      
      // Save to memory
      const memoryKey = `${feedbackType}_${feedbackKey.toLowerCase().replace(/\s+/g, "_").slice(0, 50)}`;
      
      await saveMemory(supabase, userId, feedbackType, memoryKey, {
        type: feedbackType,
        key: feedbackKey,
        value: feedbackValue,
        learned_at: new Date().toISOString(),
      }, 1.0); // High confidence for explicit feedback
      
      // Also save as a rule if it's about formatting/output preferences
      if (feedbackType === "preference" || feedbackType === "rule") {
        await saveMemory(supabase, userId, "rule", `rule_${memoryKey}`, {
          rule: feedbackValue,
          context: feedbackKey,
          source: "explicit_feedback",
        }, 1.0);
      }
      
      console.log(`User feedback saved: ${feedbackType}/${feedbackKey} = ${feedbackValue}`);
      
      return {
        actionTaken: "feedback_saved",
        entityType: "memory",
        customResponse: `✅ C'est noté ! Je me souviendrai que: "${feedbackValue}"`,
      };
    }

    default:
      return {};
  }
}
