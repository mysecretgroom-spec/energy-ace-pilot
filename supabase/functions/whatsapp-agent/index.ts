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
  | "update_vente_data"    // Modifier les données d'une vente (prix, puissance, technicien, dates)
  | "create_external_vente" // Créer une vente externe (installation tierce) - peut créer nouveau client
  | "import_document" 
  | "import_facture" 
  | "query_commissions"
  | "query_ventes_a_facturer"  // Liste détaillée des ventes à facturer avec commissions
  | "query_ventes_en_cours"    // Liste détaillée des ventes en cours avec commissions
  | "query_ventes_by_filter"   // Requêtes filtrées (posées, payées, signées, etc.)
  | "query_stats"
  | "query_client_info"
  | "query_rdv_planning"
  | "query_rdv_detail"     // Topo détaillé sur un RDV spécifique (infos Gmail, conso, profil)
  | "query_ventes"
  | "query_vente_detail"   // Fiche détaillée d'une vente spécifique par nom de client
  | "query_frais"          // Liste des frais/dépenses avec filtres (période, catégorie)
  | "query_frais_detail"   // Total des frais avec répartition par catégorie
  | "query_hejja"          // Demande liée au mode HEJJA → rediriger vers l'app
  | "user_feedback"        // Correction ou préférence utilisateur à mémoriser
  | "confirm_action"       // Confirmer une action en attente (oui/ok/confirme)
  | "cancel_action"        // Annuler une action en attente (non/annule)
  | "approve_whatsapp"     // Approuver l'envoi d'un message WhatsApp
  | "decline_whatsapp"     // Refuser l'envoi d'un message WhatsApp
  | "select_choice"        // Réponse à un sondage de choix (numéro ou texte)
  | "select_regie"         // Réponse à un sondage de sélection de régie
  | "conversation"
  | "unknown";

// Workflow states for multi-step actions
type WorkflowState = 
  | "awaiting_confirmation"      // En attente de confirmation utilisateur
  | "collecting_signe_data"      // Collecte des données pour signature (puissance, prix, etc.)
  | "collecting_external_vente_data" // Collecte des données pour vente externe (nouveau client optionnel)
  | "awaiting_whatsapp_approval" // En attente d'approbation du message WhatsApp
  | "awaiting_choice_selection"  // En attente d'une sélection parmi des choix proposés
  | "awaiting_regie_selection"   // En attente de sélection de régie pour attribution
  | "awaiting_new_sale_type"     // En attente de choix du type de vente (interne/externe) pour nouveau client
  | null;

// Choice option for disambiguation polls
interface ChoiceOption {
  id: string;
  label: string;
  entityType: "client" | "rdv" | "vente";
  data: Record<string, unknown>;
}

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
    regieName?: string;  // Nom de la régie pour affichage
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
    date?: string;       // Date du RDV pour création
    time?: string;       // Heure du RDV pour création
    // Pour les sondages de choix
    choices?: ChoiceOption[];       // Les options proposées
    originalIntent?: Intent;        // L'intention originale à exécuter après sélection
    searchQuery?: string;           // La recherche originale pour contexte
    // Pour les ventes externes avec nouveau client
    isNewClient?: boolean;          // Indique qu'on crée un nouveau client
    commission?: number;            // Commission HT pour vente externe
    datePose?: string;              // Date de pose pour vente externe
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

// ==================== MESSAGE LOGGING ====================

// Log messages for web chat sources (WhatsApp webhook handles its own logging)
// deno-lint-ignore no-explicit-any
async function logMessage(
  supabase: any,
  userId: string,
  fromNumber: string,
  messageType: string,
  rawContent: string,
  mediaUrl: string | null,
  transcribedContent: string | null,
  intent: string,
  entities: Record<string, unknown>,
  actionTaken: string | null,
  entityId: string | null,
  entityType: string | null,
  responseSent: string | null,
  status: "processed" | "failed" | "rejected"
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .insert({
        user_id: userId,
        from_number: fromNumber,
        message_type: messageType,
        raw_content: rawContent,
        media_url: mediaUrl,
        transcribed_content: transcribedContent,
        detected_intent: intent,
        detected_entities: entities,
        action_taken: actionTaken,
        entity_id: entityId,
        entity_type: entityType,
        response_sent: responseSent,
        status: status,
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to log message:", error);
      return null;
    }
    console.log(`Message logged for ${fromNumber}: ${intent} -> ${status}`);
    return data?.id;
  } catch (err) {
    console.error("Error logging message:", err);
    return null;
  }
}

// ==================== COMMISSION CALCULATION ====================
// Aligned with useVenteCommissions.ts logic

interface BouquetData {
  puissance_kwc: number;
  prix_recommande: number;
  commission_fixe: number | null;
  regie_id?: string;
}

interface CommissionParams {
  venteId: string;
  montantTTC: number;
  montantHT: number;
  puissanceKwc: number;
  isExternal: boolean;
  decomMontant: number;
  regieId?: string | null;
  etudeSurcouts?: { surcout_support: number; surcout_compteur: number; autre_surcout: number } | null;
  bouquets: BouquetData[];
  globalBouquets: BouquetData[];
  regieBouquetsMap: Map<string, BouquetData[]>;
  partSurventePct?: number;
}

/**
 * Find or interpolate bouquet based on target power
 * Mirrors src/lib/bouquetInterpolation.ts
 */
function findOrInterpolateBouquet(
  bouquets: BouquetData[],
  targetPuissance: number
): { prixRecommande: number; commissionFixe: number; isInterpolated: boolean } {
  // First try exact match
  const exactMatch = bouquets.find(b => b.puissance_kwc === targetPuissance);
  if (exactMatch) {
    return {
      prixRecommande: exactMatch.prix_recommande,
      commissionFixe: exactMatch.commission_fixe || 0,
      isInterpolated: false,
    };
  }

  const sortedBouquets = [...bouquets].sort((a, b) => a.puissance_kwc - b.puissance_kwc);

  // Special case for 3.5 kWc: use 4kWc and subtract 500€
  if (targetPuissance === 3.5) {
    const bouquet4kwc = sortedBouquets.find(b => b.puissance_kwc === 4);
    if (bouquet4kwc) {
      return {
        prixRecommande: bouquet4kwc.prix_recommande - 500,
        commissionFixe: bouquet4kwc.commission_fixe || 0,
        isInterpolated: true,
      };
    }
  }

  // Find the nearest lower bouquet and add 1000€ per kWc difference
  const lowerBouquet = sortedBouquets.filter(b => b.puissance_kwc < targetPuissance).pop();
  const upperBouquet = sortedBouquets.find(b => b.puissance_kwc > targetPuissance);

  if (lowerBouquet) {
    const diffKwc = targetPuissance - lowerBouquet.puissance_kwc;
    const adjustment = diffKwc * 1000;
    return {
      prixRecommande: lowerBouquet.prix_recommande + adjustment,
      commissionFixe: lowerBouquet.commission_fixe || 0,
      isInterpolated: true,
    };
  } else if (upperBouquet) {
    const diffKwc = upperBouquet.puissance_kwc - targetPuissance;
    const adjustment = diffKwc * 1000;
    return {
      prixRecommande: upperBouquet.prix_recommande - adjustment,
      commissionFixe: upperBouquet.commission_fixe || 0,
      isInterpolated: true,
    };
  }

  // No bouquets at all - return defaults (fallback)
  return {
    prixRecommande: targetPuissance * 4500,
    commissionFixe: 0,
    isInterpolated: true,
  };
}

/**
 * Get TVA rate by power (10% for <=3kWc, 20% otherwise)
 */
function getTauxTVAByPuissance(puissanceKwc: number): number {
  return puissanceKwc <= 3 ? 10 : 20;
}

/**
 * Convert TTC to HT
 */
function ttcToHT(montantTTC: number, tauxTVA: number): number {
  if (montantTTC <= 0) return 0;
  return montantTTC / (1 + tauxTVA / 100);
}

/**
 * Calculate commission for a sale - aligned with useVenteCommissions.ts
 */
function calculateCommission(params: {
  montantTTC: number;
  montantHT: number;
  puissanceKwc: number;
  isExternal: boolean;
  decomMontant: number;
  regieId?: string | null;
  etudeSurcouts?: { surcout_support: number; surcout_compteur: number; autre_surcout: number } | null;
  globalBouquets: BouquetData[];
  regieBouquetsMap: Map<string, BouquetData[]>;
  partSurventePct?: number;
}): { commission: number; commissionBase: number; bonusSurvente: number; isInterpolated: boolean } {
  const {
    montantTTC,
    montantHT,
    puissanceKwc,
    isExternal,
    decomMontant,
    regieId,
    etudeSurcouts,
    globalBouquets,
    regieBouquetsMap,
    partSurventePct = 50,
  } = params;

  // External installation: commission = montant HT - décom
  if (isExternal) {
    const commission = Math.max(0, montantHT - decomMontant);
    return { commission, commissionBase: montantHT, bonusSurvente: 0, isInterpolated: false };
  }

  if (!puissanceKwc || puissanceKwc <= 0) {
    return { commission: 0, commissionBase: 0, bonusSurvente: 0, isInterpolated: false };
  }

  // Get the appropriate bouquets for this régie
  const bouquets = (regieId && regieBouquetsMap.has(regieId))
    ? regieBouquetsMap.get(regieId)!
    : globalBouquets;

  const interpolated = findOrInterpolateBouquet(bouquets, puissanceKwc);
  const commissionBase = interpolated.commissionFixe;
  const prixRecommandeTTC = interpolated.prixRecommande;

  // Calculate survente bonus
  const totalSurcoutsTTC = etudeSurcouts
    ? (etudeSurcouts.surcout_support || 0) + (etudeSurcouts.surcout_compteur || 0) + (etudeSurcouts.autre_surcout || 0)
    : 0;

  const tauxTVA = getTauxTVAByPuissance(puissanceKwc);
  const montantTTCSansSurcouts = montantTTC - totalSurcoutsTTC;

  let bonusSurvente = 0;
  if (prixRecommandeTTC > 0 && montantTTCSansSurcouts > prixRecommandeTTC) {
    const surventeTTC = montantTTCSansSurcouts - prixRecommandeTTC;
    const surventeHT = ttcToHT(surventeTTC, tauxTVA);
    bonusSurvente = surventeHT * (partSurventePct / 100);
  }

  const commission = Math.max(0, commissionBase + bonusSurvente - decomMontant);

  return { commission, commissionBase, bonusSurvente, isInterpolated: interpolated.isInterpolated };
}

/**
 * Load all bouquets and build lookup maps
 */
// deno-lint-ignore no-explicit-any
async function loadBouquetsForCommissions(supabase: any): Promise<{
  globalBouquets: BouquetData[];
  regieBouquetsMap: Map<string, BouquetData[]>;
}> {
  const { data: allBouquets, error } = await supabase
    .from("bouquets")
    .select("puissance_kwc, prix_recommande, commission_fixe, regie_ids")
    .eq("actif", true);

  if (error || !allBouquets) {
    console.error("Error loading bouquets:", error);
    return { globalBouquets: [], regieBouquetsMap: new Map() };
  }

  // Global bouquets (regie_ids is null or empty)
  // deno-lint-ignore no-explicit-any
  const globalBouquets: BouquetData[] = allBouquets
    .filter((b: any) => !b.regie_ids || b.regie_ids.length === 0)
    .map((b: any) => ({
      puissance_kwc: Number(b.puissance_kwc),
      prix_recommande: Number(b.prix_recommande),
      commission_fixe: b.commission_fixe ? Number(b.commission_fixe) : null,
    }));

  // Régie-specific bouquets
  const regieBouquetsMap = new Map<string, BouquetData[]>();
  // deno-lint-ignore no-explicit-any
  allBouquets.forEach((b: any) => {
    if (b.regie_ids && b.regie_ids.length > 0) {
      b.regie_ids.forEach((regieId: string) => {
        const existing = regieBouquetsMap.get(regieId) || [];
        existing.push({
          puissance_kwc: Number(b.puissance_kwc),
          prix_recommande: Number(b.prix_recommande),
          commission_fixe: b.commission_fixe ? Number(b.commission_fixe) : null,
          regie_id: regieId,
        });
        regieBouquetsMap.set(regieId, existing);
      });
    }
  });

  return { globalBouquets, regieBouquetsMap };
}

// ==================== FUZZY CLIENT SEARCH ====================

/**
 * Get commission for a sale using the shared RPC function
 * Falls back to local calculation if RPC fails
 */
// deno-lint-ignore no-explicit-any
async function getCommissionViaRPC(supabase: any, venteId: string, fallbackParams?: {
  montantTTC: number;
  montantHT: number;
  puissanceKwc: number;
  isExternal: boolean;
  decomMontant: number;
  regieId?: string | null;
  globalBouquets: BouquetData[];
  regieBouquetsMap: Map<string, BouquetData[]>;
  partSurventePct?: number;
}): Promise<{
  commission: number;
  commissionBase: number;
  bonusSurvente: number;
  decomMontant: number;
  isInterpolated: boolean;
  mode: string;
}> {
  // Try RPC first
  const { data, error } = await supabase.rpc("calculate_vente_commission", { p_vente_id: venteId });
  
  if (!error && data && !data.error) {
    return {
      commission: data.commission_nette || 0,
      commissionBase: data.commission_base || 0,
      bonusSurvente: data.bonus_survente || 0,
      decomMontant: data.decom_montant || 0,
      isInterpolated: data.is_interpolated || false,
      mode: data.mode || "bouquet",
    };
  }
  
  // Fallback to local calculation
  if (fallbackParams) {
    const result = calculateCommission(fallbackParams);
    return {
      commission: result.commission,
      commissionBase: result.commissionBase,
      bonusSurvente: result.bonusSurvente,
      decomMontant: fallbackParams.decomMontant,
      isInterpolated: result.isInterpolated,
      mode: "bouquet",
    };
  }
  
  return { commission: 0, commissionBase: 0, bonusSurvente: 0, decomMontant: 0, isInterpolated: false, mode: "unknown" };
}

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

// ==================== DISAMBIGUATION POLLING ====================

// Generate a choice poll for ambiguous search results
function generateChoicePoll(
  suggestions: ClientMatch[],
  searchQuery: string,
  originalIntent: Intent,
  entities: Record<string, unknown>
): { pendingAction: PendingAction; responseMessage: string } {
  const choices: ChoiceOption[] = suggestions.slice(0, 5).map((s, _index) => ({
    id: s.id,
    label: s.fullName,
    entityType: "client" as const,
    data: {
      nom: s.nom,
      prenom: s.prenom,
      client_id: s.id,
      score: s.score,
    },
  }));
  
  // Build the poll message
  const choiceList = choices.map((c, i) => `${i + 1}️⃣ ${c.label}`).join("\n");
  const responseMessage = `🔍 Plusieurs résultats pour "*${searchQuery}*":\n\n${choiceList}\n\n👆 *Réponds avec le numéro* de ton choix (ou "annule")`;
  
  const pendingAction: PendingAction = {
    intent: "select_choice",
    entities,
    workflowState: "awaiting_choice_selection",
    collectedData: {
      choices,
      originalIntent,
      searchQuery,
    },
    createdAt: new Date().toISOString(),
  };
  
  return { pendingAction, responseMessage };
}

// Generate a choice poll for ambiguous search results WITH a "new client" option
function generateChoicePollWithNewClient(
  suggestions: ClientMatch[],
  searchQuery: string,
  originalIntent: Intent,
  entities: Record<string, unknown>
): { pendingAction: PendingAction; responseMessage: string } {
  const choices: ChoiceOption[] = suggestions.slice(0, 4).map((s, _index) => ({
    id: s.id,
    label: s.fullName,
    entityType: "client" as const,
    data: {
      nom: s.nom,
      prenom: s.prenom,
      client_id: s.id,
      score: s.score,
    },
  }));
  
  // Add a "New Client" option at the end
  choices.push({
    id: "NEW_CLIENT",
    label: `➕ Nouveau client "${searchQuery}"`,
    entityType: "client" as const,
    data: {
      is_new_client: true,
      client_name: searchQuery,
    },
  });
  
  // Build the poll message
  const choiceList = choices.map((c, i) => `${i + 1}️⃣ ${c.label}`).join("\n");
  const responseMessage = `🔍 Résultats pour "*${searchQuery}*":\n\n${choiceList}\n\n👆 *Réponds avec le numéro* de ton choix (ou "annule")`;
  
  const pendingAction: PendingAction = {
    intent: "select_choice",
    entities,
    workflowState: "awaiting_choice_selection",
    collectedData: {
      choices,
      originalIntent,
      searchQuery,
    },
    createdAt: new Date().toISOString(),
  };
  
  return { pendingAction, responseMessage };
}

// Generate a choice poll for RDV disambiguation
function generateRdvChoicePoll(
  rdvs: Array<{ id: string; date_heure: string; clients: { nom: string; prenom: string | null } }>,
  searchQuery: string,
  originalIntent: Intent,
  entities: Record<string, unknown>
): { pendingAction: PendingAction; responseMessage: string } {
  const choices: ChoiceOption[] = rdvs.slice(0, 5).map((r, _index) => {
    const d = new Date(r.date_heure);
    const dateStr = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    const timeStr = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const clientName = `${r.clients.prenom || ""} ${r.clients.nom}`.trim();
    return {
      id: r.id,
      label: `${dateStr} ${timeStr} - ${clientName}`,
      entityType: "rdv" as const,
      data: {
        rdv_id: r.id,
        client_name: clientName,
        date_heure: r.date_heure,
      },
    };
  });
  
  const choiceList = choices.map((c, i) => `${i + 1}️⃣ ${c.label}`).join("\n");
  const responseMessage = `🔍 Plusieurs RDV correspondent:\n\n${choiceList}\n\n👆 *Réponds avec le numéro* de ton choix (ou "annule")`;
  
  const pendingAction: PendingAction = {
    intent: "select_choice",
    entities,
    workflowState: "awaiting_choice_selection",
    collectedData: {
      choices,
      originalIntent,
      searchQuery,
    },
    createdAt: new Date().toISOString(),
  };
  
  return { pendingAction, responseMessage };
}

