// Simulation IA : pose de panneaux photovoltaïques sur une photo de toiture.
// Entrée : URL (ou base64) de la photo + nombre de panneaux issu de l'étude.
// Sortie : { image: "<base64 png>" }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return json({ error: "Configuration IA manquante" }, 500);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Requête invalide" }, 400);
  }

  const imageUrl = typeof payload.imageUrl === "string" ? payload.imageUrl : "";
  const imageBase64 =
    typeof payload.imageBase64 === "string" ? payload.imageBase64 : "";
  const mimeTypeIn =
    typeof payload.mimeType === "string" ? payload.mimeType : "image/jpeg";
  const nbPanneauxRaw = Number(payload.nbPanneaux);
  const nbPanneaux =
    Number.isFinite(nbPanneauxRaw) && nbPanneauxRaw > 0 && nbPanneauxRaw <= 200
      ? Math.round(nbPanneauxRaw)
      : 0;
  const surfaceConstraint =
    typeof payload.surfaceConstraint === "string"
      ? payload.surfaceConstraint.trim()
      : "";
  const ALLOWED_TYPES = ["toiture", "carport_bois", "carport_alu", "bac_leste"] as const;
  type InstallationType = (typeof ALLOWED_TYPES)[number];
  const installationType: InstallationType =
    typeof payload.installationType === "string" &&
    (ALLOWED_TYPES as readonly string[]).includes(payload.installationType)
      ? (payload.installationType as InstallationType)
      : "toiture";

  if (!imageUrl && !imageBase64) {
    return json({ error: "Photo manquante" }, 400);
  }
  if (imageUrl && !/^https:\/\//i.test(imageUrl)) {
    return json({ error: "URL de photo invalide" }, 400);
  }
  if (surfaceConstraint.length > 1500) {
    return json({ error: "Consigne de surface trop longue" }, 400);
  }

  let dataUrl = "";
  try {
    if (imageBase64) {
      if (imageBase64.length > MAX_IMAGE_BYTES) {
        return json({ error: "Photo trop volumineuse" }, 413);
      }
      dataUrl = imageBase64.startsWith("data:")
        ? imageBase64
        : `data:${mimeTypeIn};base64,${imageBase64}`;
    } else {
      const resp = await fetch(imageUrl);
      if (!resp.ok) return json({ error: "Photo inaccessible" }, 400);
      const bytes = new Uint8Array(await resp.arrayBuffer());
      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        return json({ error: "Photo trop volumineuse" }, 413);
      }
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      const mime = resp.headers.get("content-type") || mimeTypeIn;
      dataUrl = `data:${mime};base64,${btoa(binary)}`;
    }
  } catch (err) {
    console.error("[simulate-pv-roof] image load error", err);
    return json({ error: "Impossible de lire la photo" }, 400);
  }

  const supportLabel =
    installationType === "carport_bois"
      ? "un carport en bois"
      : installationType === "carport_alu"
        ? "un carport en aluminium"
        : installationType === "bac_leste"
          ? "des bacs lestés type GSE posés sur la surface plate"
          : "la toiture existante";

  const countInstruction = nbPanneaux
    ? `Installe exactement ${nbPanneaux} panneaux solaires (compte-les précisément) sur ${supportLabel}.`
    : `Installe un nombre réaliste de panneaux solaires sur ${supportLabel}.`;

  const edgeConstraint =
    "Respecter strictement les rives et les bordures du toit : les panneaux ne doivent NI dépasser NI recouvrir les gouttières, lucarnes, cheminées ou tout autre élément de rive. Cette consigne est obligatoire et constante.";

  const supportInstruction =
    installationType === "carport_bois"
      ? "Construis dans la photo un carport en bois massif (poteaux et poutres en bois lamellé-collé teinte naturelle) posé sur une zone dégagée (allée, place de stationnement, terrain plat devant la maison). Les panneaux forment la couverture du carport, légèrement inclinée, sans dépasser la structure. Le carport doit rester à l'échelle d'une ou deux voitures et ne pas cacher la maison."
      : installationType === "carport_alu"
        ? "Construis dans la photo un carport en aluminium anthracite (structure fine, poteaux carrés, finition mate) posé sur une zone dégagée (allée, place de stationnement, terrain plat). Les panneaux forment la couverture du carport, légèrement inclinée, sans dépasser la structure. Le carport doit rester à l'échelle d'une ou deux voitures et ne pas cacher la maison."
        : installationType === "bac_leste"
          ? "Installe les panneaux sur des bacs lestés (type GSE / bacs à lester) posés sur la surface plate : supports noirs inclinés d'environ 10 à 15°, rangées régulières espacées pour éviter l'ombrage, aucun perçement de l'étanchéité, retrait d'au moins un mètre par rapport aux acrotères et aux bords de la toiture plate."
          : edgeConstraint;

  const surfaceInstruction = surfaceConstraint
    ? `${supportInstruction} Consigne de zone complémentaire : ${surfaceConstraint}`
    : installationType === "toiture"
      ? `${supportInstruction} Choisis le pan de toiture le mieux exposé (de préférence sud/sud-est/sud-ouest) et en tuiles si possible.`
      : supportInstruction;

  const prompt = [
    "Tu es un photographe spécialisé en photomontage d'installations photovoltaïques.",
    `Modifie UNIQUEMENT cette photo réelle pour y ajouter une installation photovoltaïque sur ${supportLabel}.`,
    countInstruction,
    surfaceInstruction,
    "Contraintes techniques : panneaux noirs monocristallins full black, alignés en rangées régulières et parallèles aux lignes de la structure,",
    "respect strict de la perspective, des pentes, des ombres et de la lumière existante.",
    "Ne modifie ni le bâtiment existant, ni le ciel, ni l'environnement, ni le cadrage, ni les couleurs de la photo d'origine.",
    "Rendu photoréaliste, sans texte, sans logo, sans filigrane.",
  ].join(" ");

  try {
    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      },
    );

    if (!aiResp.ok) {
      const text = await aiResp.text().catch(() => "");
      console.error("[simulate-pv-roof] gateway error", aiResp.status, text);
      if (aiResp.status === 429) {
        return json({ error: "Trop de demandes, réessayez dans un instant." }, 429);
      }
      if (aiResp.status === 402) {
        return json({ error: "Crédits IA épuisés." }, 402);
      }
      return json({ error: "La génération a échoué." }, 502);
    }

    const data = await aiResp.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      console.error("[simulate-pv-roof] no image in response");
      return json({ error: "Aucune image générée." }, 502);
    }

    return json({ image: b64, nbPanneaux });
  } catch (err) {
    console.error("[simulate-pv-roof] unexpected", err);
    return json({ error: "Erreur inattendue." }, 500);
  }
});
