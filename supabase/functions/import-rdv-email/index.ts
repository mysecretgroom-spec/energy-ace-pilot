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
  telephone?: string;
  email?: string;
  date_heure?: string;
  type_projet?: string;
  commentaire?: string;
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
            content: `Extrais les informations du RDV de cet email et retourne un JSON:

Sujet: ${subject}
Corps: ${body}

Extrais:
- nom: nom de famille du client (obligatoire)
- prenom: prénom (optionnel)
- adresse: adresse complète (optionnel)
- telephone: numéro de téléphone (optionnel)
- email: email du client (optionnel)
- date_heure: date et heure du RDV au format ISO (YYYY-MM-DDTHH:MM:SS) (optionnel)
- type_projet: "photovoltaique", "pompe_chaleur", "isolation", "ballon_thermo", ou "autre" (optionnel)
- commentaire: autres informations utiles (optionnel)

Réponds UNIQUEMENT avec le JSON, sans markdown. Exemple:
{"nom": "Dupont", "prenom": "Jean", "adresse": "12 rue de la Paix, 69001 Lyon", "telephone": "0612345678", "date_heure": "2026-01-22T09:00:00", "type_projet": "photovoltaique"}`,
          },
        ],
        max_tokens: 500,
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
    
    let parsed: ParsedRdv;
    try {
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI response:", content);
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
      // Geocode the address
      let coords: GeocodeResult | null = null;
      if (parsed.adresse) {
        coords = await geocodeAddress(parsed.adresse);
      }

      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          user_id,
          nom: parsed.nom,
          prenom: parsed.prenom || null,
          adresse: parsed.adresse || null,
          telephone: parsed.telephone || null,
          email: parsed.email || null,
          source: `Email: ${sender_email}`,
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null,
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
    }

    // 4. Check for duplicate RDV (same client + similar date/time ± 2 hours)
    const rdvDateTime = parsed.date_heure ? new Date(parsed.date_heure) : new Date();
    const toleranceHours = 2;
    const minDate = new Date(rdvDateTime.getTime() - toleranceHours * 60 * 60 * 1000);
    const maxDate = new Date(rdvDateTime.getTime() + toleranceHours * 60 * 60 * 1000);

    const { data: existingRdv } = await supabase
      .from("rdv")
      .select("id, date_heure, status, historique, commentaire")
      .eq("user_id", user_id)
      .eq("client_id", clientId)
      .gte("date_heure", minDate.toISOString())
      .lte("date_heure", maxDate.toISOString())
      .limit(1);

    let rdvId: string;
    let action: "created" | "updated";

    if (existingRdv?.length) {
      // Update existing RDV with new info, keep status
      const existing = existingRdv[0];
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

      // Only update missing fields
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
      // Create new RDV - geocode the address
      let coords: GeocodeResult | null = null;
      if (parsed.adresse) {
        coords = await geocodeAddress(parsed.adresse);
      }

      const { data: newRdv, error: rdvError } = await supabase
        .from("rdv")
        .insert({
          user_id,
          client_id: clientId,
          date_heure: rdvDateTime.toISOString(),
          adresse: parsed.adresse || null,
          type_projet: parsed.type_projet || "photovoltaique",
          status: "nouveau",
          commentaire: parsed.commentaire || null,
          email_source_id: subject,
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null,
          historique: [
            {
              action: "Créé via email",
              date: new Date().toISOString(),
              source: sender_email,
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
