import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedLead {
  CONTACT: {
    nom: string;
    prenom?: string;
    telephone?: string;
    telephone_secondaire?: string;
    email?: string;
  };
  ADRESSE: {
    adresse?: string;
    code_postal?: string;
    ville?: string;
  };
  RDV: {
    date?: string;
    heure?: string;
    duree_minutes?: number;
    type_projet?: string;
    commentaire?: string;
  };
  PROJET?: {
    type_chauffage?: string;
    type_toiture?: string;
    orientation_toiture?: string;
    facture_energie?: number;
    motivation?: string;
    budget_estime?: number;
    urgence?: string;
  };
}

async function extractLeadWithAI(emailBody: string, subject: string): Promise<ExtractedLead | null> {
  const systemPrompt = `Tu es un assistant spécialisé dans l'extraction de données de leads pour des entreprises de panneaux solaires.
Extrait les informations du mail en JSON structuré.

IMPORTANT: Retourne UNIQUEMENT le JSON, sans commentaires ni texte additionnel.

Structure attendue:
{
  "CONTACT": {
    "nom": "NOM DE FAMILLE (obligatoire)",
    "prenom": "Prénom si disponible",
    "telephone": "Téléphone principal (format français)",
    "telephone_secondaire": "Second téléphone si disponible",
    "email": "Email du contact"
  },
  "ADRESSE": {
    "adresse": "Numéro et rue",
    "code_postal": "Code postal 5 chiffres",
    "ville": "Ville"
  },
  "RDV": {
    "date": "Date au format YYYY-MM-DD",
    "heure": "Heure au format HH:MM",
    "duree_minutes": 90,
    "type_projet": "solaire|pompe_chaleur|renovation|autre",
    "commentaire": "Notes importantes"
  },
  "PROJET": {
    "type_chauffage": "electrique|gaz|fioul|bois|autre",
    "type_toiture": "tuiles|ardoises|bac_acier|autre",
    "orientation_toiture": "sud|sud-est|sud-ouest|est|ouest|autre",
    "facture_energie": 0,
    "motivation": "Raison du projet",
    "budget_estime": 0,
    "urgence": "imminent|court_terme|moyen_terme|informatif"
  }
}

Règles:
- Le nom est OBLIGATOIRE, met "INCONNU" si vraiment absent
- Formate les téléphones en 10 chiffres français (ex: 0612345678)
- Normalise les dates en YYYY-MM-DD
- Si une info n'est pas trouvée, omet le champ (ne met pas null)`;

  try {
    const response = await fetch("https://ai.lovable.dev/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Sujet: ${subject}\n\nContenu:\n${emailBody}` }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("AI API error:", await response.text());
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    // Clean up and parse
    jsonStr = jsonStr.trim();
    const parsed = JSON.parse(jsonStr);
    
    console.log("AI extracted data:", JSON.stringify(parsed, null, 2));
    return parsed as ExtractedLead;
    
  } catch (error) {
    console.error("AI extraction error:", error);
    return null;
  }
}

function normalizePhone(phone: string | undefined): string | null {
  if (!phone) return null;
  
  // Remove all non-digits
  let digits = phone.replace(/\D/g, "");
  
  // Handle French country code
  if (digits.startsWith("33") && digits.length === 11) {
    digits = "0" + digits.slice(2);
  }
  if (digits.startsWith("0033")) {
    digits = "0" + digits.slice(4);
  }
  
  // Must be 10 digits for French phone
  if (digits.length !== 10) return null;
  if (!digits.startsWith("0")) return null;
  
  return digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sender_email, subject, body, user_id, regie_id } = await req.json();
    
    if (!user_id || !body) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing email from ${sender_email}: ${subject}`);
    console.log(`Regie ID: ${regie_id}`);

    // Extract lead data using AI
    const extracted = await extractLeadWithAI(body, subject);
    
    if (!extracted || !extracted.CONTACT?.nom) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not extract lead data (nom manquant)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Normalize phone numbers
    const phone1 = normalizePhone(extracted.CONTACT.telephone);
    const phone2 = normalizePhone(extracted.CONTACT.telephone_secondaire);
    const email = extracted.CONTACT.email?.toLowerCase();

    // Deduplication: check if client already exists
    let existingClient = null;
    
    // Try to find by phone first
    if (phone1) {
      const { data } = await supabase
        .from("clients")
        .select("id, nom")
        .eq("user_id", user_id)
        .or(`telephone.eq.${phone1},telephone_secondaire.eq.${phone1}`)
        .limit(1)
        .maybeSingle();
      existingClient = data;
    }
    
    // Try by email if not found
    if (!existingClient && email) {
      const { data } = await supabase
        .from("clients")
        .select("id, nom")
        .eq("user_id", user_id)
        .eq("email", email)
        .limit(1)
        .maybeSingle();
      existingClient = data;
    }
    
    // Try by name + address as last resort
    if (!existingClient && extracted.CONTACT.nom && extracted.ADRESSE?.code_postal) {
      const { data } = await supabase
        .from("clients")
        .select("id, nom")
        .eq("user_id", user_id)
        .ilike("nom", extracted.CONTACT.nom)
        .eq("code_postal", extracted.ADRESSE.code_postal)
        .limit(1)
        .maybeSingle();
      existingClient = data;
    }

    let clientId: string;
    let action: "created" | "updated" = "created";

    if (existingClient) {
      clientId = existingClient.id;
      action = "updated";
      console.log(`Found existing client: ${existingClient.nom} (${clientId})`);
      
      // Update client with any new info
      const updateData: any = {};
      if (!existingClient.nom && extracted.CONTACT.prenom) {
        updateData.prenom = extracted.CONTACT.prenom;
      }
      if (phone2) updateData.telephone_secondaire = phone2;
      if (email) updateData.email = email;
      
      if (Object.keys(updateData).length > 0) {
        await supabase.from("clients").update(updateData).eq("id", clientId);
      }
    } else {
      // Create new client
      const clientData = {
        user_id,
        nom: extracted.CONTACT.nom.toUpperCase(),
        prenom: extracted.CONTACT.prenom || null,
        telephone: phone1,
        telephone_secondaire: phone2,
        email: email,
        adresse: extracted.ADRESSE?.adresse || null,
        code_postal: extracted.ADRESSE?.code_postal || null,
        ville: extracted.ADRESSE?.ville || null,
        source: sender_email,
        metadata: extracted.PROJET ? {
          type_chauffage: extracted.PROJET.type_chauffage,
          type_toiture: extracted.PROJET.type_toiture,
          orientation_toiture: extracted.PROJET.orientation_toiture,
          facture_energie: extracted.PROJET.facture_energie,
          projet_motivation: extracted.PROJET.motivation,
          budget_estime: extracted.PROJET.budget_estime,
          urgence: extracted.PROJET.urgence,
        } : null,
      };

      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert(clientData)
        .select("id")
        .single();

      if (clientError) {
        console.error("Error creating client:", clientError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create client" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      clientId = newClient.id;
      console.log(`Created new client: ${extracted.CONTACT.nom} (${clientId})`);
    }

    // Parse RDV date/time
    let dateHeure: string | null = null;
    if (extracted.RDV?.date) {
      const date = extracted.RDV.date;
      const time = extracted.RDV.heure || "09:00";
      dateHeure = `${date}T${time}:00`;
    } else {
      // Default to tomorrow at 9:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      dateHeure = tomorrow.toISOString();
    }

    // Create RDV with regie_id
    const rdvData = {
      user_id,
      client_id: clientId,
      date_heure: dateHeure,
      duree_minutes: extracted.RDV?.duree_minutes || 90,
      adresse: extracted.ADRESSE?.adresse || null,
      type_projet: extracted.RDV?.type_projet || "solaire",
      status: "planifie",
      commentaire: extracted.RDV?.commentaire || null,
      source: "gmail",
      regie_id: regie_id || null, // Auto-attribute regie
      metadata: extracted.PROJET ? {
        ai_extracted: true,
        extraction_date: new Date().toISOString(),
        type_chauffage: extracted.PROJET.type_chauffage,
        type_toiture: extracted.PROJET.type_toiture,
        orientation_toiture: extracted.PROJET.orientation_toiture,
        facture_energie: extracted.PROJET.facture_energie,
        motivation: extracted.PROJET.motivation,
        budget_estime: extracted.PROJET.budget_estime,
        urgence: extracted.PROJET.urgence,
      } : { ai_extracted: true, extraction_date: new Date().toISOString() },
    };

    const { data: newRdv, error: rdvError } = await supabase
      .from("rdv")
      .insert(rdvData)
      .select("id")
      .single();

    if (rdvError) {
      console.error("Error creating RDV:", rdvError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create RDV" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Created RDV: ${newRdv.id} with regie_id: ${regie_id}`);

    // Log action in historique
    await supabase.from("historique_actions").insert({
      user_id,
      client_id: clientId,
      action_type: "rdv_import",
      description: `RDV importé depuis ${sender_email}${regie_id ? " (régie auto-attribuée)" : ""}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        action,
        client_id: clientId,
        rdv_id: newRdv.id,
        regie_id: regie_id || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
