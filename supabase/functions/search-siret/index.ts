import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName } = await req.json();

    if (!companyName) {
      return new Response(
        JSON.stringify({ error: 'Company name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the official French government API for company search
    const searchUrl = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(companyName)}&per_page=1`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const company = data.results[0];
      return new Response(
        JSON.stringify({
          nom: company.nom_complet || company.nom_raison_sociale,
          siret: company.siege?.siret || null,
          siren: company.siren || null,
          adresse: company.siege?.adresse || null,
          code_postal: company.siege?.code_postal || null,
          ville: company.siege?.libelle_commune || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ nom: null, siret: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error searching SIRET:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
