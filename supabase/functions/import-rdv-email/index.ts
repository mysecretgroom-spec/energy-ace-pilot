import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRdvRequest {
  sender_email: string;
  subject: string;
  body: string;
  user_id: string;
}

interface ParsedRdv {
  nom: string;
  prenom?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  telephone?: string;
  email?: string;
  date_heure?: string;
  type_projet?: string;
  commentaire?: string;
  // Extended info from AI analysis
  situation_familiale?: string;
  proprietaire?: boolean;
  type_habitation?: string;
  surface_habitable?: number;
  annee_construction?: number;
  type_chauffage?: string;
  facture_energie?: number;
  revenus_fiscaux?: number;
  nb_personnes_foyer?: number;
  type_toiture?: string;
  orientation_toiture?: string;
  projet_motivation?: string;
  budget_estime?: number;
  urgence?: string;
  notes_supplementaires?: string;
}

interface GeocodeResult {
  latitude: number;
  longitude: number;
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
      {
        headers: {
          "User-Agent": "SolarFlow-CRM/1.0",
        },
      }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (err) {
    console.error("Geocoding error:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sender_email, subject, body, user_id }: EmailRdvRequest = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Check if sender is in authorized emails list
    const { data: authorizedEmails } = await supabase
      .from("emails_autorises")
      .select("email")
      .eq("user_id", user_id)
      .eq("actif", true);

    const isAuthorized = authorizedEmails?.some(
      (e) => e.email.toLowerCase() === sender_email.toLowerCase()
    );

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Sender not authorized", sender: sender_email }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 2. Parse email content with AI
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: `Tu es un assistant spécialisé dans l'extraction d'informations de leads pour des projets d'énergie renouvelable (photovoltaïque, pompe à chaleur, isolation, etc.).

Analyse cet email et extrais TOUTES les informations utiles en JSON:

Sujet: ${subject}
Corps: ${body}

INFORMATIONS À EXTRAIRE (retourne null si non trouvé):

CONTACT (obligatoire: nom)
- nom: nom de famille du client
- prenom: prénom
- adresse: adresse complète (numéro, rue)
- code_postal: code postal (5 chiffres)
- ville: nom de la ville
- telephone: numéro de téléphone (format français)
- email: adresse email du client

RDV
- date_heure: date et heure du RDV au format ISO (YYYY-MM-DDTHH:MM:SS)
- type_projet: "photovoltaique", "pompe_chaleur", "isolation", "ballon_thermo", "batterie", ou "autre"

PROFIL CLIENT
- situation_familiale: "celibataire", "marie", "pacse", "divorce", "veuf"
- proprietaire: true/false (est propriétaire du logement?)
- nb_personnes_foyer: nombre de personnes dans le foyer

HABITAT
- type_habitation: "maison", "appartement", "immeuble"
- surface_habitable: surface en m²
- annee_construction: année de construction
- type_chauffage: "electrique", "gaz", "fioul", "bois", "pac", "autre"

ÉNERGIE & FINANCES
- facture_energie: montant facture énergie annuelle ou mensuelle en euros
- revenus_fiscaux: revenus fiscaux de référence
- budget_estime: budget envisagé pour le projet

TOITURE (pour projets photovoltaïques)
- type_toiture: "tuiles", "ardoises", "bac_acier", "tole", "autre"
- orientation_toiture: "sud", "sud-est", "sud-ouest", "est", "ouest", "nord"

CONTEXTE
- projet_motivation: pourquoi le client est intéressé (économies, écologie, autonomie...)
- urgence: "urgent", "moyen_terme", "informatif"
- notes_supplementaires: autres infos importantes non classées ailleurs
- commentaire: résumé court des points clés

Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`,
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI parsing error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to parse email" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    console.log("AI raw response:", content.substring(0, 500));
    
    let parsed: ParsedRdv;
    try {
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleanContent);
      console.log("Parsed result - nom:", parsed.nom, "prenom:", parsed.prenom);
    } catch (e) {
      console.error("Failed to parse AI response:", content, "Error:", e);
      return new Response(
        JSON.stringify({ error: "RDV incomplet - édition manuelle requise", raw: content }),
        {
          status: 422,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!parsed.nom) {
      return new Response(
        JSON.stringify({ error: "RDV incomplet - nom manquant" }),
        {
          status: 422,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 3. Find or create client with deduplication
    // Priority: email > telephone > (nom + adresse)
    let clientId: string | null = null;

    if (parsed.email) {
      const { data: clientByEmail } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user_id)
        .ilike("email", parsed.email)
        .limit(1);
      if (clientByEmail?.length) clientId = clientByEmail[0].id;
    }

    if (!clientId && parsed.telephone) {
      const cleanPhone = parsed.telephone.replace(/\D/g, "");
      const { data: clientByPhone } = await supabase
        .from("clients")
        .select("id, telephone")
        .eq("user_id", user_id);
      
      const match = clientByPhone?.find(
        (c) => c.telephone?.replace(/\D/g, "") === cleanPhone
      );
      if (match) clientId = match.id;
    }

    if (!clientId && parsed.nom && parsed.adresse) {
      const { data: clientByNameAddr } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user_id)
        .ilike("nom", parsed.nom)
        .ilike("adresse", `%${parsed.adresse.split(",")[0]}%`)
        .limit(1);
      if (clientByNameAddr?.length) clientId = clientByNameAddr[0].id;
    }

    // Create new client if not found
    if (!clientId) {
      // Build full address for geocoding
      const fullAddress = [parsed.adresse, parsed.code_postal, parsed.ville]
        .filter(Boolean)
        .join(", ");

      // Geocode the address
      let coords: GeocodeResult | null = null;
      if (fullAddress) {
        coords = await geocodeAddress(fullAddress);
      }

      // Build metadata JSON with all extracted info
      const clientMetadata: Record<string, unknown> = {};
      if (parsed.situation_familiale) clientMetadata.situation_familiale = parsed.situation_familiale;
      if (parsed.proprietaire !== undefined) clientMetadata.proprietaire = parsed.proprietaire;
      if (parsed.type_habitation) clientMetadata.type_habitation = parsed.type_habitation;
      if (parsed.surface_habitable) clientMetadata.surface_habitable = parsed.surface_habitable;
      if (parsed.annee_construction) clientMetadata.annee_construction = parsed.annee_construction;
      if (parsed.type_chauffage) clientMetadata.type_chauffage = parsed.type_chauffage;
      if (parsed.facture_energie) clientMetadata.facture_energie = parsed.facture_energie;
      if (parsed.revenus_fiscaux) clientMetadata.revenus_fiscaux = parsed.revenus_fiscaux;
      if (parsed.nb_personnes_foyer) clientMetadata.nb_personnes_foyer = parsed.nb_personnes_foyer;
      if (parsed.type_toiture) clientMetadata.type_toiture = parsed.type_toiture;
      if (parsed.orientation_toiture) clientMetadata.orientation_toiture = parsed.orientation_toiture;
      if (parsed.projet_motivation) clientMetadata.projet_motivation = parsed.projet_motivation;
      if (parsed.budget_estime) clientMetadata.budget_estime = parsed.budget_estime;
      if (parsed.urgence) clientMetadata.urgence = parsed.urgence;
      if (parsed.notes_supplementaires) clientMetadata.notes_supplementaires = parsed.notes_supplementaires;

      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          user_id,
          nom: parsed.nom,
          prenom: parsed.prenom || null,
          adresse: fullAddress || parsed.adresse || null,
          code_postal: parsed.code_postal || null,
          ville: parsed.ville || null,
          telephone: parsed.telephone || null,
          email: parsed.email || null,
          source: `Email: ${sender_email}`,
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null,
          notes: parsed.notes_supplementaires || null,
          metadata: Object.keys(clientMetadata).length > 0 ? clientMetadata : null,
        })
        .select("id")
        .single();

      if (clientError) {
        console.error("Client creation error:", clientError);
        return new Response(JSON.stringify({ error: "Failed to create client" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      clientId = newClient.id;
    } else {
      // Update existing client with new extracted info (merge metadata)
      const updateMetadata: Record<string, unknown> = {};
      if (parsed.situation_familiale) updateMetadata.situation_familiale = parsed.situation_familiale;
      if (parsed.proprietaire !== undefined) updateMetadata.proprietaire = parsed.proprietaire;
      if (parsed.type_habitation) updateMetadata.type_habitation = parsed.type_habitation;
      if (parsed.surface_habitable) updateMetadata.surface_habitable = parsed.surface_habitable;
      if (parsed.annee_construction) updateMetadata.annee_construction = parsed.annee_construction;
      if (parsed.type_chauffage) updateMetadata.type_chauffage = parsed.type_chauffage;
      if (parsed.facture_energie) updateMetadata.facture_energie = parsed.facture_energie;
      if (parsed.revenus_fiscaux) updateMetadata.revenus_fiscaux = parsed.revenus_fiscaux;
      if (parsed.nb_personnes_foyer) updateMetadata.nb_personnes_foyer = parsed.nb_personnes_foyer;
      if (parsed.type_toiture) updateMetadata.type_toiture = parsed.type_toiture;
      if (parsed.orientation_toiture) updateMetadata.orientation_toiture = parsed.orientation_toiture;
      if (parsed.projet_motivation) updateMetadata.projet_motivation = parsed.projet_motivation;
      if (parsed.budget_estime) updateMetadata.budget_estime = parsed.budget_estime;
      if (parsed.urgence) updateMetadata.urgence = parsed.urgence;
      
      if (Object.keys(updateMetadata).length > 0) {
        // Get existing metadata and merge
        const { data: existingClient } = await supabase
          .from("clients")
          .select("metadata")
          .eq("id", clientId)
          .single();
        
        const mergedMetadata = {
          ...(existingClient?.metadata as Record<string, unknown> || {}),
          ...updateMetadata,
          last_email_update: new Date().toISOString(),
        };

        await supabase
          .from("clients")
          .update({ metadata: mergedMetadata })
          .eq("id", clientId);
      }
    }

    // 4. Check for duplicate RDV (same client, same time window)
    const rdvDateTime = parsed.date_heure ? new Date(parsed.date_heure) : new Date();
    const toleranceHours = 2;
    const minDate = new Date(rdvDateTime.getTime() - toleranceHours * 60 * 60 * 1000);
    const maxDate = new Date(rdvDateTime.getTime() + toleranceHours * 60 * 60 * 1000);

    const { data: existingRdvs } = await supabase
      .from("rdv")
      .select("id, date_heure, status, historique, commentaire")
      .eq("user_id", user_id)
      .eq("client_id", clientId)
      .gte("date_heure", minDate.toISOString())
      .lte("date_heure", maxDate.toISOString())
      .order("date_heure", { ascending: true });

    let rdvId: string;
    let action: "created" | "updated";

    if (existingRdvs && existingRdvs.length > 0) {
      // Update existing RDV
      const existing = existingRdvs[0];
      const historique = Array.isArray(existing.historique) ? existing.historique : [];
      historique.push({
        action: "MAJ via email",
        date: new Date().toISOString(),
        source: sender_email,
      });

      const updateData: Record<string, unknown> = {
        historique,
        email_source_id: subject,
      };

      if (parsed.adresse) updateData.adresse = parsed.adresse;
      if (parsed.commentaire) {
        updateData.commentaire = existing.commentaire 
          ? `${existing.commentaire}\n---\n${parsed.commentaire}`
          : parsed.commentaire;
      }

      await supabase.from("rdv").update(updateData).eq("id", existing.id);
      rdvId = existing.id;
      action = "updated";
    } else {
      // Create new RDV (type_rdv defaults to 'standard' - user can change it manually)
      const fullAddress = [parsed.adresse, parsed.code_postal, parsed.ville]
        .filter(Boolean)
        .join(", ");
        
      let coords: GeocodeResult | null = null;
      if (fullAddress || parsed.adresse) {
        coords = await geocodeAddress(fullAddress || parsed.adresse!);
      }

      // Build RDV metadata with extracted info
      const rdvMetadata: Record<string, unknown> = {
        ai_extracted: true,
        extraction_date: new Date().toISOString(),
      };
      if (parsed.projet_motivation) rdvMetadata.motivation = parsed.projet_motivation;
      if (parsed.budget_estime) rdvMetadata.budget_estime = parsed.budget_estime;
      if (parsed.urgence) rdvMetadata.urgence = parsed.urgence;
      if (parsed.type_toiture) rdvMetadata.type_toiture = parsed.type_toiture;
      if (parsed.orientation_toiture) rdvMetadata.orientation_toiture = parsed.orientation_toiture;
      if (parsed.facture_energie) rdvMetadata.facture_energie = parsed.facture_energie;
      if (parsed.type_chauffage) rdvMetadata.type_chauffage = parsed.type_chauffage;

      const { data: newRdv, error: rdvError } = await supabase
        .from("rdv")
        .insert({
          user_id,
          client_id: clientId,
          date_heure: rdvDateTime.toISOString(),
          adresse: fullAddress || parsed.adresse || null,
          type_projet: parsed.type_projet || "photovoltaique",
          type_rdv: "standard", // Default to standard, user changes manually if needed
          status: "nouveau",
          commentaire: parsed.commentaire || null,
          email_source_id: subject,
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null,
          metadata: rdvMetadata,
          historique: [
            {
              action: "Créé via email (IA)",
              date: new Date().toISOString(),
              source: sender_email,
              extracted_fields: Object.keys(parsed).filter(k => parsed[k as keyof ParsedRdv] != null),
            },
          ],
        })
        .select("id")
        .single();

      if (rdvError) {
        console.error("RDV creation error:", rdvError);
        return new Response(JSON.stringify({ error: "Failed to create RDV" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      rdvId = newRdv.id;
      action = "created";
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        rdv_id: rdvId,
        client_id: clientId,
        parsed,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Import error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