// Generate a choice poll for vente disambiguation
function generateVenteChoicePoll(
  ventes: Array<{ id: string; status: string; montant_ttc: number | null; date_signature: string | null; clients: { nom: string; prenom: string | null } }>,
  searchQuery: string,
  originalIntent: Intent,
  entities: Record<string, unknown>
): { pendingAction: PendingAction; responseMessage: string } {
  const statusLabels: Record<string, string> = {
    cq_a_faire: "CQ à faire",
    cq_fait: "CQ fait",
    attente_financement: "Attente fin.",
    envoi_pose: "Envoi pose",
    en_installation: "Installation",
    installe: "Posé",
    attente_paiement: "Att. paiement",
    paye: "Payé",
    annule: "Annulé",
  };
  
  const choices: ChoiceOption[] = ventes.slice(0, 5).map((v, _index) => {
    const clientName = `${v.clients.prenom || ""} ${v.clients.nom}`.trim();
    const status = statusLabels[v.status] || v.status;
    const amount = v.montant_ttc ? `${v.montant_ttc.toLocaleString("fr-FR")}€` : "?€";
    const date = v.date_signature ? new Date(v.date_signature).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "";
    return {
      id: v.id,
      label: `${clientName} - ${status} - ${amount}${date ? ` (${date})` : ""}`,
      entityType: "vente" as const,
      data: {
        vente_id: v.id,
        client_name: clientName,
        status: v.status,
        montant_ttc: v.montant_ttc,
      },
    };
  });
  
  const choiceList = choices.map((c, i) => `${i + 1}️⃣ ${c.label}`).join("\n");
  const responseMessage = `🔍 Plusieurs ventes correspondent:\n\n${choiceList}\n\n👆 *Réponds avec le numéro* de ton choix (ou "annule")`;
  
  const pendingAction: PendingAction = {
    intent: "select_choice",
    entities,
    workflowState: "awaiting_choice_selection",
    collectedData: {
      choices,
      originalIntent,
      searchQuery,
    },
    createdAt: new Date().toISOString(),
  };
  
  return { pendingAction, responseMessage };
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

  // Declare outside try for access in catch block (for error logging)
  // deno-lint-ignore no-explicit-any
  let supabaseClient: any = null;
  let requestData: AgentRequest | null = null;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const supabase = supabaseClient;

    requestData = await req.json();
    const request: AgentRequest = requestData!;
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
        
        // Check if this is a confirmed action that needs execution
        if (handled.actionTaken === "confirmed_execute" && pendingAction) {
          console.log(`Executing confirmed action: ${pendingAction.intent}`);
          // Execute the original pending action
          actionResult = await executeAction(
            supabase,
            request.userId,
            request.userName,
            request.messageId,
            pendingAction.intent,
            pendingAction.entities,
            pendingAction.collectedData?.commentaire || null, // stored document URL
            null, // mediaData not needed for confirmed action
            null, // analysisResult not needed
            TWILIO_ACCOUNT_SID!,
            TWILIO_AUTH_TOKEN!
          );
          
          // Override the response if action was successful
          if (actionResult.customResponse) {
            handled.responseMessage = actionResult.customResponse;
          } else if (actionResult.actionTaken && !actionResult.actionTaken.includes("error")) {
            handled.responseMessage = "✅ Action exécutée avec succès !";
          }
          
          // Clear the pending action
          actionResult.newPendingAction = null;
        } else {
          actionResult = handled;
        }
        
        aiResponse = {
          intent: handled.intent || "conversation",
          confidence: 100,
          entities: pendingAction?.entities || {},
          requiresConfirmation: false,
          responseMessage: handled.responseMessage,
        };
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
      // Actions that require MANDATORY confirmation before execution - ALWAYS enforce this
      const actionIntents: Intent[] = [
        "create_rdv", "update_rdv", "update_vente_status", "update_vente_pipeline", 
        "mark_signe", "update_vente_data"
      ];
      
      // FORCE confirmation for all action intents, regardless of AI response
      // This ensures no data modification happens without explicit user confirmation
      const needsConfirmation = actionIntents.includes(aiResponse!.intent);
      
      // SPECIAL CASE: For update_rdv, let executeAction handle confirmation 
      // so it can show the actual list of RDVs that will be affected
      // This avoids double confirmation and provides better UX
      const delegateConfirmationToAction = aiResponse!.intent === "update_rdv";
      
      if (needsConfirmation && !delegateConfirmationToAction) {
        // Store as pending action - don't execute yet
        console.log(`Action ${aiResponse!.intent} requires confirmation, storing pending action`);
        
        const collectedData: PendingAction["collectedData"] = {};
        if (uploadedDocumentUrl) {
          collectedData.commentaire = uploadedDocumentUrl; // Store doc URL in commentaire field
        }
        
        // Generate a proper confirmation message if AI didn't provide one
        let confirmationMessage = aiResponse!.responseMessage;
        
        // If the AI response doesn't look like a proper confirmation request, generate one
        if (!confirmationMessage.toLowerCase().includes("confirme") && 
            !confirmationMessage.toLowerCase().includes("oui/non") &&
            !confirmationMessage.toLowerCase().includes("correct ?")) {
          const entities = aiResponse!.entities;
          const clientName = entities.client_name as string || "?";
          const intentLabels: Record<string, string> = {
            create_rdv: "Créer un RDV",
            update_rdv: "Modifier le RDV",
            update_vente_status: "Mettre à jour le statut",
            update_vente_pipeline: "Mettre à jour la vente",
            mark_signe: "Marquer comme signé",
            update_vente_data: "Modifier les données de vente",
          };
          
          const actionLabel = intentLabels[aiResponse!.intent] || aiResponse!.intent;
          
          // Build entity summary
          const entityParts: string[] = [];
          if (entities.client_name) entityParts.push(`Client: ${entities.client_name}`);
          if (entities.pipeline_status) entityParts.push(`Statut: ${entities.pipeline_status}`);
          if (entities.date) entityParts.push(`Date: ${entities.date}`);
          if (entities.time) entityParts.push(`Heure: ${entities.time}`);
          if (entities.montant_ttc) entityParts.push(`Montant: ${entities.montant_ttc}€`);
          if (entities.puissance_kwc) entityParts.push(`Puissance: ${entities.puissance_kwc}kWc`);
          
          const entitySummary = entityParts.length > 0 ? `\n${entityParts.join(" | ")}` : "";
          
          confirmationMessage = `🔔 *${actionLabel}*${entitySummary}\n\nConfirmes-tu ? (Oui/Non)`;
        }
        
        actionResult = {
          newPendingAction: {
            intent: aiResponse!.intent,
            entities: aiResponse!.entities,
            workflowState: "awaiting_confirmation",
            collectedData,
            createdAt: new Date().toISOString(),
          },
          customResponse: confirmationMessage,
        };
      } else if (delegateConfirmationToAction || !needsConfirmation) {
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
        
        // Handle feedback regeneration: after saving correction, regenerate response with correction applied
        if (actionResult.actionTaken === "feedback_saved_regenerate") {
          const correctionValue = actionResult.entityId || "";
          console.log("Feedback saved, regenerating response with correction applied...");
          
          // Reload memories (now including the new correction)
          const updatedMemories = await loadUserMemories(supabase, request.userId);
          
          // Get the last assistant response to ensure we don't repeat it
          const lastAssistantResponse = conversationContext
            .filter(m => m.role === "assistant")
            .slice(-1)[0]?.content || "";
          
          // Ask AI to provide a corrected response based on the feedback
          const regenerateResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { 
                  role: "system", 
                  content: `Tu es un assistant IA pour un commercial en énergies renouvelables. L'utilisateur vient de te corriger.

🔴 CORRECTION/INSTRUCTION REÇUE: "${correctionValue}"

📚 MÉMOIRES DE L'UTILISATEUR:
${formatMemoriesForPrompt(updatedMemories)}

⚠️ RÉPONSE PRÉCÉDENTE (À NE PAS RÉPÉTER):
"${lastAssistantResponse.substring(0, 500)}"

📋 RÈGLES STRICTES:
1. CONFIRME la correction en UNE LIGNE maximum (ex: "✅ C'est noté ! Je [reformulation courte]")
2. Puis, APRÈS un saut de ligne, fournis une NOUVELLE réponse qui APPLIQUE IMMÉDIATEMENT la correction
3. Ta nouvelle réponse doit être DIFFÉRENTE de la précédente - elle doit montrer le CHANGEMENT
4. Si la correction concerne le format/style → reformate ta dernière réponse selon les nouvelles instructions
5. Si la correction concerne le contenu → corrige/complète les informations
6. Si la correction est une règle générale → montre un exemple d'application

❌ INTERDIT:
- Répéter la même réponse que précédemment
- Dire "je vais appliquer à mes prochaines réponses" (tu dois l'appliquer MAINTENANT)
- Ignorer la demande de l'utilisateur

FORMAT ATTENDU:
✅ C'est noté ! [confirmation courte]

[NOUVELLE réponse différente, avec la correction appliquée]` 
                },
                ...conversationContext.slice(-6).map(m => ({
                  role: m.role as "user" | "assistant",
                  content: m.content
                })),
                { role: "user", content: processedContent }
              ],
              max_tokens: 2000,
            }),
          });
          
          if (regenerateResponse.ok) {
            const regenResult = await regenerateResponse.json();
            const regeneratedContent = regenResult.choices?.[0]?.message?.content;
            
            if (regeneratedContent) {
              // Verify the response is different from the previous one
              const normalizedNew = regeneratedContent.toLowerCase().replace(/\s+/g, " ").trim();
              const normalizedOld = lastAssistantResponse.toLowerCase().replace(/\s+/g, " ").trim();
              
              // Calculate simple similarity (shared words ratio)
              const newWordsArray = normalizedNew.split(" ").filter((w: string) => w.length > 3);
              const oldWordsArray = normalizedOld.split(" ").filter((w: string) => w.length > 3);
              const newWords = new Set<string>(newWordsArray);
              const oldWords = new Set<string>(oldWordsArray);
              const intersection = newWordsArray.filter((w: string) => oldWords.has(w));
              const similarity = oldWords.size > 0 ? intersection.length / oldWords.size : 0;
              
              console.log(`Response similarity: ${(similarity * 100).toFixed(1)}%`);
              
              if (similarity > 0.85) {
                // Too similar, force a different response by re-requesting
                console.log("Response too similar, requesting more distinct version...");
                const retryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-3-flash-preview",
                    messages: [
                      { 
                        role: "system", 
                        content: `L'utilisateur a demandé: "${correctionValue}"

Ta réponse précédente était trop similaire. Tu DOIS fournir une réponse DIFFÉRENTE qui montre clairement que tu as compris et appliqué la correction.

Commence par: "✅ C'est noté !" puis donne une réponse VISIBLEMENT DIFFÉRENTE.` 
                      },
                      { role: "user", content: `Dernière question/demande: ${processedContent}\n\nRéponds différemment en appliquant: ${correctionValue}` }
                    ],
                    max_tokens: 1500,
                    temperature: 0.8, // Higher temperature for more variety
                  }),
                });
                
                if (retryResponse.ok) {
                  const retryResult = await retryResponse.json();
                  const retryContent = retryResult.choices?.[0]?.message?.content;
                  if (retryContent) {
                    actionResult.customResponse = retryContent;
                    console.log("Regenerated with forced variation");
                  } else {
                    actionResult.customResponse = regeneratedContent;
                  }
                } else {
                  actionResult.customResponse = regeneratedContent;
                }
              } else {
                actionResult.customResponse = regeneratedContent;
                console.log("Regenerated response with correction applied (verified different)");
              }
            } else {
              // Fallback if regeneration fails
              actionResult.customResponse = `✅ C'est noté ! Je me souviendrai que: "${correctionValue}"\n\nVoici la correction appliquée: ${correctionValue}`;
            }
          } else {
            // Fallback if API call fails
            const errorText = await regenerateResponse.text().catch(() => "unknown error");
            console.error("Regeneration API error:", errorText);
            actionResult.customResponse = `✅ C'est noté ! "${correctionValue}"\n\nJe vais appliquer cette instruction.`;
          }
          
          actionResult.actionTaken = "feedback_saved";
        }
      }
    }

    // Format response message based on query results or custom workflow response
    // Priority: customResponse > formatted query > AI response
    let finalResponseMessage = actionResult.customResponse || aiResponse!.responseMessage;
    
    // Only override with formatQueryResponse if:
    // 1. It's a query action with entityId containing JSON data
    // 2. AND there's no customResponse already set
    if (!actionResult.customResponse && actionResult.actionTaken?.startsWith("query_") && actionResult.entityId) {
      // Check if entityId looks like JSON data (starts with { or [)
      if (actionResult.entityId.startsWith("{") || actionResult.entityId.startsWith("[")) {
        finalResponseMessage = formatQueryResponse(
          actionResult.actionTaken,
          actionResult.entityId,
          request.userName
        );
      }
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

    console.log(`Pending action to store: ${newPendingAction ? JSON.stringify({ intent: newPendingAction.intent, workflowState: newPendingAction.workflowState, hasRdvIds: !!newPendingAction.collectedData?.rdvIds }) : "null"}`);

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

    // Log message for web chat sources (WhatsApp via webhook already logs separately)
    if (request.fromNumber === "web_chat" || (request as { source?: string }).source === "onboarding_demo") {
      await logMessage(
        supabase,
        request.userId,
        request.fromNumber,
        request.messageType,
        request.content,
        request.mediaUrl || null,
        request.messageType === "audio" ? processedContent : null,
        aiResponse!.intent,
        aiResponse!.entities,
        actionResult.actionTaken || null,
        actionResult.entityId || null,
        actionResult.entityType || null,
        finalResponseMessage,
        "processed"
      );
    }

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
    
    // Log failed message for web chat sources (using outer-scope variables)
    if (requestData?.fromNumber === "web_chat" && supabaseClient) {
      logMessage(
        supabaseClient,
        requestData.userId,
        requestData.fromNumber,
        requestData.messageType || "text",
        requestData.content || "",
        null,
        null,
        "unknown",
        {},
        null,
        null,
        null,
        null,
        "failed"
      ).catch(err => console.error("Failed to log error message:", err));
    }
    
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
        const { en_cours, a_facturer, payees, total } = data;
        let msg = `💰 *Tes commissions ${userName.split(" ")[0]}*\n\n`;
        msg += `📊 En cours: *${(en_cours?.total || 0).toLocaleString("fr-FR")}€*\n`;
        msg += `✅ À facturer: *${(a_facturer?.total || 0).toLocaleString("fr-FR")}€*\n`;
        if (payees?.total) {
          msg += `💵 Payées: *${payees.total.toLocaleString("fr-FR")}€*\n`;
        }
        msg += `\n💶 Total: *${(total || 0).toLocaleString("fr-FR")}€*`;
        return msg;
      }

      case "query_stats_result": {
        const { period, rdv, ventes, ventesEnCours, caTTC, caHT, taux_conversion, commissions } = data;
        let msg = `📈 *Stats - ${period}*\n\n` +
          `📅 RDV: *${rdv}*\n` +
          `✍️ Ventes signées: *${ventes}*\n` +
          `📂 En cours: *${ventesEnCours || 0}*\n` +
          `💶 CA TTC: *${(caTTC || 0).toLocaleString("fr-FR")}€*\n` +
          `💰 CA HT: *${(caHT || 0).toLocaleString("fr-FR")}€*\n` +
          `📊 Taux conversion: *${taux_conversion}%*`;
        if (commissions) {
          msg += `\n💵 Commissions: *${commissions.toLocaleString("fr-FR")}€*`;
        }
        return msg;
      }

      case "query_client_result": {
        if (!Array.isArray(data) || data.length === 0) {
          return "❌ Aucun client trouvé avec ce nom.";
        }
        let msg = `👤 *Client(s) trouvé(s)* (${data.length})\n`;
        // Display ALL clients - no truncation
        for (const c of data) {
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
        // Display ALL RDVs - no truncation
        const MAX_ITEMS = 40;
        for (let i = 0; i < rdvs.length && i < MAX_ITEMS; i++) {
          const r = rdvs[i];
          msg += `\n⏰ *${r.heure}* - ${r.client}`;
          if (r.telephone) msg += ` 📱${r.telephone}`;
          if (r.adresse) msg += `\n   📍 ${r.adresse}`;
          msg += `\n   ${r.type} • ${r.statut}`;
          
          // Add part indicator for very long lists
          if (rdvs.length > 30 && (i + 1) % 30 === 0 && i < rdvs.length - 1) {
            msg += `\n\n📄 [${Math.floor(i / 30) + 1}/${Math.ceil(Math.min(rdvs.length, MAX_ITEMS) / 30)}] Suite...\n`;
          }
        }
        if (count > MAX_ITEMS) msg += `\n\n_${count - MAX_ITEMS} RDV supplémentaires disponibles dans l'app_`;
        return msg;
      }

      case "query_ventes_result": {
        const { count, ventes: ventesList } = data;
        if (count === 0) {
          return "📊 Aucune vente trouvée.";
        }
        let msg = `🏆 *Ventes* (${count})\n`;
        // Display ALL ventes - no truncation
        const MAX_ITEMS = 40;
        for (let i = 0; i < ventesList.length && i < MAX_ITEMS; i++) {
          const v = ventesList[i];
          const status = v.installe ? "✅" : v.statut === "positif" ? "📝" : "⏳";
          msg += `\n${status} *${v.client}*`;
          if (v.puissance) msg += ` - ${v.puissance}kWc`;
          if (v.montant) msg += ` - ${v.montant.toLocaleString("fr-FR")}€`;
          msg += `\n   ${v.statut}${v.installe ? " (installé)" : ""}`;
          
          // Add part indicator for very long lists
          if (ventesList.length > 30 && (i + 1) % 30 === 0 && i < ventesList.length - 1) {
            msg += `\n\n📄 [${Math.floor(i / 30) + 1}/${Math.ceil(Math.min(ventesList.length, MAX_ITEMS) / 30)}] Suite...\n`;
          }
        }
        if (count > MAX_ITEMS) msg += `\n\n_${count - MAX_ITEMS} ventes supplémentaires disponibles dans l'app_`;
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
      // Generic confirmation for actions (mass actions and single actions)
      const confirmPatterns = ["oui", "ok", "confirme", "valide", "go", "yes", "c'est bon", "d'accord", "envoie", "fais-le", "vas-y"];
      if (confirmPatterns.some(p => messageLower.includes(p))) {
        // Handle update_rdv mass action
        if (pendingAction.intent === "update_rdv" && pendingAction.collectedData?.rdvIds) {
          const rdvIds = pendingAction.collectedData.rdvIds;
          const action = pendingAction.collectedData.action;
          
          // Handle DELETE action (supprime)
          if (action === "supprime") {
            // Get previous data for each RDV before deletion (for audit trail)
            for (const rdvId of rdvIds) {
              const previousData = await getPreviousData(supabase, "rdv", rdvId, userId);
              await logAgentAction(
                supabase,
                userId,
                null,
                "delete_rdv",
                "rdv",
                rdvId,
                { deleted: true },
                previousData,
                `RDV supprimé définitivement (action en masse)`
              );
            }
            
            // Execute the mass delete
            const { error: deleteError } = await supabase
              .from("rdv")
              .delete()
              .in("id", rdvIds);
            
            if (deleteError) {
              console.error("Error mass deleting RDVs:", deleteError);
              return {
                intent: "update_rdv",
                actionTaken: "error",
                newPendingAction: null,
                responseMessage: `❌ Erreur lors de la suppression: ${deleteError.message}`,
              };
            }
            
            return {
              intent: "update_rdv",
              actionTaken: "mass_rdv_deleted",
              newPendingAction: null,
              responseMessage: `🗑️ ${rdvIds.length} RDV supprimé(s) définitivement !`,
            };
          }
          
          // Handle UPDATE actions (annule, reporte, decale)
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
          const { error: updateError } = await supabase
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
              { status: "nouveau" }, // Simplified previous state
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
        
        // Handle create_rdv with regie selection confirmed
        if (pendingAction.intent === "create_rdv" && pendingAction.collectedData?.clientId) {
          const collectedData = pendingAction.collectedData;
          const dateStr = pendingAction.entities.date as string || new Date().toISOString().split("T")[0];
          const timeStr = pendingAction.entities.time as string || "10:00";
          const dateHeure = `${dateStr}T${timeStr}:00`;
          
          const { data: rdv, error: rdvError } = await supabase
            .from("rdv")
            .insert({
              user_id: userId,
              client_id: collectedData.clientId,
              date_heure: dateHeure,
              adresse: pendingAction.entities.address as string || null,
              status: "nouveau",
              type_rdv: "R1",
              type_projet: "pv",
              source: "whatsapp",
              regie_id: collectedData.regieId || null,
            })
            .select("id")
            .single();
          
          if (rdvError) {
            console.error("Error creating RDV:", rdvError);
            return {
              intent: "create_rdv",
              actionTaken: "error",
              newPendingAction: null,
              responseMessage: `❌ Erreur: ${rdvError.message}`,
            };
          }
          
          // Log action
          await logAgentAction(
            supabase,
            userId,
            null,
            "create_rdv",
            "rdv",
            rdv?.id,
            { date_heure: dateHeure, client_id: collectedData.clientId, regie_id: collectedData.regieId },
            null,
            `Création RDV ${collectedData.clientName} le ${dateStr} à ${timeStr}`
          );
          
          return {
            intent: "create_rdv",
            actionTaken: "rdv_created",
            entityId: rdv?.id,
            entityType: "rdv",
            newPendingAction: null,
            responseMessage: `✅ RDV créé !\n\n👤 ${collectedData.clientName}\n📅 ${dateStr} à ${timeStr}${collectedData.regieName ? `\n🏢 ${collectedData.regieName}` : ""}`,
          };
        }
        
        // For other pending actions - execute the stored action
        // Return a signal to the main flow to execute the pending action
        return {
          intent: pendingAction.intent,
          actionTaken: "confirmed_execute",
          newPendingAction: null,
          responseMessage: "✅ Action confirmée, exécution en cours...",
        };
      }
      return {
        intent: "cancel_action",
        actionTaken: "cancelled",
        newPendingAction: null,
        responseMessage: "❌ Action annulée. Comment puis-je t'aider ?",
      };
    }
    
    case "awaiting_choice_selection": {
      // User is responding to a disambiguation poll
      const choices = pendingAction.collectedData?.choices || [];
      const originalIntent = pendingAction.collectedData?.originalIntent;
      
      if (choices.length === 0) {
        return {
          intent: "cancel_action",
          actionTaken: "error",
          newPendingAction: null,
          responseMessage: "❌ Erreur: pas de choix disponibles. Comment puis-je t'aider ?",
        };
      }
      
      // Try to parse user's selection - support multiple formats
      let selectedChoice: ChoiceOption | null = null;
      
      // 0. First, check if user is indicating a new client (e.g., "c'est un nouveau client", "nouveau", "new client")
      const newClientPatterns = [
        "nouveau client", "new client", "c'est un nouveau", "c'est nouveau", 
        "pas dans la liste", "aucun de ces", "autre client", "creer", "créer",
        "nouveau", "nouvelle"
      ];
      const hasNewClientChoice = choices.some(c => c.id === "NEW_CLIENT");
      if (hasNewClientChoice && newClientPatterns.some(p => messageLower.includes(p))) {
        selectedChoice = choices.find(c => c.id === "NEW_CLIENT") || null;
      }
      
      // 1. Check for number selection (1, 2, 3, etc.)
      if (!selectedChoice) {
        const numberMatch = userMessage.match(/^[#]?(\d+)\.?$/);
        if (numberMatch) {
          const choiceIndex = parseInt(numberMatch[1], 10) - 1;
          if (choiceIndex >= 0 && choiceIndex < choices.length) {
            selectedChoice = choices[choiceIndex];
          }
        }
      }
      
      // 2. Check for emoji number selection (1️⃣, 2️⃣, etc.)
      if (!selectedChoice) {
        const emojiNumbers: Record<string, number> = {
          "1️⃣": 0, "2️⃣": 1, "3️⃣": 2, "4️⃣": 3, "5️⃣": 4,
          "①": 0, "②": 1, "③": 2, "④": 3, "⑤": 4,
        };
        for (const [emoji, index] of Object.entries(emojiNumbers)) {
          if (userMessage.includes(emoji) && index < choices.length) {
            selectedChoice = choices[index];
            break;
          }
        }
      }
      
      // 3. Try to match by label (fuzzy text match)
      if (!selectedChoice) {
        const normalizedMessage = messageLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        for (const choice of choices) {
          const normalizedLabel = choice.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          // Check if message contains the label or vice versa
          if (normalizedMessage.includes(normalizedLabel) || normalizedLabel.includes(normalizedMessage)) {
            selectedChoice = choice;
            break;
          }
          // Check individual words
          const labelWords = normalizedLabel.split(/\s+/);
          const matchCount = labelWords.filter(w => normalizedMessage.includes(w)).length;
          if (matchCount >= Math.ceil(labelWords.length / 2)) {
            selectedChoice = choice;
            break;
          }
        }
      }
      
      if (!selectedChoice) {
        // Couldn't parse selection - ask again
        const choiceList = choices.map((c, i) => `${i + 1}️⃣ ${c.label}`).join("\n");
        return {
          intent: "select_choice",
          actionTaken: "invalid_selection",
          newPendingAction: pendingAction, // Keep the same pending action
          responseMessage: `🤔 Je n'ai pas compris ton choix.\n\nRéponds avec le *numéro* correspondant:\n${choiceList}\n\nOu tape "annule" pour abandonner.`,
        };
      }
      
      // Selection made - update entities and execute original intent
      console.log(`User selected choice: ${selectedChoice.label} (${selectedChoice.id})`);
      
      // Check if user selected "New Client" option
      if (selectedChoice.id === "NEW_CLIENT" && selectedChoice.data.is_new_client) {
        // User wants to create a new client - ask for sale type (internal/external)
        const clientName = selectedChoice.data.client_name as string || pendingAction.collectedData?.searchQuery || "";
        const originalEntities = pendingAction.entities;
        
        return {
          intent: originalIntent || pendingAction.intent,
          actionTaken: "new_client_selected",
          newPendingAction: {
            intent: originalIntent || pendingAction.intent,
            entities: { ...originalEntities, is_new_client: true, client_name: clientName },
            workflowState: "awaiting_new_sale_type",
            collectedData: {
              clientName: clientName,
              isNewClient: true,
              puissanceKwc: originalEntities.puissance_kwc as number || undefined,
              prixTTC: originalEntities.amount as number || undefined,
            },
            createdAt: new Date().toISOString(),
          },
          responseMessage: `🆕 Création d'un nouveau client "${clientName}".\n\n*Est-ce une nouvelle vente ?*\n\n1️⃣ Vente *interne* (avec RDV, puissance, prix TTC)\n2️⃣ Vente *externe* (installation tierce, commission uniquement)\n\n👆 *Réponds 1 ou 2* (ou "annule")`,
        };
      }
      
      // Update entities based on the selected choice
      const updatedEntities = { ...pendingAction.entities };
      
      if (selectedChoice.entityType === "client") {
        updatedEntities.client_name = selectedChoice.label;
        updatedEntities.client_id = selectedChoice.id;
      } else if (selectedChoice.entityType === "rdv") {
        updatedEntities.rdv_id = selectedChoice.id;
        if (selectedChoice.data.client_name) {
          updatedEntities.client_name = selectedChoice.data.client_name;
        }
      } else if (selectedChoice.entityType === "vente") {
        updatedEntities.vente_id = selectedChoice.id;
        if (selectedChoice.data.client_name) {
          updatedEntities.client_name = selectedChoice.data.client_name;
        }
      }
      
      // Store additional data from the choice
      Object.assign(updatedEntities, selectedChoice.data);
      
      // For query intents, we can execute directly with the clarified info
      const queryIntents: Intent[] = [
        "query_client_info", "query_rdv_detail", "query_vente_detail", 
        "query_commissions", "query_stats", "query_rdv_planning", "query_ventes"
      ];
      
      if (originalIntent && queryIntents.includes(originalIntent)) {
        // Return with updated entities to execute the query
        return {
          intent: originalIntent,
          actionTaken: "choice_selected_execute",
          entityId: selectedChoice.id,
          entityType: selectedChoice.entityType,
          newPendingAction: null,
          responseMessage: `✅ Compris: *${selectedChoice.label}*`,
          customResponse: undefined, // Will be filled by executeAction
        };
      }
      
      // For action intents, we need confirmation
      return {
        intent: originalIntent || pendingAction.intent,
        actionTaken: "choice_selected_confirm",
        entityId: selectedChoice.id,
        entityType: selectedChoice.entityType,
        newPendingAction: {
          intent: originalIntent || pendingAction.intent,
          entities: updatedEntities,
          workflowState: "awaiting_confirmation",
          collectedData: {
            ...pendingAction.collectedData,
            clientId: selectedChoice.entityType === "client" ? selectedChoice.id : pendingAction.collectedData?.clientId,
            clientName: selectedChoice.label,
          },
          createdAt: new Date().toISOString(),
        },
        responseMessage: `📝 J'ai compris: *${selectedChoice.label}*\n\nJe vais ${getIntentActionDescription(originalIntent || pendingAction.intent, updatedEntities)}.\n\n*Confirmes-tu ?* (Oui/Non)`,
      };
    }
    
    case "awaiting_regie_selection": {
      // User is responding to a regie selection poll
      const choices = pendingAction.collectedData?.choices || [];
      const originalIntent = pendingAction.collectedData?.originalIntent;
      
      if (choices.length === 0) {
        return {
          intent: "cancel_action",
          actionTaken: "error",
          newPendingAction: null,
          responseMessage: "❌ Erreur: pas de régies disponibles. Veuillez en configurer dans l'application.",
        };
      }
      
      // Try to parse user's selection
      let selectedChoice: ChoiceOption | null = null;
      
      // 1. Number selection (1, 2, 3)
      const numberMatch = userMessage.match(/^[#]?(\d+)\.?$/);
      if (numberMatch) {
        const choiceIndex = parseInt(numberMatch[1], 10) - 1;
        if (choiceIndex >= 0 && choiceIndex < choices.length) {
          selectedChoice = choices[choiceIndex];
        }
      }
      
      // 2. Emoji numbers
      if (!selectedChoice) {
        const emojiNumbers: Record<string, number> = {
          "1️⃣": 0, "2️⃣": 1, "3️⃣": 2, "4️⃣": 3, "5️⃣": 4,
          "①": 0, "②": 1, "③": 2, "④": 3, "⑤": 4,
        };
        for (const [emoji, index] of Object.entries(emojiNumbers)) {
          if (userMessage.includes(emoji) && index < choices.length) {
            selectedChoice = choices[index];
            break;
          }
        }
      }
      
      // 3. Text match by label
      if (!selectedChoice) {
        const normalizedMessage = messageLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        for (const choice of choices) {
          const normalizedLabel = choice.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (normalizedMessage.includes(normalizedLabel) || normalizedLabel.includes(normalizedMessage)) {
            selectedChoice = choice;
            break;
          }
        }
      }
      
      if (!selectedChoice) {
        // Couldn't parse - ask again
        const choiceList = choices.map((c, i) => `${i + 1}️⃣ ${c.label}`).join("\n");
        return {
          intent: "select_regie",
          actionTaken: "invalid_selection",
          newPendingAction: pendingAction,
          responseMessage: `🤔 Je n'ai pas compris ton choix de régie.\n\nRéponds avec le *numéro* correspondant:\n${choiceList}\n\nOu tape "annule" pour abandonner.`,
        };
      }
      
      console.log(`User selected regie: ${selectedChoice.label} (${selectedChoice.id})`);
      
      // Regie selected - now continue with the original workflow
      const updatedCollectedData = {
        ...pendingAction.collectedData,
        regieId: selectedChoice.id,
        regieName: selectedChoice.label,
      };
      
      // For create_rdv: proceed to create the RDV with the selected regie
      if (originalIntent === "create_rdv") {
        return {
          intent: "create_rdv",
          actionTaken: "regie_selected_continue",
          newPendingAction: {
            intent: "create_rdv",
            entities: pendingAction.entities,
            workflowState: "awaiting_confirmation",
            collectedData: updatedCollectedData,
            createdAt: new Date().toISOString(),
          },
          responseMessage: `✅ Régie: *${selectedChoice.label}*\n\n📝 Récap RDV:\n• Client: ${updatedCollectedData.clientName}\n• Date: ${pendingAction.entities.date || "aujourd'hui"} à ${pendingAction.entities.time || "10h"}\n• Régie: ${selectedChoice.label}\n\n*Confirmes-tu ?* (Oui/Non)`,
        };
      }
      
      // For mark_signe: continue collecting data
      if (originalIntent === "mark_signe") {
        const puissance = updatedCollectedData.puissanceKwc;
        const prix = updatedCollectedData.prixTTC;
        
        let nextQuestion = `✅ Régie: *${selectedChoice.label}*\n\n`;
        
        if (!puissance) {
          nextQuestion += "📊 Quelle est la *puissance* installée (en kWc) ?";
        } else if (!prix) {
          nextQuestion += "💰 Quel est le *prix TTC* de la vente ?";
        } else {
          nextQuestion += `Récap:\n• Puissance: ${puissance}kWc\n• Prix: ${prix.toLocaleString("fr-FR")}€\n• Régie: ${selectedChoice.label}\n\n*Confirmes-tu ?* (Oui/Non)`;
        }
        
        return {
          intent: "mark_signe",
          actionTaken: "regie_selected_continue",
          newPendingAction: {
            intent: "mark_signe",
            entities: pendingAction.entities,
            workflowState: "collecting_signe_data",
            collectedData: updatedCollectedData,
            createdAt: new Date().toISOString(),
          },
          responseMessage: nextQuestion,
        };
      }
      
      // Default: continue with confirmation
      return {
        intent: originalIntent || pendingAction.intent,
        actionTaken: "regie_selected_confirm",
        newPendingAction: {
          intent: originalIntent || pendingAction.intent,
          entities: { ...pendingAction.entities, regie_id: selectedChoice.id },
          workflowState: "awaiting_confirmation",
          collectedData: updatedCollectedData,
          createdAt: new Date().toISOString(),
        },
        responseMessage: `✅ Régie *${selectedChoice.label}* sélectionnée.\n\n*Confirmes-tu cette action ?* (Oui/Non)`,
      };
    }
    
    case "collecting_external_vente_data": {
      // Collecting data for external sale (installation externe)
      const collectedData = pendingAction.collectedData || {};
      
      // Check for confirmation
      const confirmPatterns = ["oui", "ok", "confirme", "valide", "go", "yes", "c'est bon", "d'accord"];
      const isConfirming = confirmPatterns.some(p => messageLower.includes(p));
      
      // If we have all data and user confirms, execute
      if (isConfirming && collectedData.clientName && collectedData.commission && collectedData.datePose) {
        // Create client if new
        let clientId = collectedData.clientId;
        
        if (collectedData.isNewClient && !clientId) {
          // Create the new client
          const { data: newClient, error: clientError } = await supabase
            .from("clients")
            .insert({
              user_id: userId,
              nom: collectedData.clientName,
              source: "whatsapp_agent",
              regie_id: collectedData.regieId || null,
            })
            .select("id")
            .single();
          
          if (clientError) {
            console.error("Error creating client:", clientError);
            return {
              intent: "create_external_vente",
              actionTaken: "error",
              newPendingAction: null,
              responseMessage: `❌ Erreur lors de la création du client: ${clientError.message}`,
            };
          }
          
          clientId = newClient?.id;
          console.log(`Created new client ${collectedData.clientName} with ID: ${clientId}`);
        }
        
        if (!clientId) {
          return {
            intent: "create_external_vente",
            actionTaken: "error",
            newPendingAction: null,
            responseMessage: "❌ Erreur: impossible de créer ou trouver le client.",
          };
        }
        
        // Create the external vente
        const { data: vente, error: venteError } = await supabase
          .from("ventes")
          .insert({
            user_id: userId,
            client_id: clientId,
            montant_ht: collectedData.commission,
            montant_ttc: collectedData.commission, // Same for external
            type_vente: "external_installation",
            status: "installe",
            date_signature: collectedData.datePose,
            date_installation_reelle: collectedData.datePose,
            regie_id: collectedData.regieId || null,
          })
          .select("id")
          .single();
        
        if (venteError) {
          console.error("Error creating external vente:", venteError);
          return {
            intent: "create_external_vente",
            actionTaken: "error",
            newPendingAction: null,
            responseMessage: `❌ Erreur lors de la création de la vente: ${venteError.message}`,
          };
        }
        
        // Log the action
        await logAgentAction(
          supabase,
          userId,
          null,
          "create_external_vente",
          "ventes",
          vente?.id,
          { 
            client_name: collectedData.clientName, 
            commission: collectedData.commission, 
            date_pose: collectedData.datePose,
            is_new_client: collectedData.isNewClient,
          },
          null,
          `Vente externe créée: ${collectedData.clientName} - ${collectedData.commission}€ HT`
        );
        
        return {
          intent: "create_external_vente",
          actionTaken: "external_vente_created",
          entityId: vente?.id,
          entityType: "vente",
          newPendingAction: null,
          responseMessage: `✅ *Vente externe créée !*\n\n👤 Client: ${collectedData.clientName}${collectedData.isNewClient ? " (nouveau)" : ""}\n📅 Posé le: ${new Date(collectedData.datePose!).toLocaleDateString("fr-FR")}\n💰 Commission: ${collectedData.commission?.toLocaleString("fr-FR")}€ HT`,
        };
      }
      
      // If not confirming, try to extract data from message
      const numbers = userMessage.match(/(\d+(?:[.,]\d+)?)/g);
      
      // Try to extract commission amount
      if (!collectedData.commission && numbers) {
        for (const num of numbers) {
          const amount = parseFloat(num.replace(",", "."));
          if (amount >= 50 && amount <= 50000) { // Reasonable commission range
            collectedData.commission = amount;
            break;
          }
        }
      }
      
      // Try to extract date (various formats)
      if (!collectedData.datePose) {
        // Check for DD/MM/YYYY or DD-MM-YYYY format
        const dateMatch = userMessage.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (dateMatch) {
          const day = parseInt(dateMatch[1]);
          const month = parseInt(dateMatch[2]) - 1;
          let year = parseInt(dateMatch[3]);
          if (year < 100) year += 2000;
          const parsedDate = new Date(year, month, day);
          if (!isNaN(parsedDate.getTime())) {
            collectedData.datePose = parsedDate.toISOString().split("T")[0];
          }
        }
      }
      
      // Build next question or summary
      let nextQuestion = "";
      
      if (!collectedData.clientName) {
        nextQuestion = "👤 Quel est le nom du client ?";
      } else if (!collectedData.commission) {
        nextQuestion = "💰 Quel est le montant de la commission (en € HT) ?";
      } else if (!collectedData.datePose) {
        nextQuestion = "📅 Quelle est la date de pose ? (ex: 20/01/2026)";
      } else {
        // All data collected - show summary
        nextQuestion = `📝 *Récapitulatif vente externe:*\n\n👤 Client: ${collectedData.clientName}${collectedData.isNewClient ? " (nouveau)" : ""}\n📅 Date de pose: ${new Date(collectedData.datePose).toLocaleDateString("fr-FR")}\n💰 Commission: ${collectedData.commission?.toLocaleString("fr-FR")}€ HT\n\n*Confirmes-tu ?* (Oui/Non)`;
      }
      
      return {
        intent: "create_external_vente",
        actionTaken: "collecting_data",
        newPendingAction: {
          ...pendingAction,
          collectedData,
        },
        responseMessage: nextQuestion,
      };
    }
    
    case "awaiting_new_sale_type": {
      // User needs to choose between internal and external sale for a new client
      const collectedData = pendingAction.collectedData || {};
      
      // Parse user's selection (1 = interne, 2 = externe)
      let selectedType: "interne" | "externe" | null = null;
      
      // Check for number selection
      if (userMessage.match(/^[#]?1\.?$/) || messageLower.includes("interne") || messageLower.includes("1️⃣")) {
        selectedType = "interne";
      } else if (userMessage.match(/^[#]?2\.?$/) || messageLower.includes("externe") || messageLower.includes("2️⃣")) {
        selectedType = "externe";
      }
      
      if (!selectedType) {
        // Couldn't parse selection - ask again
        return {
          intent: "mark_signe",
          actionTaken: "invalid_selection",
          newPendingAction: pendingAction,
          responseMessage: `🤔 Je n'ai pas compris. Réponds *1* pour une vente interne ou *2* pour une vente externe.\n\n1️⃣ Vente *interne* (avec RDV, puissance, prix TTC)\n2️⃣ Vente *externe* (installation tierce, commission uniquement)\n\nOu tape "annule" pour abandonner.`,
        };
      }
      
      // User selected a type - now continue with the appropriate workflow
      if (selectedType === "externe") {
        // Switch to external sale workflow
        return {
          intent: "create_external_vente",
          actionTaken: "switched_to_external",
          newPendingAction: {
            intent: "create_external_vente",
            entities: { ...pendingAction.entities, is_new_client: true },
            workflowState: "collecting_external_vente_data",
            collectedData: {
              clientName: collectedData.clientName,
              isNewClient: true,
              commission: collectedData.prixTTC || undefined, // Use price as commission if provided
            },
            createdAt: new Date().toISOString(),
          },
          responseMessage: `📦 *Vente externe pour ${collectedData.clientName}* (nouveau client)\n\n💰 Quel est le montant de la *commission* (en € HT) ?`,
        };
      }
      
      // Internal sale - continue with mark_signe workflow for new client
      return {
        intent: "mark_signe",
        actionTaken: "new_client_internal_sale",
        newPendingAction: {
          intent: "mark_signe",
          entities: { ...pendingAction.entities, is_new_client: true, vente_type: "interne" },
          workflowState: "collecting_signe_data",
          collectedData: {
            clientName: collectedData.clientName,
            isNewClient: true,
            puissanceKwc: collectedData.puissanceKwc || undefined,
            prixTTC: collectedData.prixTTC || undefined,
          },
          createdAt: new Date().toISOString(),
        },
        responseMessage: collectedData.puissanceKwc && collectedData.prixTTC
          ? `📝 *Nouvelle vente interne pour ${collectedData.clientName}* (nouveau client)\n\nRécap:\n• Puissance: ${collectedData.puissanceKwc}kWc\n• Prix: ${collectedData.prixTTC?.toLocaleString("fr-FR")}€\n\n*Confirmes-tu ?* (Oui/Non)`
          : collectedData.puissanceKwc
            ? `📝 *Nouvelle vente interne pour ${collectedData.clientName}* (nouveau client)\n\n💰 Quel est le *prix TTC* de la vente ?`
            : `📝 *Nouvelle vente interne pour ${collectedData.clientName}* (nouveau client)\n\n📊 Quelle est la *puissance* installée (en kWc) ?`,
      };
    }
    
    default:
      return null;
  }
}

// Helper to describe what an intent will do
function getIntentActionDescription(intent: Intent, entities: Record<string, unknown>): string {
  switch (intent) {
    case "query_client_info":
      return `te donner les infos de ce client`;
    case "query_rdv_detail":
      return `te faire le topo de ce RDV`;
    case "query_vente_detail":
      return `te montrer les détails de cette vente`;
    case "create_rdv":
      return `créer un RDV${entities.date ? ` le ${entities.date}` : ""}${entities.time ? ` à ${entities.time}` : ""}`;
    case "update_rdv":
      return `modifier ce RDV`;
    case "update_vente_status":
      return `mettre à jour le statut en "${entities.status}"`;
    case "update_vente_pipeline":
      return `passer le pipeline à "${entities.pipeline_status}"`;
    case "mark_signe":
      return `enregistrer cette vente comme signée`;
    case "update_vente_data":
      return `modifier les données de cette vente`;
    case "create_external_vente":
      return `créer une vente externe avec commission`;
    default:
      return `traiter ta demande`;
  }
}

// Create a signed vente from collected data
// deno-lint-ignore no-explicit-any
async function createSignedVente(
  supabase: any,
  userId: string,
  data: PendingAction["collectedData"]
): Promise<{ success: boolean; venteId?: string; clientId?: string; error?: string }> {
  let clientId = data?.clientId;
  let rdvId = data?.rdvId;
  
  // If this is a new client, create the client first
  if (data?.isNewClient && !clientId && data.clientName) {
    console.log(`Creating new client: ${data.clientName}`);
    
    const { data: newClient, error: clientError } = await supabase
      .from("clients")
      .insert({
        user_id: userId,
        nom: data.clientName,
        source: "whatsapp_agent",
        regie_id: data.regieId || null,
      })
      .select("id")
      .single();
    
    if (clientError) {
      console.error("Error creating client:", clientError);
      return { success: false, error: `Erreur création client: ${clientError.message}` };
    }
    
    clientId = newClient?.id;
    console.log(`New client created with ID: ${clientId}`);
    
    // Create a RDV for the new client (dated today)
    const { data: newRdv, error: rdvError } = await supabase
      .from("rdv")
      .insert({
        user_id: userId,
        client_id: clientId,
        date_heure: new Date().toISOString(),
        status: "positif",
        type_rdv: "R1",
        type_projet: "pv",
        source: "whatsapp_agent",
        regie_id: data.regieId || null,
      })
      .select("id")
      .single();
    
    if (rdvError) {
      console.error("Error creating RDV for new client:", rdvError);
      // Continue anyway - RDV is optional for the vente
    } else {
      rdvId = newRdv?.id;
      console.log(`New RDV created with ID: ${rdvId}`);
    }
  }
  
  if (!clientId) {
    return { success: false, error: "Données client manquantes" };
  }
  
  const puissance = data?.puissanceKwc || 3;
  const prixTTC = data?.prixTTC || 0;
  const tauxTVA = puissance <= 3 ? 1.10 : 1.20;
  const prixHT = prixTTC / tauxTVA;
  
  // Create the vente
  const { data: vente, error } = await supabase
    .from("ventes")
    .insert({
      user_id: userId,
      client_id: clientId,
      rdv_id: rdvId || null,
      regie_id: data?.regieId,
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
  
  // Update RDV status if we have one
  if (rdvId) {
    await supabase
      .from("rdv")
      .update({ status: "positif" })
      .eq("id", rdvId);
  }
  
  return { success: true, venteId: vente?.id, clientId };
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

// Fetch user's régies (excluding HEJJA ones)
// deno-lint-ignore no-explicit-any
async function fetchUserRegies(supabase: any, userId: string): Promise<Array<{ id: string; nom: string; couleur: string | null }>> {
  const { data: regies, error } = await supabase
    .from("regies")
    .select("id, nom, couleur")
    .eq("user_id", userId)
    .eq("actif", true)
    .eq("is_hejja", false) // Exclude HEJJA régies
    .order("nom");
  
  if (error) {
    console.error("Error fetching regies:", error);
    return [];
  }
  
  return regies || [];
}

// Generate regie selection poll
// deno-lint-ignore no-explicit-any
async function generateRegiePoll(
  supabase: any,
  userId: string,
  originalIntent: Intent,
  entities: Record<string, unknown>,
  collectedData: PendingAction["collectedData"]
): Promise<{ needsSelection: boolean; pendingAction?: PendingAction; responseMessage?: string; defaultRegieId?: string }> {
  const regies = await fetchUserRegies(supabase, userId);
  
  if (regies.length === 0) {
    return { 
      needsSelection: false, 
      responseMessage: "⚠️ Aucune régie configurée. Configurez-en une dans l'application." 
    };
  }
  
  // If only one regie, use it automatically
  if (regies.length === 1) {
    return { 
      needsSelection: false, 
      defaultRegieId: regies[0].id 
    };
  }
  
  // Multiple régies - create a selection poll
  const choices: ChoiceOption[] = regies.slice(0, 5).map(r => ({
    id: r.id,
    label: r.nom,
    entityType: "client" as const, // Using client as a generic type here
    data: { regie_id: r.id, regie_nom: r.nom },
  }));
  
  const choiceList = choices.map((c, i) => `${i + 1}️⃣ ${c.label}`).join("\n");
  
  const pendingAction: PendingAction = {
    intent: "select_regie",
    entities,
    workflowState: "awaiting_regie_selection",
    collectedData: {
      ...collectedData,
      choices,
      originalIntent,
    },
    createdAt: new Date().toISOString(),
  };
  
  return {
    needsSelection: true,
    pendingAction,
    responseMessage: `🏢 *À quelle régie attribuer ce dossier ?*\n\n${choiceList}\n\nRéponds avec le *numéro* de ton choix.`,
  };
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
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentTime = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
  const currentDay = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
  const memoriesSection = formatMemoriesForPrompt(userMemories);
  const customPromptsSection = formatPromptsForSystem(userPrompts);
  
  const systemPrompt = `Tu es l'assistant IA WhatsApp de DébalePro pour installateurs ENR.

📅 DATE ET HEURE ACTUELLES:
- Aujourd'hui: ${currentDay}
- Heure actuelle: ${currentTime} (Europe/Paris)
- Date ISO: ${today}

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
- update_rdv: Modifier/annuler/SUPPRIMER RDV (ex: "annule rdv Martin", "supprime tous mes rdv de la semaine", "supprime les rdv annulés", "supprime les rdv de vendredi et samedi dernier")
- mark_signe: Signature vente - workflow complet (ex: "Martin signé", "j'ai vendu chez Dupont")
- update_vente_status: Statut RDV (négatif, absent, r2, reporté) - NE PAS utiliser pour signé/positif
- update_vente_pipeline: Pipeline vente existante (posé, payé, CQ fait, annulé)
- import_document: Document client (CNI, RIB, facture énergie)
- import_facture: Note de frais (ticket, carburant, péage)
- query_commissions: "mes coms", "combien je gagne" → Vue globale commissions (totaux uniquement)
- query_ventes_a_facturer: "dossiers à facturer", "ventes à facturer", "facturables", "du sûr" → Liste DÉTAILLÉE des ventes prêtes à facturer (posées >= 2 sem OU attente_paiement) avec NOM PRÉNOM + COMMISSION pour chaque
- query_ventes_en_cours: "dossiers en cours", "ventes en cours", "mes en cours" → Liste DÉTAILLÉE des ventes signées non encore posées avec NOM PRÉNOM + COMMISSION pour chaque
- query_ventes_by_filter: "ventes posées", "ventes payées", "ventes signées", "posés < 2 sem", "par régie X" → Liste filtrée avec Entity: filter_type (poses, payees, signees, poses_recentes, par_regie)
- query_stats: "stats", "CA", "taux conversion", "chiffres"
- query_client_info: "téléphone de X", "adresse de X"
- query_rdv_planning: "planning", "rdv demain", "agenda" → TOUJOURS citer JOUR + DATE + HEURE + NOM CLIENT
- query_rdv_detail: "topo Dupont", "infos rdv Martin", "brief client X" → Fiche détaillée avec CONSOMMATION, PROFIL CLIENT, COMMENTAIRES GMAIL
- query_ventes: "mes ventes", "toutes mes ventes" → Liste simple sans détails commission
- query_vente_detail: "vente Dupont", "dossier Martin", "infos vente X" → Fiche détaillée de la vente avec prix, puissance, statut, dates
- query_frais: "mes frais", "frais de la semaine", "frais ce mois", "combien de carburant" → Liste des frais avec Entity: period (today/week/month) et frais_categorie (carburant, repas, hotel, peage, parking, etc.)
- query_frais_detail: "total frais", "répartition frais", "dépenses par catégorie" → Total avec répartition par catégorie
- query_hejja: "mode hejja", "retape", "prix hejja", "régies hejja", "commissions hejja" → Demande liée au mode HEJJA → REDIRIGER vers l'application car l'agent n'a pas accès
- update_vente_data: Modifier les données d'une vente (prix, puissance, dates, technicien, commentaires) → Ex: "Dupont prix 18000", "Martin 9kWc"
- user_feedback: Corrections/préférences → EXTRAIRE feedback_type, feedback_key, feedback_value
- conversation: salutations simples
- unknown: non compris

CATÉGORIES FRAIS: carburant, repas, hotel, peage, parking, train, location_vehicule, autre

STATUTS RDV: nouveau, positif, negatif, absent, reporte, r2, annule
STATUTS PIPELINE VENTE: cq_a_faire, cq_fait, attente_financement, envoi_pose, en_installation, installe, attente_paiement, paye, annule

⚠️ PARSING DATES RELATIVES - CRITIQUE:
- "vendredi dernier" → le vendredi de la semaine PASSÉE
- "samedi dernier" → le samedi de la semaine PASSÉE  
- "lundi prochain" → le lundi de la semaine PROCHAINE
- "demain", "aujourd'hui", "hier" → dates relatives simples
- "vendredi et samedi dernier" → DEUX dates spécifiques à extraire dans specific_dates
- Pour ces dates relatives, tu DOIS calculer la date exacte au format YYYY-MM-DD
- Exemple: si aujourd'hui = dimanche 26/01/2025, "vendredi dernier" = 2025-01-24, "samedi dernier" = 2025-01-25
- Utilise specific_dates: ["2025-01-24", "2025-01-25"] pour les dates multiples

⚠️ DÉFINITIONS MÉTIER CRITIQUES:
- "En cours" = signées mais PAS ENCORE POSÉES (signe, cq_a_faire, cq_fait, attente_financement, envoi_pose - EXCLUT en_installation et installe)
- "À facturer" ou "Du sûr" = posées depuis >= 2 semaines (installe depuis 14+ jours OU attente_paiement)
- "Posées < 2 sem" = récemment posées, pas encore facturables

⚠️ RÈGLES MÉTIER EXCLUSIONS (par défaut):
- Par défaut, les RDV "annule"/"reporte" et ventes "annule" sont EXCLUS des requêtes
- "mes rdv", "planning", "mes ventes", "ventes en cours" → exclure annulés/reportés
- Stats et commissions → JAMAIS compter les annulés

📋 EXCEPTION - Requêtes explicites sur annulés:
- Si l'utilisateur demande EXPLICITEMENT les annulés ("rdv annulés", "ventes annulées", "dossiers annulés")
- → Utiliser include_cancelled: true dans les outils query_rdv_planning ou query_ventes
- Exemples: "montre-moi les rdv annulés", "liste des ventes annulées ce mois"

RÈGLES CRITIQUES:
1. Pour "signé/positif/vente/j'ai vendu" → TOUJOURS mark_signe (workflow complet avec collecte données)
2. Pour "posé/installé" → update_vente_pipeline avec installe
3. Pour "payé" → update_vente_pipeline avec paye
4. Pour "absent/négatif" → update_vente_status
5. Actions en masse: LISTER d'abord, demander confirmation explicite
6. Si le message CRITIQUE ou CORRIGE mon comportement → TOUJOURS user_feedback
7. Pour "vente externe/installation externe/commission externe" → create_external_vente (crée client si nouveau)

🔧 VENTES EXTERNES (create_external_vente):
- Une vente externe = installation faite par un tiers (pas tes propres dossiers)
- Tu enregistres uniquement ta COMMISSION (pas de CA)
- SI le client n'existe pas (recherche échouée), tu PEUX le créer automatiquement
- OBLIGATOIRE dans les entities: client_name, commission, date_pose
- ⚠️ TOUJOURS INCLURE client_name dans les entities ! C'est le nom du client.
- Si l'utilisateur dit "c'est un nouveau client" après une recherche échouée → mets is_new_client: true dans les entities
- Exemple: "vente externe Massenat 700€ posé le 20/01" → create_external_vente avec entities: {"client_name":"Massenat","commission":700,"date_pose":"2026-01-20","is_new_client":true}

⚠️ CONFIRMATION OBLIGATOIRE - RÈGLE ABSOLUE:
- Avant TOUTE action qui MODIFIE des données (create_rdv, update_rdv, update_vente_status, update_vente_pipeline, mark_signe, update_vente_data, create_external_vente), tu DOIS:
  1. REFORMULER ce que tu as compris de manière claire et précise
  2. DEMANDER CONFIRMATION explicite avec "Confirmes-tu ?" (Oui/Non)
  3. Mettre requiresConfirmation: true dans ta réponse
- Le responseMessage doit contenir:
  • Un RÉCAPITULATIF de l'action prévue (client, action, détails)
  • Les DONNÉES qui vont être modifiées
  • La question "Confirmes-tu ?" à la fin
- Exemple: "📝 J'ai compris:\n• Client: Dupont Jean\n• Action: Annuler le RDV du 15/01 à 14h\n\n*Confirmes-tu ?* (Oui/Non)"
- Seules les requêtes (query_*) et conversations ne nécessitent PAS de confirmation

EXEMPLES DE CLASSIFICATION:
- "Dupont posé" → update_vente_pipeline (ACTION: client + statut)
- "quand tu donnes le planning mets toujours le jour" → user_feedback (REMARQUE: instruction format)
- "non c'est pas ça, je voulais dire Martin pas Dupont" → user_feedback (CORRECTION)
- "rappelle-toi que X veut dire Y" → user_feedback (RÈGLE)
- "mes rdv demain" → query_rdv_planning (ACTION: demande données)
- "tu as oublié de donner l'heure" → user_feedback (CRITIQUE comportement)

⚠️ RÈGLE RÉPONSE COMPLÈTE - ABSOLUE:
- Tu DOIS TOUJOURS fournir des réponses COMPLÈTES et EXHAUSTIVES
- JAMAIS de réponse tronquée, partielle, ou coupée
- Si une liste contient 10 éléments, tu LISTES les 10 sans dire "... et X autres"
- Pour les tableaux/listes: affiche TOUS les résultats demandés (jusqu'à 50 éléments)
- Si la réponse risque d'être très longue (>1500 chars), structure-la en SECTIONS avec titres
- Utilise des PARTIES numérotées si nécessaire: "[1/2]", "[2/2]"
- Ne JAMAIS dire "je vais résumer" ou "voici les principaux" - donne TOUT

Format réponse JSON:
{"intent":"...","confidence":0-100,"entities":{"client_name":"...","date":"YYYY-MM-DD","time":"HH:MM","status":"...","pipeline_status":"...","period":"today|week|month|all","amount":number,"puissance_kwc":number,"technicien":"...","commentaire":"...","include_cancelled":true/false,"feedback_type":"correction|preference|rule|alias","feedback_key":"ce que je dois retenir","feedback_value":"la règle/correction exacte"},"requiresConfirmation":true/false,"responseMessage":"..."}

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
                  enum: ["create_rdv", "update_rdv", "mark_signe", "update_vente_status", "update_vente_pipeline", "create_external_vente", "import_document", "import_facture", "query_commissions", "query_ventes_a_facturer", "query_ventes_en_cours", "query_ventes_by_filter", "query_stats", "query_client_info", "query_rdv_planning", "query_rdv_detail", "query_ventes", "query_vente_detail", "query_frais", "query_frais_detail", "query_hejja", "update_vente_data", "user_feedback", "confirm_action", "cancel_action", "conversation", "unknown"]
                },
                confidence: { type: "number", minimum: 0, maximum: 100 },
                entities: {
                  type: "object",
                  properties: {
                    client_name: { type: "string" },
                    date: { type: "string" },
                    time: { type: "string" },
                    address: { type: "string" },
                    action: { type: "string", enum: ["annule", "reporte", "decale", "supprime"], description: "Action to perform on RDV: annule (cancel/mark as cancelled), reporte (postpone), decale (reschedule), supprime (DELETE permanently)" },
                    status: { type: "string" },
                    pipeline_status: { type: "string", enum: ["cq_a_faire", "cq_fait", "attente_financement", "envoi_pose", "en_installation", "installe", "attente_paiement", "paye", "annule"] },
                    amount: { type: "number" },
                    puissance_kwc: { type: "number" },
                    technicien: { type: "string" },
                    commentaire: { type: "string" },
                    document_type: { type: "string" },
                    period: { type: "string", enum: ["today", "week", "next_week", "month", "all"], description: "Predefined period filter. Do NOT use if specific_dates is provided." },
                    specific_dates: { type: "array", items: { type: "string" }, description: "Array of specific dates in YYYY-MM-DD format. Use for precise date filtering like 'vendredi dernier', 'samedi 24 janvier'. Calculate dates from relative expressions. Example: ['2025-01-24', '2025-01-25']" },
                    query_type: { type: "string", enum: ["list", "total", "detail"] },
                    query_field: { type: "string", description: "Specific field the user is asking about: commission, statut, prix, montant, puissance, panneau, date, pose, adresse, telephone, regie. Extract this when user asks a specific question like 'quelle est la commission de X?' or 'quel est le statut de Y?'" },
                    filter_type: { type: "string", enum: ["poses", "payees", "signees", "poses_recentes", "en_cours", "a_facturer", "par_regie"], description: "Filter type for query_ventes_by_filter" },
                    regie_name: { type: "string", description: "Name of the régie for filtering" },
                    include_cancelled: { type: "boolean", description: "Include cancelled items (default false)" },
                    status_filter: { type: "string", enum: ["nouveau", "reporte", "r2", "r2_prestudy", "signe", "negatif", "annule", "all"], description: "Filter RDVs by status. Use 'all' to include all statuses regardless of state" },
                    frais_categorie: { type: "string", enum: ["carburant", "repas", "hotel", "peage", "parking", "train", "location_vehicule", "autre"], description: "Expense category filter" },
                    feedback_type: { type: "string", enum: ["correction", "preference", "rule", "alias"] },
                    feedback_key: { type: "string", description: "What the user wants to correct or define" },
                    feedback_value: { type: "string", description: "The correction or preference value" },
                    commission: { type: "number", description: "Commission amount in EUR HT for external sales" },
                    date_pose: { type: "string", description: "Installation date in YYYY-MM-DD format for external sales" },
                    is_new_client: { type: "boolean", description: "True if the client doesn't exist and should be created" }
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
      const isNewClient = entities.is_new_client as boolean;
      
      if (!clientName) {
        return { actionTaken: "missing_client" };
      }

      let client: ClientMatch | null = null;
      
      // If user confirmed this is a new client, skip search and create client
      if (isNewClient && clientName) {
        console.log(`Creating new client for RDV: ${clientName}`);
        
        // Create new client
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            user_id: userId,
            nom: clientName,
            source: "whatsapp_agent",
          })
          .select("id, nom, prenom")
          .single();
        
        if (clientError) {
          console.error("Error creating client:", clientError);
          return { 
            actionTaken: "error",
            customResponse: `❌ Erreur lors de la création du client: ${clientError.message}`
          };
        }
        
        client = {
          id: newClient.id,
          nom: newClient.nom,
          prenom: newClient.prenom || "",
          fullName: newClient.nom,
          score: 1,
          matchType: "exact" as const,
        };
        console.log(`New client created: ${client!.id}`);
      } else {
        const searchResult = await findClientByName(supabase, userId, clientName);
        
        if (searchResult.notFound) {
          // No clients found - ask if user wants to create a new client
          const pendingAction: PendingAction = {
            intent: "create_rdv",
            entities: { ...entities, is_new_client: true },
            workflowState: "awaiting_confirmation",
            collectedData: {
              clientName: clientName,
              isNewClient: true,
              date: entities.date as string,
              time: entities.time as string,
            },
            createdAt: new Date().toISOString(),
          };
          
          return {
            actionTaken: "needs_client_creation",
            newPendingAction: pendingAction,
            customResponse: `🆕 Client "${clientName}" non trouvé.\n\n*Veux-tu le créer et programmer le RDV ?*\n\n👆 Réponds *Oui* ou *Non*`,
          };
        }
        
        // If no exact match but we have suggestions - check score
        if (!searchResult.exactMatch && searchResult.suggestions.length > 0) {
          const bestScore = searchResult.suggestions[0]?.score || 0;
          
          if (bestScore >= 0.6) {
            // Suggestions are relevant - generate a choice poll WITH a "nouveau client" option
            const poll = generateChoicePollWithNewClient(
              searchResult.suggestions,
              clientName,
              "create_rdv",
              entities
            );
            
            return {
              actionTaken: "client_ambiguous",
              newPendingAction: poll.pendingAction,
              customResponse: poll.responseMessage,
            };
          } else {
            // Suggestions are too weak - ask if user wants to create a new client
            const pendingAction: PendingAction = {
              intent: "create_rdv",
              entities: { ...entities, is_new_client: true },
              workflowState: "awaiting_confirmation",
              collectedData: {
                clientName: clientName,
                isNewClient: true,
                date: entities.date as string,
                time: entities.time as string,
              },
              createdAt: new Date().toISOString(),
            };
            
            return {
              actionTaken: "needs_client_creation",
              newPendingAction: pendingAction,
              customResponse: `🆕 Aucun client correspondant à "${clientName}".\n\n*Veux-tu le créer et programmer le RDV ?*\n\n👆 Réponds *Oui* ou *Non*`,
            };
          }
        }

        client = searchResult.exactMatch || searchResult.clients[0];
      }
      
      // Guard against null client (should not happen at this point)
      if (!client) {
        return { actionTaken: "error", customResponse: "❌ Erreur: client non défini." };
      }
      
      // Parse date and time
      const dateStr = entities.date as string || new Date().toISOString().split("T")[0];
      const timeStr = entities.time as string || "10:00";
      const dateHeure = `${dateStr}T${timeStr}:00`;

      // Check if we need to ask for regie selection
      const regiePoll = await generateRegiePoll(
        supabase,
        userId,
        "create_rdv",
        entities,
        {
          clientId: client.id,
          clientName: `${client.prenom || ""} ${client.nom}`.trim(),
        }
      );
      
      if (regiePoll.needsSelection) {
        // Enhance the pending action with client info
        const pendingAction = regiePoll.pendingAction!;
        pendingAction.collectedData = {
          ...pendingAction.collectedData,
          clientId: client.id,
          clientName: `${client.prenom || ""} ${client.nom}`.trim(),
        };
        
        return {
          actionTaken: "needs_regie_selection",
          newPendingAction: pendingAction,
          customResponse: `📅 *RDV pour ${client.prenom || ""} ${client.nom}*\n${dateStr} à ${timeStr}\n\n${regiePoll.responseMessage}`,
        };
      }
      
      // Use default or single regie
      const regieId = regiePoll.defaultRegieId || null;

      // Create RDV
      const { data: rdv, error: rdvError } = await supabase
        .from("rdv")
        .insert({
          user_id: userId,
          client_id: client.id,
          date_heure: dateHeure,
          adresse: entities.address as string || null,
          status: "nouveau",
          type_rdv: "R1",
          type_projet: "pv",
          source: "whatsapp",
          regie_id: regieId,
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
        { date_heure: dateHeure, client_id: client.id, status: "nouveau", regie_id: regieId },
        null, // No previous data for creation
        `Création RDV ${client.prenom || ""} ${client.nom} le ${dateStr} à ${timeStr}`
      );

      return { 
        actionTaken: "rdv_created", 
        entityId: rdv?.id, 
        entityType: "rdv" 
      };
    }

    case "query_hejja": {
      return {
        actionTaken: "hejja_redirect",
        customResponse: `🔒 *Mode HEJJA*\n\nLes fonctionnalités HEJJA (retape, prix spéciaux, régies HEJJA, commissions HEJJA) ne sont pas accessibles via l'assistant.\n\n👉 *Accédez à l'application* pour activer le mode HEJJA et utiliser ces fonctionnalités.`,
      };
    }

    case "update_rdv": {
      const clientName = entities.client_name as string;
      const action = entities.action as string; // "annule", "reporte", "decale", "supprime"
      const newDate = entities.date as string;
      const newTime = entities.time as string;
      const period = entities.period as string; // "today", "week", "next_week", "month", "all"
      const specificDates = entities.specific_dates as string[] | undefined; // Array of YYYY-MM-DD dates
      const regieFilter = entities.regie_name as string;
      const statusFilter = entities.status_filter as string; // Filter by specific status
      
      console.log(`update_rdv: period=${period}, specificDates=${JSON.stringify(specificDates)}, action=${action}`);
      
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
      
      // Apply date filter - PRIORITY: specific_dates > period
      const now = new Date();
      
      if (specificDates && specificDates.length > 0) {
        // Build OR conditions for each specific date (match any day in the array)
        // For each date, filter RDVs that start on that day (00:00 to 23:59)
        const dateConditions: string[] = [];
        for (const dateStr of specificDates) {
          // Parse the date and create a range for the full day
          const dateParts = dateStr.split("-");
          if (dateParts.length === 3) {
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1; // JS months are 0-indexed
            const day = parseInt(dateParts[2]);
            const dayStart = new Date(year, month, day, 0, 0, 0);
            const dayEnd = new Date(year, month, day, 23, 59, 59);
            dateConditions.push(`and(date_heure.gte.${dayStart.toISOString()},date_heure.lte.${dayEnd.toISOString()})`);
          }
        }
        if (dateConditions.length > 0) {
          // Apply the OR filter for all dates
          query = query.or(dateConditions.join(","));
        }
        console.log(`Applied specific_dates filter: ${specificDates.join(", ")}`);
      } else if (period === "today") {
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
      // If period === "all" or no date filter, no date constraint applied
      
      // Apply status filter based on action type and explicit filter
      if (action === "supprime") {
        // For delete: allow all statuses OR filter by specific status
        if (statusFilter && statusFilter !== "all") {
          query = query.eq("status", statusFilter);
        }
        // If statusFilter is "all" or not specified, don't filter by status - allow deleting any RDV
      } else {
        // For other actions (annule, reporte, decale): only modifiable statuses by default
        if (statusFilter && statusFilter !== "all") {
          query = query.eq("status", statusFilter);
        } else {
          // Default: only non-final statuses for modification
          query = query.in("status", ["nouveau", "reporte", "r2", "r2_prestudy"]);
        }
      }
      
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
        if (specificDates && specificDates.length > 0) {
          // Format specific dates for display
          const formattedDates = specificDates.map(ds => {
            const d = new Date(ds + "T12:00:00"); // Add time to avoid timezone issues
            return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
          });
          filterParts.push(formattedDates.join(" + "));
        } else if (period) {
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
        const actionLabel = action === "annule" ? "annuler" : action === "reporte" ? "reporter" : action === "supprime" ? "SUPPRIMER" : "modifier";
        
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
      
      // Single RDV - also require confirmation before execution
      const rdv = rdvsToModify[0];
      const clientInfo = rdv.clients as { nom: string; prenom?: string };
      const clientFullName = `${clientInfo?.prenom || ""} ${clientInfo?.nom || ""}`.trim();
      const rdvDate = new Date(rdv.date_heure);
      const dateStr = rdvDate.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
      const timeStr = rdvDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      
      // For single RDV, check if we're coming from a confirmation (has collectedData with rdvIds)
      // If collectedData exists with rdvIds, we're in confirmed execution mode
      const isConfirmedExecution = entities.confirmed_single === true;
      
      if (!isConfirmedExecution) {
        // Ask for confirmation first
        const actionLabel = action === "annule" ? "ANNULER" : action === "reporte" ? "REPORTER" : action === "supprime" ? "SUPPRIMER" : "MODIFIER";
        const warningText = action === "supprime" ? "\n\n⚠️ Cette action est **irréversible**." : "";
        
        const confirmMsg = `📋 *RDV à ${actionLabel}*\n\n• ${dateStr} ${timeStr}: ${clientFullName}${warningText}\n\n*Confirmes-tu ?* (Oui/Non)`;
        
        const singlePendingAction: PendingAction = {
          intent: "update_rdv",
          entities: { ...entities, confirmed_single: true },
          workflowState: "awaiting_confirmation",
          collectedData: {
            rdvIds: [rdv.id],
            action,
            newDate,
            newTime,
          },
          createdAt: new Date().toISOString(),
        };
        
        return {
          actionTaken: "awaiting_confirmation",
          entityType: "workflow",
          newPendingAction: singlePendingAction,
          customResponse: confirmMsg,
        };
      }
      
      // Handle DELETE action (supprime) for single RDV - now confirmed
      if (action === "supprime") {
        // Get previous data for undo capability
        const previousRdvData = await getPreviousData(supabase, "rdv", rdv.id, userId);
        
        // Log the action before deletion
        await logAgentAction(
          supabase,
          userId,
          messageId,
          "delete_rdv",
          "rdv",
          rdv.id,
          { deleted: true },
          previousRdvData,
          `RDV supprimé définitivement: ${clientFullName}`
        );
        
        const { error: deleteError } = await supabase
          .from("rdv")
          .delete()
          .eq("id", rdv.id);
        
        if (deleteError) {
          console.error("Error deleting RDV:", deleteError);
          return { actionTaken: "error" };
        }
        
        return {
          actionTaken: "rdv_deleted",
          entityId: rdv.id,
          entityType: "rdv",
        };
      }
      
      // Handle UPDATE actions (annule, reporte, decale)
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
        // Generate a choice poll for the user to select the right client
        const poll = generateChoicePoll(
          searchResult.suggestions,
          clientName,
          "update_vente_status",
          entities
        );
        
        return {
          actionTaken: "client_ambiguous",
          newPendingAction: poll.pendingAction,
          customResponse: poll.responseMessage,
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
        // Generate a choice poll for the user to select the right client
        const poll = generateChoicePoll(
          searchResult.suggestions,
          clientName,
          "update_vente_pipeline",
          entities
        );
        
        return {
          actionTaken: "client_ambiguous",
          newPendingAction: poll.pendingAction,
          customResponse: poll.responseMessage,
        };
      }

      const matchedClient = searchResult.exactMatch || searchResult.clients[0];
      console.log(`Looking for vente with client_id: ${matchedClient.id}, user_id: ${userId}`);
      
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
      
      console.log(`Vente search result: ${ventes?.length || 0} ventes found, error: ${venteError?.message || 'none'}`);
      
      if (venteError || !ventes || ventes.length === 0) {
        console.error(`Vente not found for client ${matchedClient.id}:`, venteError);
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
      const isNewClient = entities.is_new_client as boolean;
      const venteType = entities.vente_type as string; // "interne" or "externe"
      
      let matchedClient: ClientMatch | null = null;
      let rdv: { id: string; client_id: string; regie_id: string | null } | null = null;
      
      // If user confirmed this is a new client, create the client first
      if (isNewClient && clientName) {
        console.log(`Creating new client for sale: ${clientName}, type: ${venteType || "interne"}`);
        
        // First, check if we need a regie selection
        const regiePoll = await generateRegiePoll(
          supabase,
          userId,
          "mark_signe",
          entities,
          {
            clientName: clientName,
            isNewClient: true,
            puissanceKwc: entities.puissance_kwc as number || undefined,
            prixTTC: entities.amount as number || undefined,
          }
        );
        
        if (regiePoll.needsSelection) {
          return {
            actionTaken: "needs_regie_selection",
            newPendingAction: {
              ...regiePoll.pendingAction!,
              collectedData: {
                ...regiePoll.pendingAction!.collectedData,
                isNewClient: true,
                clientName: clientName,
              },
            },
            customResponse: `✍️ *Nouvelle vente pour ${clientName}* (nouveau client) 🎉\n\n${regiePoll.responseMessage}`,
          };
        }
        
        const regieId = regiePoll.defaultRegieId || entities.regie_id as string || null;
        
        // Create the new client
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            user_id: userId,
            nom: clientName,
            source: "whatsapp_agent",
            regie_id: regieId,
          })
          .select("id, nom, prenom")
          .single();
        
        if (clientError) {
          console.error("Error creating client:", clientError);
          return { 
            actionTaken: "error",
            customResponse: `❌ Erreur lors de la création du client: ${clientError.message}`
          };
        }
        
        matchedClient = {
          id: newClient.id,
          nom: newClient.nom,
          prenom: newClient.prenom || "",
          fullName: newClient.nom,
          score: 1,
          matchType: "exact" as const,
        };
        console.log(`New client created: ${matchedClient.id}`);
        
        // Create a RDV for the new client (dated today)
        const { data: newRdv, error: rdvError } = await supabase
          .from("rdv")
          .insert({
            user_id: userId,
            client_id: matchedClient.id,
            date_heure: new Date().toISOString(),
            status: "positif",
            type_rdv: "R1",
            type_projet: "pv",
            source: "whatsapp_agent",
            regie_id: regieId,
          })
          .select("id, client_id, regie_id")
          .single();
        
        if (!rdvError && newRdv) {
          rdv = newRdv;
          console.log(`New RDV created: ${newRdv.id}`);
        }
      }
      // First, find the client using fuzzy search
      else if (clientName) {
        const searchResult = await findClientByName(supabase, userId, clientName);
        
        // Check if no results at all
        if (searchResult.notFound) {
          // No clients found - ask if it's a new sale (internal or external)
          const pendingAction: PendingAction = {
            intent: "mark_signe",
            entities: { ...entities, is_new_client: true },
            workflowState: "awaiting_new_sale_type",
            collectedData: {
              clientName: clientName,
              isNewClient: true,
              puissanceKwc: entities.puissance_kwc as number || undefined,
              prixTTC: entities.amount as number || undefined,
            },
            createdAt: new Date().toISOString(),
          };
          
          return {
            actionTaken: "needs_new_sale_type",
            entityType: "workflow",
            newPendingAction: pendingAction,
            customResponse: `🆕 Client "${clientName}" non trouvé.\n\n*Est-ce une nouvelle vente ?*\n\n1️⃣ Vente *interne* (avec RDV, puissance, prix TTC)\n2️⃣ Vente *externe* (installation tierce, commission uniquement)\n\n👆 *Réponds 1 ou 2* (ou "annule")`,
          };
        }
        
        // Check if we have suggestions but no exact match
        if (!searchResult.exactMatch && searchResult.suggestions.length > 0) {
          // Check if the best suggestion has a reasonable score (>= 0.6)
          const bestScore = searchResult.suggestions[0]?.score || 0;
          
          if (bestScore >= 0.6) {
            // Suggestions are relevant - generate a choice poll WITH a "nouveau client" option
            const poll = generateChoicePollWithNewClient(
              searchResult.suggestions,
              clientName,
              "mark_signe",
              entities
            );
            
            return {
              actionTaken: "client_ambiguous",
              newPendingAction: poll.pendingAction,
              customResponse: poll.responseMessage,
            };
          } else {
            // Suggestions are too weak (low match score) - ask if it's a new client
            const pendingAction: PendingAction = {
              intent: "mark_signe",
              entities: { ...entities, is_new_client: true },
              workflowState: "awaiting_new_sale_type",
              collectedData: {
                clientName: clientName,
                isNewClient: true,
                puissanceKwc: entities.puissance_kwc as number || undefined,
                prixTTC: entities.amount as number || undefined,
              },
              createdAt: new Date().toISOString(),
            };
            
            return {
              actionTaken: "needs_new_sale_type",
              entityType: "workflow",
              newPendingAction: pendingAction,
              customResponse: `🆕 Aucun client correspondant à "${clientName}".\n\n*Est-ce une nouvelle vente ?*\n\n1️⃣ Vente *interne* (avec RDV, puissance, prix TTC)\n2️⃣ Vente *externe* (installation tierce, commission uniquement)\n\n👆 *Réponds 1 ou 2* (ou "annule")`,
            };
          }
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
      
      // Check if RDV already has a regie, if not ask for selection
      if (!rdv?.regie_id) {
        const regiePoll = await generateRegiePoll(
          supabase,
          userId,
          "mark_signe",
          entities,
          {
            clientId: matchedClient.id,
            clientName: clientFullName,
            rdvId: rdv?.id,
            puissanceKwc: puissance || undefined,
            prixTTC: amount || undefined,
          }
        );
        
        if (regiePoll.needsSelection) {
          return {
            actionTaken: "needs_regie_selection",
            newPendingAction: regiePoll.pendingAction,
            customResponse: `✍️ *Nouvelle vente pour ${clientFullName}* 🎉\n\n${regiePoll.responseMessage}`,
          };
        }
        
        // If there's a default regie (only one configured), use it
        if (regiePoll.defaultRegieId && rdv) {
          rdv.regie_id = regiePoll.defaultRegieId;
        }
      }
      
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

    case "create_external_vente": {
      // Create an external sale (installation done by third party, only commission)
      const clientName = entities.client_name as string;
      const commission = entities.commission as number || entities.amount as number;
      const datePose = entities.date_pose as string || entities.date as string;
      const isNewClient = entities.is_new_client as boolean;
      
      if (!clientName) {
        return {
          actionTaken: "missing_data",
          customResponse: "❌ Indique-moi le nom du client pour cette vente externe.",
        };
      }
      
      // First, try to find the client
      const searchResult = await findClientByName(supabase, userId, clientName);
      
      // If client not found and user hasn't confirmed new client creation
      if (searchResult.notFound && !isNewClient) {
        // Start workflow to collect data and potentially create new client
        const pendingAction: PendingAction = {
          intent: "create_external_vente",
          entities,
          workflowState: "collecting_external_vente_data",
          collectedData: {
            clientName: clientName,
            isNewClient: true, // Client doesn't exist, will need to create
            commission: commission || undefined,
            datePose: datePose || undefined,
          },
          createdAt: new Date().toISOString(),
        };
        
        let responseMsg = `📦 *Vente externe pour ${clientName}* (nouveau client)\n\n`;
        
        if (!commission) {
          responseMsg += "💰 Quel est le montant de la *commission* (en € HT) ?";
        } else if (!datePose) {
          responseMsg += "📅 Quelle est la *date de pose* ? (ex: 20/01/2026)";
        } else {
          responseMsg += `📝 Récap:\n• Client: ${clientName} (nouveau)\n• Commission: ${commission.toLocaleString("fr-FR")}€ HT\n• Posé le: ${datePose}\n\n*Confirmes-tu ?* (Oui/Non)`;
        }
        
        return {
          actionTaken: "collecting_external_vente_data",
          entityType: "workflow",
          newPendingAction: pendingAction,
          customResponse: responseMsg,
        };
      }
      
      // If client not found with suggestions, offer disambiguation
      if (!searchResult.exactMatch && searchResult.suggestions.length > 0 && !isNewClient) {
        const poll = generateChoicePoll(
          searchResult.suggestions,
          clientName,
          "create_external_vente",
          entities
        );
        
        return {
          actionTaken: "client_ambiguous",
          newPendingAction: poll.pendingAction,
          customResponse: poll.responseMessage,
        };
      }
      
      // Client found or creating new one
      const matchedClient = searchResult.exactMatch || searchResult.clients[0];
      
      // Start the workflow with found/new client
      const pendingAction: PendingAction = {
        intent: "create_external_vente",
        entities,
        workflowState: "collecting_external_vente_data",
        collectedData: {
          clientId: matchedClient?.id,
          clientName: matchedClient?.fullName || clientName,
          isNewClient: isNewClient || false,
          commission: commission || undefined,
          datePose: datePose || undefined,
        },
        createdAt: new Date().toISOString(),
      };
      
      let responseMsg = `📦 *Vente externe pour ${matchedClient?.fullName || clientName}*\n\n`;
      
      if (!commission) {
        responseMsg += "💰 Quel est le montant de la *commission* (en € HT) ?";
      } else if (!datePose) {
        responseMsg += "📅 Quelle est la *date de pose* ? (ex: 20/01/2026)";
      } else {
        responseMsg += `📝 Récap:\n• Client: ${matchedClient?.fullName || clientName}\n• Commission: ${commission.toLocaleString("fr-FR")}€ HT\n• Posé le: ${datePose}\n\n*Confirmes-tu ?* (Oui/Non)`;
      }
      
      return {
        actionTaken: "collecting_external_vente_data",
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
      // ═══════════════════════════════════════════════════════════════════════
      // UTILISE RPC PARTAGÉE : get_commissions_by_category
      // ═══════════════════════════════════════════════════════════════════════
      const { data: commData, error: commError } = await supabase
        .rpc("get_commissions_by_category", { p_user_id: userId });

      if (commError) {
        console.error("RPC get_commissions_by_category error:", commError);
        // Fallback to legacy approach
        const { globalBouquets, regieBouquetsMap } = await loadBouquetsForCommissions(supabase);
        
        const { data: ventes, error: ventesError } = await supabase
          .from("ventes")
          .select(`
            id,
            montant_ttc,
            montant_ht,
            puissance_kwc,
            date_installation_reelle,
            status,
            type_vente,
            decom_montant,
            regie_id,
            regies(part_survente_pct)
          `)
          .eq("user_id", userId)
          .not("status", "eq", "annule");

        if (ventesError) {
          console.error("Error fetching ventes:", ventesError);
          return { actionTaken: "error" };
        }

        let totalEnCours = 0;
        let totalAFacturer = 0;
        let countEnCours = 0;
        let countAFacturer = 0;
        const now = new Date();
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        for (const v of ventes || []) {
          const isExternal = v.type_vente === "external_installation";
          // deno-lint-ignore no-explicit-any
          const regie = v.regies as any;
          const partSurvente = regie?.part_survente_pct || 50;
          
          const { commission } = calculateCommission({
            montantTTC: v.montant_ttc || 0,
            montantHT: v.montant_ht || 0,
            puissanceKwc: v.puissance_kwc || 0,
            isExternal,
            decomMontant: v.decom_montant || 0,
            regieId: v.regie_id,
            globalBouquets,
            regieBouquetsMap,
            partSurventePct: partSurvente,
          });

          if (v.date_installation_reelle) {
            const datePose = new Date(v.date_installation_reelle);
            if (datePose >= twoWeeksAgo) {
              totalEnCours += commission;
              countEnCours++;
            } else {
              totalAFacturer += commission;
              countAFacturer++;
            }
          } else if (["signe", "cq_a_faire", "cq_fait", "attente_financement", "envoi_pose"].includes(v.status)) {
            totalEnCours += commission;
            countEnCours++;
          }
        }

        return {
          actionTaken: "query_commissions_result",
          entityType: "commissions",
          entityId: JSON.stringify({
            en_cours: { count: countEnCours, total: Math.round(totalEnCours) },
            a_facturer: { count: countAFacturer, total: Math.round(totalAFacturer) },
            total: Math.round(totalEnCours + totalAFacturer)
          }),
        };
      }

      // Utilise les données de la RPC
      const responseData = {
        en_cours: { total: Math.round(commData?.en_cours || 0) },
        a_facturer: { total: Math.round(commData?.a_facturer || 0) },
        payees: { total: Math.round(commData?.payees || 0) },
        total: Math.round(commData?.total || 0)
      };

      return {
        actionTaken: "query_commissions_result",
        entityType: "commissions",
        entityId: JSON.stringify(responseData),
      };
    }

    case "query_ventes_a_facturer": {
      // Load bouquets for accurate commission calculation
      const { globalBouquets, regieBouquetsMap } = await loadBouquetsForCommissions(supabase);
      
      // Liste détaillée des ventes prêtes à facturer (posées >= 2 semaines OU attente_paiement)
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      
      const { data: ventes, error: ventesError } = await supabase
        .from("ventes")
        .select(`
          id,
          montant_ttc,
          montant_ht,
          puissance_kwc,
          date_signature,
          date_installation_reelle,
          status,
          type_vente,
          decom_montant,
          regie_id,
          clients(nom, prenom),
          regies(nom, mode_calcul_commission, part_survente_pct)
        `)
        .eq("user_id", userId)
        .not("status", "eq", "annule");

      if (ventesError) {
        console.error("Error fetching ventes:", ventesError);
        return { actionTaken: "error" };
      }

      const ventesAFacturer: Array<{
        clientName: string;
        puissance: number;
        montant: number;
        commission: number;
        datePose: string;
        status: string;
      }> = [];

      let totalCommission = 0;

      for (const v of ventes || []) {
        const isAttenteP = v.status === "attente_paiement";
        const isInstalleLongtemps = v.status === "installe" && v.date_installation_reelle && new Date(v.date_installation_reelle) <= twoWeeksAgo;
        
        if (!isAttenteP && !isInstalleLongtemps) continue;

        const isExternal = v.type_vente === "external_installation";
        // deno-lint-ignore no-explicit-any
        const regie = v.regies as any;
        const partSurvente = regie?.part_survente_pct || 50;
        
        const { commission } = calculateCommission({
          montantTTC: v.montant_ttc || 0,
          montantHT: v.montant_ht || 0,
          puissanceKwc: v.puissance_kwc || 0,
          isExternal,
          decomMontant: v.decom_montant || 0,
          regieId: v.regie_id,
          globalBouquets,
          regieBouquetsMap,
          partSurventePct: partSurvente,
        });

        // deno-lint-ignore no-explicit-any
        const client = v.clients as any;
        const clientName = `${client?.prenom || ""} ${client?.nom || ""}`.trim();
        
        ventesAFacturer.push({
          clientName,
          puissance: v.puissance_kwc || 0,
          montant: v.montant_ttc || 0,
          commission: Math.round(commission),
          datePose: v.date_installation_reelle || "",
          status: v.status
        });
        
        totalCommission += commission;
      }

      ventesAFacturer.sort((a, b) => new Date(a.datePose).getTime() - new Date(b.datePose).getTime());

      let responseMsg = `💰 *DOSSIERS À FACTURER* (${ventesAFacturer.length})\n`;
      responseMsg += `📊 Total: *${Math.round(totalCommission).toLocaleString("fr-FR")}€*\n\n`;
      
      if (ventesAFacturer.length === 0) {
        responseMsg += "_Aucun dossier à facturer pour le moment._";
      } else {
        const MAX_ITEMS_PER_MESSAGE = 30;
        const totalItems = ventesAFacturer.length;
        
        for (let i = 0; i < totalItems; i++) {
          const v = ventesAFacturer[i];
          const statusIcon = v.status === "attente_paiement" ? "💳" : "✅";
          const datePoseStr = v.datePose ? new Date(v.datePose).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "";
          responseMsg += `${statusIcon} *${v.clientName}*\n`;
          responseMsg += `   ${v.puissance}kWc | ${v.montant.toLocaleString("fr-FR")}€ TTC\n`;
          responseMsg += `   → Commission: *${v.commission.toLocaleString("fr-FR")}€*${datePoseStr ? ` (posé ${datePoseStr})` : ""}\n\n`;
          
          if (totalItems > MAX_ITEMS_PER_MESSAGE && (i + 1) % MAX_ITEMS_PER_MESSAGE === 0 && i < totalItems - 1) {
            responseMsg += `\n📄 [${Math.floor(i / MAX_ITEMS_PER_MESSAGE) + 1}/${Math.ceil(totalItems / MAX_ITEMS_PER_MESSAGE)}] Suite...\n\n`;
          }
        }
      }

      return {
        actionTaken: "query_ventes_a_facturer_result",
        entityType: "ventes_a_facturer",
        customResponse: responseMsg,
      };
    }

    case "query_ventes_en_cours": {
      // Load bouquets for accurate commission calculation
      const { globalBouquets, regieBouquetsMap } = await loadBouquetsForCommissions(supabase);
      
      // Liste détaillée des ventes en cours (signées mais pas encore posées)
      const enCoursStatuses = ["signe", "cq_a_faire", "cq_fait", "attente_financement", "envoi_pose"];
      
      const { data: ventes, error: ventesError } = await supabase
        .from("ventes")
        .select(`
          id,
          montant_ttc,
          montant_ht,
          puissance_kwc,
          date_signature,
          status,
          type_vente,
          decom_montant,
          regie_id,
          clients(nom, prenom),
          regies(nom, mode_calcul_commission, part_survente_pct)
        `)
        .eq("user_id", userId)
        .in("status", enCoursStatuses);

      if (ventesError) {
        console.error("Error fetching ventes:", ventesError);
        return { actionTaken: "error" };
      }

      const ventesEnCours: Array<{
        clientName: string;
        puissance: number;
        montant: number;
        commission: number;
        dateSignature: string;
        status: string;
      }> = [];

      let totalCommission = 0;

      for (const v of ventes || []) {
        const isExternal = v.type_vente === "external_installation";
        // deno-lint-ignore no-explicit-any
        const regie = v.regies as any;
        const partSurvente = regie?.part_survente_pct || 50;
        
        const { commission } = calculateCommission({
          montantTTC: v.montant_ttc || 0,
          montantHT: v.montant_ht || 0,
          puissanceKwc: v.puissance_kwc || 0,
          isExternal,
          decomMontant: v.decom_montant || 0,
          regieId: v.regie_id,
          globalBouquets,
          regieBouquetsMap,
          partSurventePct: partSurvente,
        });

        // deno-lint-ignore no-explicit-any
        const client = v.clients as any;
        const clientName = `${client?.prenom || ""} ${client?.nom || ""}`.trim();
        
        const statusLabels: Record<string, string> = {
          signe: "Signé",
          cq_a_faire: "CQ à faire",
          cq_fait: "CQ fait",
          attente_financement: "Att. fin.",
          envoi_pose: "Envoi pose"
        };
        
        ventesEnCours.push({
          clientName,
          puissance: v.puissance_kwc || 0,
          montant: v.montant_ttc || 0,
          commission: Math.round(commission),
          dateSignature: v.date_signature || "",
          status: statusLabels[v.status] || v.status
        });
        
        totalCommission += commission;
      }

      ventesEnCours.sort((a, b) => new Date(a.dateSignature).getTime() - new Date(b.dateSignature).getTime());

      let responseMsg = `📋 *DOSSIERS EN COURS* (${ventesEnCours.length})\n`;
      responseMsg += `💰 Potentiel: *${Math.round(totalCommission).toLocaleString("fr-FR")}€*\n\n`;
      
      if (ventesEnCours.length === 0) {
        responseMsg += "_Aucun dossier en cours actuellement._";
      } else {
        const MAX_ITEMS_PER_MESSAGE = 30;
        const totalItems = ventesEnCours.length;
        
        for (let i = 0; i < totalItems; i++) {
          const v = ventesEnCours[i];
          const dateStr = v.dateSignature ? new Date(v.dateSignature).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "";
          responseMsg += `📝 *${v.clientName}*\n`;
          responseMsg += `   ${v.puissance}kWc | ${v.montant.toLocaleString("fr-FR")}€ TTC | ${v.status}\n`;
          responseMsg += `   → Commission: *${v.commission.toLocaleString("fr-FR")}€*${dateStr ? ` (signé ${dateStr})` : ""}\n\n`;
          
          if (totalItems > MAX_ITEMS_PER_MESSAGE && (i + 1) % MAX_ITEMS_PER_MESSAGE === 0 && i < totalItems - 1) {
            responseMsg += `\n📄 [${Math.floor(i / MAX_ITEMS_PER_MESSAGE) + 1}/${Math.ceil(totalItems / MAX_ITEMS_PER_MESSAGE)}] Suite...\n\n`;
          }
        }
      }

      return {
        actionTaken: "query_ventes_en_cours_result",
        entityType: "ventes_en_cours",
        customResponse: responseMsg,
      };
    }

    case "query_ventes_by_filter": {
      // Load bouquets for accurate commission calculation
      const { globalBouquets, regieBouquetsMap } = await loadBouquetsForCommissions(supabase);
      
      const filterType = (entities.filter_type as string) || "poses";
      const regieName = entities.regie_name as string;
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      
      let statusFilter: string[] = [];
      let filterLabel = "";
      
      switch (filterType) {
        case "poses":
        case "installe":
          statusFilter = ["installe", "attente_paiement"];
          filterLabel = "Posées";
          break;
        case "payees":
        case "paye":
          statusFilter = ["paye"];
          filterLabel = "Payées";
          break;
        case "signees":
        case "signe":
          statusFilter = ["signe", "cq_a_faire", "cq_fait", "attente_financement", "envoi_pose", "en_installation", "installe", "attente_paiement", "paye"];
          filterLabel = "Signées (toutes)";
          break;
        case "poses_recentes":
          statusFilter = ["installe"];
          filterLabel = "Posées < 2 sem";
          break;
        case "en_cours":
          statusFilter = ["signe", "cq_a_faire", "cq_fait", "attente_financement", "envoi_pose"];
          filterLabel = "En cours";
          break;
        case "a_facturer":
          statusFilter = ["installe", "attente_paiement"];
          filterLabel = "À facturer";
          break;
        default:
          statusFilter = ["installe", "attente_paiement", "paye"];
          filterLabel = filterType;
      }

      const { data: ventes, error: ventesError } = await supabase
        .from("ventes")
        .select(`
          id,
          montant_ttc,
          montant_ht,
          puissance_kwc,
          date_signature,
          date_installation_reelle,
          status,
          type_vente,
          decom_montant,
          regie_id,
          clients(nom, prenom),
          regies(nom, mode_calcul_commission, part_survente_pct)
        `)
        .eq("user_id", userId)
        .in("status", statusFilter);

      if (ventesError) {
        console.error("Error fetching ventes:", ventesError);
        return { actionTaken: "error" };
      }

      // deno-lint-ignore no-explicit-any
      let filteredVentes: any[] = ventes || [];
      
      if (filterType === "poses_recentes") {
        // deno-lint-ignore no-explicit-any
        filteredVentes = filteredVentes.filter((v: any) => 
          v.date_installation_reelle && new Date(v.date_installation_reelle) > twoWeeksAgo
        );
      } else if (filterType === "a_facturer") {
        // deno-lint-ignore no-explicit-any
        filteredVentes = filteredVentes.filter((v: any) => 
          v.status === "attente_paiement" || 
          (v.status === "installe" && v.date_installation_reelle && new Date(v.date_installation_reelle) <= twoWeeksAgo)
        );
      }
      
      if (regieName) {
        const regieNameLower = regieName.toLowerCase();
        // deno-lint-ignore no-explicit-any
        filteredVentes = filteredVentes.filter((v: any) => {
          // deno-lint-ignore no-explicit-any
          const regie = v.regies as any;
          return regie?.nom?.toLowerCase().includes(regieNameLower);
        });
        filterLabel += ` (${regieName})`;
      }

      const results: Array<{
        clientName: string;
        puissance: number;
        montant: number;
        commission: number;
        date: string;
        status: string;
      }> = [];

      let totalCommission = 0;

      for (const v of filteredVentes) {
        const isExternal = v.type_vente === "external_installation";
        // deno-lint-ignore no-explicit-any
        const regie = v.regies as any;
        const partSurvente = regie?.part_survente_pct || 50;
        
        const { commission } = calculateCommission({
          montantTTC: v.montant_ttc || 0,
          montantHT: v.montant_ht || 0,
          puissanceKwc: v.puissance_kwc || 0,
          isExternal,
          decomMontant: v.decom_montant || 0,
          regieId: v.regie_id,
          globalBouquets,
          regieBouquetsMap,
          partSurventePct: partSurvente,
        });

        // deno-lint-ignore no-explicit-any
        const client = v.clients as any;
        const clientName = `${client?.prenom || ""} ${client?.nom || ""}`.trim();
        
        const statusLabels: Record<string, string> = {
          signe: "📝 Signé",
          cq_a_faire: "🔴 CQ",
          cq_fait: "🟡 CQ fait",
          attente_financement: "🟡 Att. fin.",
          envoi_pose: "🔵 Envoi",
          en_installation: "🔵 Install.",
          installe: "✅ Posé",
          attente_paiement: "💳 Att. paie.",
          paye: "💰 Payé"
        };
        
        results.push({
          clientName,
          puissance: v.puissance_kwc || 0,
          montant: v.montant_ttc || 0,
          commission: Math.round(commission),
          date: v.date_installation_reelle || v.date_signature || "",
          status: statusLabels[v.status] || v.status
        });
        
        totalCommission += commission;
      }

      results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      let responseMsg = `📊 *${filterLabel.toUpperCase()}* (${results.length})\n`;
      responseMsg += `💰 Total commissions: *${Math.round(totalCommission).toLocaleString("fr-FR")}€*\n\n`;
      
      if (results.length === 0) {
        responseMsg += "_Aucun dossier trouvé avec ce filtre._";
      } else {
        const MAX_ITEMS_PER_MESSAGE = 30;
        const totalItems = results.length;
        
        for (let i = 0; i < totalItems; i++) {
          const v = results[i];
          const dateStr = v.date ? new Date(v.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "";
          responseMsg += `${v.status} *${v.clientName}*\n`;
          responseMsg += `   ${v.puissance}kWc | ${v.montant.toLocaleString("fr-FR")}€ → *${v.commission.toLocaleString("fr-FR")}€*${dateStr ? ` (${dateStr})` : ""}\n\n`;
          
          if (totalItems > MAX_ITEMS_PER_MESSAGE && (i + 1) % MAX_ITEMS_PER_MESSAGE === 0 && i < totalItems - 1) {
            responseMsg += `\n📄 [${Math.floor(i / MAX_ITEMS_PER_MESSAGE) + 1}/${Math.ceil(totalItems / MAX_ITEMS_PER_MESSAGE)}] Suite...\n\n`;
          }
        }
      }

      return {
        actionTaken: "query_ventes_by_filter_result",
        entityType: "ventes_filtered",
        customResponse: responseMsg,
      };
    }

    case "query_stats": {
      const period = (entities.period as string) || "month";
      const now = new Date();
      let startDate: Date;
      const endDate: Date = now;
      
      switch (period) {
        case "today":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week": {
          // Start of current week (Monday)
          const dayOfWeek = now.getDay();
          const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
          startDate = new Date(now);
          startDate.setDate(now.getDate() - diff);
          startDate.setHours(0, 0, 0, 0);
          break;
        }
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case "all":
          startDate = new Date(2020, 0, 1);
          break;
        default: // month
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      // ═══════════════════════════════════════════════════════════════════════
      // UTILISE RPC PARTAGÉE : get_monthly_stats
      // ═══════════════════════════════════════════════════════════════════════
      const { data: statsData, error: statsError } = await supabase
        .rpc("get_monthly_stats", {
          p_user_id: userId,
          p_start_date: startDateStr,
          p_end_date: endDateStr,
        });

      if (statsError) {
        console.error("RPC get_monthly_stats error:", statsError);
        // Fallback to legacy query
        const { count: rdvCount } = await supabase
          .from("rdv")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("date_heure", startDate.toISOString())
          .lte("date_heure", endDate.toISOString());

        const { data: ventesData } = await supabase
          .from("ventes")
          .select("id, montant_ht, montant_ttc, status, type_vente, date_signature")
          .eq("user_id", userId)
          .neq("status", "annule")
          .gte("date_signature", startDateStr)
          .lte("date_signature", endDateStr);

        // deno-lint-ignore no-explicit-any
        const ventesStandard = ventesData?.filter((v: any) => v.type_vente !== "external_installation") || [];
        const ventesCount = ventesStandard.length;
        // deno-lint-ignore no-explicit-any
        const caTTC = ventesStandard.reduce((sum: number, v: any) => sum + (v.montant_ttc || 0), 0);
        // deno-lint-ignore no-explicit-any
        const caHT = ventesStandard.reduce((sum: number, v: any) => sum + (v.montant_ht || 0), 0);

        const tauxConversion = rdvCount && rdvCount > 0 ? Math.round((ventesCount / rdvCount) * 100) : 0;

        const periodLabel = period === "today" ? "aujourd'hui" : 
                           period === "week" ? "cette semaine" : 
                           period === "year" ? "cette année" :
                           period === "all" ? "depuis le début" : "ce mois";

        return {
          actionTaken: "query_stats_result",
          entityType: "stats",
          entityId: JSON.stringify({
            period: periodLabel,
            rdv: rdvCount || 0,
            ventes: ventesCount,
            ventesEnCours: 0,
            caTTC: Math.round(caTTC),
            caHT: Math.round(caHT),
            taux_conversion: tauxConversion
          }),
        };
      }

      const periodLabel = period === "today" ? "aujourd'hui" : 
                         period === "week" ? "cette semaine" : 
                         period === "year" ? "cette année" :
                         period === "all" ? "depuis le début" : "ce mois";

      const responseData = {
        period: periodLabel,
        rdv: statsData?.rdv_total || 0,
        ventes: statsData?.ventes_signees || 0,
        ventesEnCours: statsData?.ventes_en_cours || 0,
        caTTC: Math.round(statsData?.ca_ttc || 0),
        caHT: Math.round(statsData?.ca_ht || 0),
        taux_conversion: statsData?.taux_conversion || 0,
        commissions: Math.round(statsData?.commissions_total || 0)
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
        // Generate a choice poll for the user to select the right client
        const poll = generateChoicePoll(
          searchResult.suggestions,
          clientName,
          "query_client_info",
          entities
        );
        
        return {
          actionTaken: "client_ambiguous",
          newPendingAction: poll.pendingAction,
          customResponse: poll.responseMessage,
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

      // Check if user explicitly wants cancelled/postponed RDV
      const includeCancelled = entities.include_cancelled === true;
      
      let rdvQuery = supabase
        .from("rdv")
        .select(`
          id,
          date_heure,
          adresse,
          status,
          type_rdv,
          clients(nom, prenom, telephone)
        `)
        .eq("user_id", userId);
      
      // Par défaut exclure annulés/reportés, sauf si demandé explicitement
      if (includeCancelled) {
        // Si on demande les annulés, filtrer UNIQUEMENT sur annule/reporte
        rdvQuery = rdvQuery.in("status", ["annule", "reporte"]);
      } else {
        // Par défaut, exclure annulés et reportés
        rdvQuery = rdvQuery.not("status", "in", "(annule,reporte)");
      }
      
      const { data: rdvs, error } = await rdvQuery
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
        // Generate a choice poll for the user to select the right client
        const poll = generateChoicePoll(
          searchResult.suggestions,
          clientName,
          "query_rdv_detail",
          entities
        );
        
        return {
          actionTaken: "client_ambiguous",
          newPendingAction: poll.pendingAction,
          customResponse: poll.responseMessage,
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
      
      // Check if user explicitly wants cancelled sales
      const includeCancelled = entities.include_cancelled === true;
      
      let query = supabase
        .from("ventes")
        .select(`
          id,
          montant_ttc,
          montant_ht,
          puissance_kwc,
          status,
          date_signature,
          date_installation_reelle,
          clients(nom, prenom)
        `)
        .eq("user_id", userId);
      
      // Par défaut exclure annulées, sauf si demandé explicitement
      if (includeCancelled) {
        // Si on demande les annulées, filtrer UNIQUEMENT sur annule
        query = query.eq("status", "annule");
      } else {
        // Par défaut, exclure les annulées
        query = query.not("status", "eq", "annule");
      }
      
      query = query.order("created_at", { ascending: false }).limit(50);

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
          installe: !!v.date_installation_reelle
        };
      });

      return {
        actionTaken: "query_ventes_result",
        entityType: "ventes",
        entityId: JSON.stringify({ count: responseData.length, ventes: responseData }),
      };
    }

    case "query_vente_detail": {
      // Get detailed info about a specific sale by client name
      const clientName = entities.client_name as string;
      // Detect what specific info is being asked (from extracted entities or original query)
      const queryField = entities.query_field as string || null;
      
      if (!clientName) {
        return {
          actionTaken: "missing_data",
          customResponse: "❌ Indique-moi le nom du client pour voir sa vente.",
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
        // Generate a choice poll for the user to select the right client
        const poll = generateChoicePoll(
          searchResult.suggestions,
          clientName,
          "query_vente_detail",
          entities
        );
        
        return {
          actionTaken: "client_ambiguous",
          newPendingAction: poll.pendingAction,
          customResponse: poll.responseMessage,
        };
      }

      const matchedClient = searchResult.exactMatch || searchResult.clients[0];
      
      console.log(`[query_vente_detail] Looking for vente with client_id: ${matchedClient.id}, user_id: ${userId}, queryField: ${queryField}`);
      
      // Find the vente for this client with all details
      // Available columns: id, user_id, client_id, etude_id, numero_contrat, date_signature, 
      // date_installation_prevue, date_installation_reelle, date_paiement, montant_ht, montant_ttc,
      // montant_acompte, montant_solde, puissance_kwc, nombre_panneaux, type_installation, 
      // status, notes, created_at, updated_at, decom_montant, decom_raison, type_vente, regie_id, is_retape
      const { data: ventes, error: venteError } = await supabase
        .from("ventes")
        .select(`
          id,
          status,
          montant_ttc,
          montant_ht,
          puissance_kwc,
          nombre_panneaux,
          date_signature,
          date_installation_prevue,
          date_installation_reelle,
          date_paiement,
          notes,
          type_installation,
          type_vente,
          decom_montant,
          is_retape,
          created_at,
          regie_id,
          clients(id, nom, prenom, adresse, ville, code_postal, telephone),
          regies(nom, couleur, part_survente_pct)
        `)
        .eq("user_id", userId)
        .eq("client_id", matchedClient.id)
        .order("created_at", { ascending: false })
        .limit(1);
      
      console.log(`[query_vente_detail] Query result: ${ventes?.length || 0} ventes found, error: ${venteError?.message || 'none'}`);
      
      if (venteError || !ventes || ventes.length === 0) {
        console.error(`[query_vente_detail] No vente found for client ${matchedClient.id}. Error: ${JSON.stringify(venteError)}`);
        return {
          actionTaken: "vente_not_found",
          customResponse: `❌ Aucune vente trouvée pour "${matchedClient.fullName}".`,
        };
      }
      
      const vente = ventes[0];
      // deno-lint-ignore no-explicit-any
      const client = vente.clients as any;
      // deno-lint-ignore no-explicit-any
      const regie = vente.regies as any;
      const clientFullName = `${client?.prenom || ""} ${client?.nom || ""}`.trim();
      
      // Status labels
      const statusLabels: Record<string, string> = {
        cq_a_faire: "🔴 CQ à faire",
        cq_fait: "🟡 CQ fait",
        attente_financement: "🟡 Attente financement",
        envoi_pose: "🔵 Envoi pose",
        en_installation: "🔵 En installation",
        installe: "✅ Posé",
        attente_paiement: "💳 Attente paiement",
        paye: "💰 Payé",
        annule: "❌ Annulé",
      };
      
      // TARGETED RESPONSE: Check if a specific field was requested
      // Common query patterns: commission, statut, prix, puissance, date, adresse, téléphone
      if (queryField) {
        const field = queryField.toLowerCase();
        
        // Commission query - uses RPC for centralized logic
        if (field.includes("commission") || field.includes("comm")) {
          // Use RPC for accurate commission calculation (centralized logic)
          const commResult = await getCommissionViaRPC(supabase, vente.id);
          
          const isExternal = vente.type_vente === "external_installation";
          
          let detailMsg = `💰 *Commission ${clientFullName}:*\n`;
          detailMsg += `• Montant: *${Math.round(commResult.commission).toLocaleString("fr-FR")}€*\n`;
          if (!isExternal && commResult.commissionBase > 0) {
            detailMsg += `• Base fixe: ${Math.round(commResult.commissionBase).toLocaleString("fr-FR")}€\n`;
            if (commResult.bonusSurvente > 0) {
              detailMsg += `• Survente: +${Math.round(commResult.bonusSurvente).toLocaleString("fr-FR")}€\n`;
            }
          }
          if (commResult.decomMontant > 0) {
            detailMsg += `• Décom: -${Math.round(commResult.decomMontant).toLocaleString("fr-FR")}€\n`;
          }
          detailMsg += `• Vente: ${(vente.montant_ttc || 0).toLocaleString("fr-FR")}€ TTC / ${vente.puissance_kwc || 0} kWc\n`;
          detailMsg += `• Statut: ${statusLabels[vente.status] || vente.status}`;
          
          return {
            actionTaken: "query_vente_detail",
            entityId: vente.id,
            customResponse: detailMsg,
          };
        }
        
        // Status query
        if (field.includes("statut") || field.includes("status") || field.includes("état") || field.includes("avancement")) {
          return {
            actionTaken: "query_vente_detail",
            entityId: vente.id,
            customResponse: `📊 *Statut ${clientFullName}:* ${statusLabels[vente.status] || vente.status}`,
          };
        }
        
        // Price query
        if (field.includes("prix") || field.includes("montant") || field.includes("ttc") || field.includes("ht")) {
          return {
            actionTaken: "query_vente_detail",
            entityId: vente.id,
            customResponse: `💶 *Prix ${clientFullName}:*\n` +
              `• TTC: ${(vente.montant_ttc || 0).toLocaleString("fr-FR")}€\n` +
              `• HT: ${(vente.montant_ht || 0).toLocaleString("fr-FR")}€`,
          };
        }
        
        // Power/panels query
        if (field.includes("puissance") || field.includes("kwc") || field.includes("panneau")) {
          return {
            actionTaken: "query_vente_detail",
            entityId: vente.id,
            customResponse: `⚡ *Installation ${clientFullName}:*\n` +
              `• Puissance: ${vente.puissance_kwc || 0} kWc\n` +
              `• Panneaux: ${vente.nombre_panneaux || 0}`,
          };
        }
        
        // Date query
        if (field.includes("date") || field.includes("quand") || field.includes("pose") || field.includes("installation")) {
          const dates: string[] = [];
          if (vente.date_signature) dates.push(`• Signature: ${new Date(vente.date_signature).toLocaleDateString("fr-FR")}`);
          if (vente.date_installation_prevue) dates.push(`• Pose prévue: ${new Date(vente.date_installation_prevue).toLocaleDateString("fr-FR")}`);
          if (vente.date_installation_reelle) {
            dates.push(`• Posé le: ${new Date(vente.date_installation_reelle).toLocaleDateString("fr-FR")}`);
          }
          if (vente.date_paiement) dates.push(`• Paiement: ${new Date(vente.date_paiement).toLocaleDateString("fr-FR")}`);
          
          return {
            actionTaken: "query_vente_detail",
            entityId: vente.id,
            customResponse: `📅 *Dates ${clientFullName}:*\n${dates.length > 0 ? dates.join("\n") : "Aucune date renseignée"}`,
          };
        }
        
        // Address query
        if (field.includes("adresse") || field.includes("où") || field.includes("lieu")) {
          const addr = [client?.adresse, client?.code_postal, client?.ville].filter(Boolean).join(", ");
          return {
            actionTaken: "query_vente_detail",
            entityId: vente.id,
            customResponse: `📍 *Adresse ${clientFullName}:* ${addr || "Non renseignée"}`,
          };
        }
        
        // Phone query
        if (field.includes("tel") || field.includes("téléphone") || field.includes("numero") || field.includes("numéro") || field.includes("appeler")) {
          return {
            actionTaken: "query_vente_detail",
            entityId: vente.id,
            customResponse: `📞 *Téléphone ${clientFullName}:* ${client?.telephone || "Non renseigné"}`,
          };
        }
        
        // Regie query
        if (field.includes("regie") || field.includes("régie")) {
          return {
            actionTaken: "query_vente_detail",
            entityId: vente.id,
            customResponse: `🏢 *Régie ${clientFullName}:* ${regie?.nom || "Non attribuée"}`,
          };
        }
      }
      
      // DEFAULT: Full detail response (when no specific field requested)
      // Build response sections
      const sections: string[] = [];
      sections.push(`📋 *VENTE - ${clientFullName}*`);
      sections.push("");
      
      // Status & Regie
      sections.push(`📊 *Statut:* ${statusLabels[vente.status] || vente.status}`);
      if (regie?.nom) sections.push(`🏢 *Régie:* ${regie.nom}`);
      if (vente.is_retape) sections.push("♻️ Retape");
      if (vente.type_vente === "external") sections.push("📦 Installation externe");
      sections.push("");
      
      // Financial
      sections.push("💰 *Financier:*");
      if (vente.montant_ttc) sections.push(`• TTC: ${vente.montant_ttc.toLocaleString("fr-FR")}€`);
      if (vente.montant_ht) sections.push(`• HT: ${vente.montant_ht.toLocaleString("fr-FR")}€`);
      if (vente.decom_montant) sections.push(`• Décom: ${vente.decom_montant.toLocaleString("fr-FR")}€`);
      sections.push("");
      
      // Technical
      sections.push("⚡ *Technique:*");
      if (vente.puissance_kwc) sections.push(`• Puissance: ${vente.puissance_kwc} kWc`);
      if (vente.nombre_panneaux) sections.push(`• Panneaux: ${vente.nombre_panneaux}`);
      if (vente.type_installation) sections.push(`• Type: ${vente.type_installation}`);
      sections.push("");
      
      // Dates
      sections.push("📅 *Dates:*");
      if (vente.date_signature) sections.push(`• Signature: ${new Date(vente.date_signature).toLocaleDateString("fr-FR")}`);
      if (vente.date_installation_prevue) sections.push(`• Pose prévue: ${new Date(vente.date_installation_prevue).toLocaleDateString("fr-FR")}`);
      if (vente.date_installation_reelle) {
        sections.push(`• Posé le: ${new Date(vente.date_installation_reelle).toLocaleDateString("fr-FR")}`);
      }
      if (vente.date_paiement) sections.push(`• Paiement: ${new Date(vente.date_paiement).toLocaleDateString("fr-FR")}`);
      sections.push("");
      
      // Notes
      if (vente.notes) {
        sections.push(`💬 *Notes:*\n${vente.notes}`);
        sections.push("");
      }
      
      // Client info
      sections.push("👤 *Client:*");
      if (client?.telephone) sections.push(`• Tél: ${client.telephone}`);
      if (client?.adresse) {
        const addr = [client.adresse, client.code_postal, client.ville].filter(Boolean).join(", ");
        sections.push(`• Adresse: ${addr}`);
      }
      
      sections.push("");
      sections.push("_💡 Tu peux modifier: prix, puissance, date pose, notes_");
      
      return {
        actionTaken: "query_vente_detail_result",
        entityType: "vente_detail",
        entityId: vente.id,
        customResponse: sections.join("\n"),
      };
    }

    case "update_vente_data": {
      // Update specific fields of a vente (not just pipeline status)
      // Available columns: montant_ttc, montant_ht, puissance_kwc, nombre_panneaux, 
      // date_installation_prevue, date_installation_reelle, notes, type_installation
      const clientName = entities.client_name as string;
      const newAmount = entities.amount as number;
      const newPuissance = entities.puissance_kwc as number;
      const newNotes = entities.commentaire as string; // "commentaire" in entities maps to "notes" in DB
      const newDate = entities.date as string;
      
      if (!clientName) {
        return {
          actionTaken: "missing_data",
          customResponse: "❌ Indique-moi le nom du client pour modifier sa vente.",
        };
      }
      
      // Check if at least one field to update
      if (!newAmount && !newPuissance && !newNotes && !newDate) {
        return {
          actionTaken: "missing_data",
          customResponse: "❌ Que veux-tu modifier ? (prix, puissance, date pose, notes)",
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
        // Generate a choice poll for the user to select the right client
        const poll = generateChoicePoll(
          searchResult.suggestions,
          clientName,
          "update_vente_data",
          entities
        );
        
        return {
          actionTaken: "client_ambiguous",
          newPendingAction: poll.pendingAction,
          customResponse: poll.responseMessage,
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
          montant_ht,
          puissance_kwc,
          nombre_panneaux,
          date_installation_prevue,
          date_installation_reelle,
          notes,
          clients(id, nom, prenom)
        `)
        .eq("user_id", userId)
        .eq("client_id", matchedClient.id)
        .not("status", "eq", "annule")
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (venteError || !ventes || ventes.length === 0) {
        return {
          actionTaken: "vente_not_found",
          customResponse: `❌ Aucune vente active trouvée pour "${matchedClient.fullName}".`,
        };
      }
      
      const vente = ventes[0];
      // deno-lint-ignore no-explicit-any
      const client = vente.clients as any;
      const clientFullName = `${client?.prenom || ""} ${client?.nom || ""}`.trim();
      
      // Get previous data for undo
      const previousVenteData = await getPreviousData(supabase, "ventes", vente.id, userId);
      
      // Build update data
      // deno-lint-ignore no-explicit-any
      const updateData: any = {};
      const changes: string[] = [];
      
      if (newAmount) {
        updateData.montant_ttc = newAmount;
        // Approximate HT (20% TVA)
        updateData.montant_ht = Math.round(newAmount / 1.2);
        changes.push(`Prix: ${newAmount.toLocaleString("fr-FR")}€`);
      }
      
      if (newPuissance) {
        updateData.puissance_kwc = newPuissance;
        updateData.nombre_panneaux = Math.round(newPuissance * 2); // 2 panneaux par kWc
        changes.push(`Puissance: ${newPuissance}kWc`);
      }
      
      if (newNotes) {
        // Append to existing notes or replace
        const existingNotes = vente.notes || "";
        updateData.notes = existingNotes 
          ? `${existingNotes}\n---\n${newNotes}` 
          : newNotes;
        changes.push("Notes ajoutées");
      }
      
      if (newDate) {
        updateData.date_installation_prevue = newDate;
        changes.push(`Date pose: ${new Date(newDate).toLocaleDateString("fr-FR")}`);
      }
      
      // Update vente
      const { error: updateError } = await supabase
        .from("ventes")
        .update(updateData)
        .eq("id", vente.id);
      
      if (updateError) {
        console.error("Error updating vente data:", updateError);
        return { actionTaken: "error" };
      }
      
      // Log the action
      await logAgentAction(
        supabase,
        userId,
        messageId,
        "update_vente_data",
        "ventes",
        vente.id,
        updateData,
        previousVenteData,
        `Modification vente ${clientFullName}: ${changes.join(", ")}`
      );
      
      return {
        actionTaken: "vente_data_updated",
        entityId: vente.id,
        entityType: "vente",
        customResponse: `✅ Vente *${clientFullName}* mise à jour:\n${changes.map(c => `• ${c}`).join("\n")}`,
      };
    }

    case "query_frais": {
      // Liste des frais avec filtres (période, catégorie)
      const period = (entities.period as string) || "month";
      const categorie = entities.frais_categorie as string;
      
      const now = new Date();
      let startDate: Date;
      let endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      
      let periodLabel = "";
      
      switch (period) {
        case "today":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          periodLabel = "Aujourd'hui";
          break;
        case "week":
          // Start from Monday of current week
          const dayOfWeek = now.getDay();
          const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          startDate = new Date(now);
          startDate.setDate(now.getDate() - diffToMonday);
          startDate.setHours(0, 0, 0, 0);
          periodLabel = "Cette semaine";
          break;
        case "all":
          startDate = new Date(2020, 0, 1);
          periodLabel = "Tout temps";
          break;
        default: // month
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          periodLabel = "Ce mois";
      }
      
      let query = supabase
        .from("frais")
        .select("id, montant, categorie, description, date_frais, justificatif_url")
        .eq("user_id", userId)
        .gte("date_frais", startDate.toISOString().split("T")[0])
        .lte("date_frais", endDate.toISOString().split("T")[0])
        .order("date_frais", { ascending: false })
        .limit(50);
      
      if (categorie) {
        query = query.eq("categorie", categorie);
      }
      
      const { data: fraisData, error: fraisError } = await query;
      
      if (fraisError) {
        console.error("Error fetching frais:", fraisError);
        return { actionTaken: "error" };
      }
      
      const categoryLabels: Record<string, string> = {
        carburant: "⛽ Carburant",
        repas: "🍽️ Repas",
        hotel: "🏨 Hôtel",
        peage: "🛣️ Péage",
        parking: "🅿️ Parking",
        train: "🚂 Train",
        location_vehicule: "🚗 Location",
        autre: "📦 Autre",
      };
      
      // Calculate totals
      const total = (fraisData || []).reduce((sum: number, f: { montant: number | null }) => sum + (f.montant || 0), 0);
      
      // Group by category for summary
      const byCategory: Record<string, { count: number; total: number }> = {};
      for (const f of fraisData || []) {
        const cat = f.categorie;
        if (!byCategory[cat]) byCategory[cat] = { count: 0, total: 0 };
        byCategory[cat].count++;
        byCategory[cat].total += f.montant || 0;
      }
      
      // Build response
      let responseMsg = `💰 *FRAIS - ${periodLabel}*${categorie ? ` (${categoryLabels[categorie] || categorie})` : ""}\n`;
      responseMsg += `Total: *${total.toFixed(2)}€* (${fraisData?.length || 0} dépenses)\n\n`;
      
      if (!fraisData || fraisData.length === 0) {
        responseMsg += "_Aucun frais enregistré sur cette période._";
      } else {
        // Show category summary first
        const catSummary = Object.entries(byCategory)
          .sort((a, b) => b[1].total - a[1].total)
          .map(([cat, data]) => `${categoryLabels[cat] || cat}: ${data.total.toFixed(2)}€`)
          .join(" | ");
        responseMsg += `📊 ${catSummary}\n\n`;
        
        // Show recent items
        responseMsg += "📝 *Dernières dépenses:*\n";
        for (const f of (fraisData || []).slice(0, 10)) {
          const date = new Date(f.date_frais).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
          const catLabel = categoryLabels[f.categorie] || f.categorie;
          const desc = f.description ? ` - ${f.description.substring(0, 30)}` : "";
          responseMsg += `• ${date} ${catLabel}: *${f.montant?.toFixed(2)}€*${desc}\n`;
        }
        
        if ((fraisData?.length || 0) > 10) {
          responseMsg += `\n... et ${(fraisData?.length || 0) - 10} autre(s)`;
        }
      }
      
      return {
        actionTaken: "query_frais_result",
        entityType: "frais",
        customResponse: responseMsg,
      };
    }

    case "query_frais_detail": {
      // Total des frais avec répartition détaillée par catégorie
      const period = (entities.period as string) || "month";
      
      const now = new Date();
      let startDate: Date;
      let endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      
      let periodLabel = "";
      
      switch (period) {
        case "today":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          periodLabel = "Aujourd'hui";
          break;
        case "week":
          const dayOfWeek = now.getDay();
          const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          startDate = new Date(now);
          startDate.setDate(now.getDate() - diffToMonday);
          startDate.setHours(0, 0, 0, 0);
          periodLabel = "Cette semaine";
          break;
        case "all":
          startDate = new Date(2020, 0, 1);
          periodLabel = "Tout temps";
          break;
        default: // month
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          periodLabel = "Ce mois";
      }
      
      const { data: fraisData, error: fraisError } = await supabase
        .from("frais")
        .select("montant, categorie")
        .eq("user_id", userId)
        .gte("date_frais", startDate.toISOString().split("T")[0])
        .lte("date_frais", endDate.toISOString().split("T")[0]);
      
      if (fraisError) {
        console.error("Error fetching frais:", fraisError);
        return { actionTaken: "error" };
      }
      
      const categoryLabels: Record<string, string> = {
        carburant: "⛽ Carburant",
        repas: "🍽️ Repas",
        hotel: "🏨 Hôtel",
        peage: "🛣️ Péage",
        parking: "🅿️ Parking",
        train: "🚂 Train",
        location_vehicule: "🚗 Location",
        autre: "📦 Autre",
      };
      
      // Aggregate by category
      const byCategory: Record<string, { count: number; total: number }> = {};
      let grandTotal = 0;
      
      for (const f of fraisData || []) {
        const cat = f.categorie;
        if (!byCategory[cat]) byCategory[cat] = { count: 0, total: 0 };
        byCategory[cat].count++;
        byCategory[cat].total += f.montant || 0;
        grandTotal += f.montant || 0;
      }
      
      // Build response
      let responseMsg = `📊 *RÉPARTITION FRAIS - ${periodLabel}*\n`;
      responseMsg += `💰 Total: *${grandTotal.toFixed(2)}€* (${fraisData?.length || 0} dépenses)\n\n`;
      
      if (Object.keys(byCategory).length === 0) {
        responseMsg += "_Aucun frais enregistré sur cette période._";
      } else {
        // Sort by total descending
        const sorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);
        
        for (const [cat, data] of sorted) {
          const pct = grandTotal > 0 ? Math.round((data.total / grandTotal) * 100) : 0;
          const bar = "█".repeat(Math.min(Math.round(pct / 10), 10)) + "░".repeat(Math.max(10 - Math.round(pct / 10), 0));
          responseMsg += `${categoryLabels[cat] || cat}\n`;
          responseMsg += `${bar} *${data.total.toFixed(2)}€* (${pct}% - ${data.count} dép.)\n\n`;
        }
      }
      
      return {
        actionTaken: "query_frais_detail_result",
        entityType: "frais_detail",
        customResponse: responseMsg,
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
      
      // Flag for regeneration with correction applied
      return {
        actionTaken: "feedback_saved_regenerate",
        entityType: "memory",
        entityId: feedbackValue, // Pass the correction value for context
      };
    }

    default:
      return {};
  }
}
