// Simulation IA : pose de panneaux photovoltaïques sur une photo de toiture.
// Entrée : URL (ou base64) de la photo + nombre de panneaux issu de l'étude.
// Sortie : { image: "<base64 png>" }

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { visitorGuard } from "../_shared/visitorGuard.ts";

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
  { const __visitor = visitorGuard(req, corsHeaders); if (__visitor) return __visitor; }

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Connexion requise" }, 401);
  const auth = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
  const { data: authData, error: authError } = await auth.auth.getUser(authorization.slice(7));
  if (authError || !authData.user) return json({ error: "Connexion requise" }, 401);

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
  const ALLOWED_TYPES = ["toiture", "pergola", "carport_bois", "carport_alu", "bac_leste"] as const;
  type InstallationType = (typeof ALLOWED_TYPES)[number];
  const installationType: InstallationType =
    typeof payload.installationType === "string" &&
    (ALLOWED_TYPES as readonly string[]).includes(payload.installationType)
      ? (payload.installationType as InstallationType)
      : "toiture";

  const view = payload.view === "satellite" ? "satellite" : "photo";
  const referenceMapBase64 = typeof payload.referenceMapBase64 === "string" ? payload.referenceMapBase64 : "";
  const targetRoofBase64 = typeof payload.targetRoofBase64 === "string" ? payload.targetRoofBase64 : "";
  if (targetRoofBase64 && (!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(targetRoofBase64) || targetRoofBase64.length > MAX_IMAGE_BYTES)) {
    return json({ error: "Gros plan de la toiture invalide ou trop volumineux" }, 400);
  }
  const target = payload.targetPoint && typeof payload.targetPoint === "object"
    ? payload.targetPoint as Record<string, unknown> : null;
  if (target && (typeof target.x !== "number" || typeof target.y !== "number" || !Number.isFinite(target.x) || !Number.isFinite(target.y) || target.x < 0 || target.x > 1 || target.y < 0 || target.y > 1)) {
    return json({ error: "Le point rouge doit être visible sur la carte" }, 400);
  }
  const targetLocation = target && typeof target.x === "number" && typeof target.y === "number"
    ? `Le CENTRE EXACT du point rouge est à ${(target.x * 100).toFixed(2)} % de la largeur depuis la gauche et ${(target.y * 100).toFixed(2)} % de la hauteur depuis le haut de la carte complète.` : "";
  if (referenceMapBase64 && (!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(referenceMapBase64) || referenceMapBase64.length > MAX_IMAGE_BYTES)) {
    return json({ error: "Carte de référence invalide ou trop volumineuse" }, 400);
  }
  const pw = Number((payload.panelPixelSize as any)?.w);
  const ph = Number((payload.panelPixelSize as any)?.h);
  const panelPx = Number.isFinite(pw) && Number.isFinite(ph) && pw > 1 && ph > 1 && pw < 2000 && ph < 2000
    ? { w: Math.round(pw), h: Math.round(ph) } : null;

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
    installationType === "pergola"
      ? "une pergola sur l’espace désigné"
      : installationType === "carport_bois"
      ? "un carport en bois"
      : installationType === "carport_alu"
        ? "un carport en aluminium"
        : installationType === "bac_leste"
          ? "des bacs lestés type GSE posés sur la surface plate"
          : "la toiture existante";

  const targetInstruction = (view === "satellite"
    ? "CIBLE IMPÉRATIVE : le repère rouge désigne la toiture ou l’espace exact du projet. Installe uniquement sur cette surface. Si le repère est sur une annexe, un garage, une terrasse ou une zone de stationnement, cette zone est la cible : ne déplace jamais l’installation vers la maison principale ni vers un autre pan mieux exposé."
    : referenceMapBase64
      ? "RÉFÉRENCES : image 1 = photo réelle à modifier ; image 2 = carte satellite de localisation uniquement, avec repère rouge. Retrouve dans la photo la toiture ou l’espace désigné sur la carte en utilisant la géométrie et les éléments communs. Les deux vues doivent représenter exactement le même emplacement. Ne copie pas la vue aérienne dans le résultat, ne choisis pas automatiquement la maison principale. Si la cible n’est pas identifiable dans la photo, ne pose aucun panneau ailleurs et indique que la cible n’est pas identifiable."
      : "CIBLE IMPÉRATIVE : utilise uniquement la toiture ou l’espace photographié et désigné dans la consigne. Une annexe, un garage, un appentis, une pergola ou un carport peut être la cible. Ne choisis pas automatiquement la maison principale ni une autre surface mieux exposée.") + " " + targetLocation +
      " IDENTIFICATION AVANT MODIFICATION : identifie la surface qui se trouve DIRECTEMENT SOUS LE CENTRE du point rouge, pas sous son cercle extérieur. Le toit voisin, même plus grand, mieux visible, mieux orienté ou plus facile à modifier, est INTERDIT. Un toit au premier plan n’est pas la cible sauf si le point rouge le désigne. Conserve les contours, le faîtage, les rives et l’identité de cette toiture ; ne déplace pas les panneaux sur un autre bâtiment. Si cette toiture précise n’est pas identifiable ou visible dans la photo, réponds uniquement CIBLE_NON_IDENTIFIABLE, sans générer d’image ni inventer une autre installation." +
      (targetRoofBase64 ? ` La dernière image est un GROS PLAN DE LOCALISATION du même point rouge, pas une image à modifier. ${view === "satellite" ? "Image 1 = carte complète à modifier ; image 2 = gros plan." : "Image 1 = photo à modifier ; image 2 = carte complète de localisation ; image 3 = gros plan."} Utilise ce gros plan pour distinguer la toiture sélectionnée des bâtiments voisins. Le résultat conserve le cadrage de l’image 1.` : "");

  // Le nombre de rangées s'adapte à la forme réelle de la surface : pas de grille imposée.
  const countInstruction = nbPanneaux
    ? `Installe EXACTEMENT ${nbPanneaux} panneaux solaires sur ${supportLabel}, ni plus ni moins. ` +
      "Le nombre de rangées et de panneaux par rangée s'adapte aux proportions réelles de la surface disponible : une surface large et basse reçoit des rangées longues, une surface étroite et haute des rangées courtes. Ne force jamais une grille carrée si la toiture ne s'y prête pas. " +
      `Surface totale du champ : environ ${(nbPanneaux*2.37).toFixed(1)} m². Le bloc ne couvre donc qu'une partie du pan si le toit est plus grand : laisse la surface du support visible autour, ne remplis jamais artificiellement toute la zone. ` +
      "Chaque panneau doit être entièrement visible, nettement séparé des autres par un fin joint, sans fusion ni chevauchement. Avant de terminer, recompte les panneaux un par un : s'il n'y en a pas exactement " +
      `${nbPanneaux}, corrige.`
    : `Installe un nombre réaliste de panneaux solaires sur ${supportLabel}.`;

  const edgeConstraint =
    "Respecter strictement les rives et les bordures du toit : les panneaux ne doivent NI dépasser NI recouvrir les gouttières, lucarnes, cheminées ou tout autre élément de rive. Cette consigne est obligatoire et constante.";

  const supportInstruction =
    installationType === "pergola"
      ? "Sur l’espace désigné uniquement, conserve la pergola existante ou crée une pergola proportionnée à cet espace ; les panneaux forment sa couverture, avec poteaux et poutres réalistes, sans dépasser les bords du support. Ne la déplace pas vers une autre terrasse."
      : installationType === "carport_bois"
      ? "Carport par défaut : construis un carport en bois massif, avec de gros poteaux, grosses poutres et traverses robustes en bois naturel, posé uniquement sur l’espace désigné par le repère et photographié. Ajoute une véritable toiture métallique étanche légèrement inclinée en bac acier nervuré (zinc seulement si demandé), visible en rive et sous les panneaux. Les panneaux photovoltaïques sont fixés AU-DESSUS de cette couverture sur rails : ils ne remplacent jamais la toiture métallique et ne dépassent ni les rives ni la structure. Ne crée pas une structure fine en aluminium. Le carport doit rester à l'échelle d'une ou deux voitures et ne pas cacher la maison."
      : installationType === "carport_alu"
        ? "Construis dans la photo un carport en aluminium anthracite (structure fine, poteaux carrés, finition mate) posé uniquement sur l’espace désigné par le repère et photographié. Les panneaux forment la couverture du carport, légèrement inclinée, sans dépasser la structure. Le carport doit rester à l'échelle d'une ou deux voitures et ne pas cacher la maison."
        : installationType === "bac_leste"
          ? "Installe les panneaux sur des bacs lestés (type GSE / bacs à lester) posés sur la surface plate : supports noirs inclinés d'environ 10 à 15°, rangées régulières espacées pour éviter l'ombrage, aucun perçement de l'étanchéité, retrait d'au moins un mètre par rapport aux acrotères et aux bords de la toiture plate."
          : edgeConstraint;

  const surfaceInstruction = surfaceConstraint
    ? `${supportInstruction} Consigne de zone complémentaire : ${surfaceConstraint}`
    : installationType === "toiture"
      ? `${supportInstruction} Utilise uniquement le pan de toiture désigné et photographié, sur sa couverture en tuiles. Ne choisis pas un autre pan en fonction du sud ou de sa position dans l’image.`
      : supportInstruction;

  const dimensionInstruction =
    "Chaque panneau mesure exactement 1130 mm de large x 2095 mm de haut (ratio strict 1 : 1,85, rectangle portrait, jamais carré ni paysage). Tous les panneaux ont rigoureusement la même taille et la même orientation. Respecte l'échelle réelle par rapport au bâtiment (une porte fait environ 0,9 x 2,1 m, une tuile environ 0,3 m)." +
    (panelPx ? ` Dans cette image, un panneau occupe environ ${panelPx.w} x ${panelPx.h} pixels : utilise cette taille comme référence absolue pour chaque panneau.` : "");

  if (view === "satellite") {
    const satPrompt = [
      "Tu es spécialiste en photomontage photovoltaïque sur vue aérienne verticale (orthophoto satellite).",
      nbPanneaux
        ? `Ajoute EXACTEMENT ${nbPanneaux} panneaux solaires noirs full black, ni plus ni moins, sur la toiture ou le support du projet situé exactement au repère rouge. ` +
          "Le nombre de rangées s'adapte aux proportions réelles du pan de toiture (rangées longues sur une surface large, rangées courtes sur une surface étroite), jamais de grille carrée forcée. " +
          `Recompte-les un par un avant de terminer : il doit y en avoir exactement ${nbPanneaux}.`
        : "Ajoute un nombre réaliste de panneaux solaires noirs sur la toiture ou le support du projet situé exactement au repère rouge.",
      targetInstruction,
      surfaceInstruction,
      dimensionInstruction,
      "Vue de dessus : panneaux en rectangles strictement identiques, alignés en rangées régulières parallèles au faîtage, joints fins et réguliers entre chaque panneau, groupés en un ensemble compact adapté aux contours de la surface désignée ; une dernière rangée plus courte est autorisée pour respecter le nombre exact, aucune grille carrée ou rectangulaire complète imposée, d'une surface totale d'environ " + (nbPanneaux ? (nbPanneaux*2.37).toFixed(1) : "?") + " m², uniquement sur la zone désignée, sans dépasser les rives ni recouvrir cheminées ou fenêtres de toit.",
      surfaceConstraint ? `Consigne complémentaire : ${surfaceConstraint}` : "",
      "Retire le repère rouge. Ne modifie rien d'autre : ni le cadrage, ni l'échelle, ni l'environnement. Sans texte ni logo.",
    ].filter(Boolean).join(" ");
    return await generate(satPrompt);
  }

  const prompt = [
    "Tu es un photographe spécialisé en photomontage d'installations photovoltaïques.",
    `Modifie UNIQUEMENT cette photo réelle pour y ajouter une installation photovoltaïque sur ${supportLabel}.`,
    installationType === "toiture"
      ? "INTERDIT ABSOLU : poser des panneaux sur une façade, un mur, un pignon ou une surface verticale. Sur une toiture, pose uniquement sur la couverture en tuiles du pan désigné, en suivant sa pente entre le faîtage et la gouttière. Une toiture au premier plan ou une annexe n’est pas exclue si elle est la cible. Ne complète jamais une surface hors champ ni une cible invisible en inventant une autre toiture. Aucun panneau coupé par le cadre."
      : "",
    targetInstruction,
    countInstruction,
    dimensionInstruction,
    surfaceInstruction,
    "Contraintes techniques : panneaux noirs monocristallins full black, tous de taille et d'orientation strictement identiques, alignés en rangées régulières et parallèles aux lignes de la structure, joints fins visibles entre chaque panneau,",
    "respect strict de la perspective, des pentes, des ombres et de la lumière existante. Le ratio physique est 1130 : 2095 ; sa projection dans la photo suit la perspective réelle et peut être raccourcie, sans imposer un ratio à plat à l’image. Chaque panneau reste clairement délimité.",
    "Ne modifie ni le bâtiment existant, ni le ciel, ni l'environnement, ni le cadrage, ni les couleurs de la photo d'origine.",
    "Rendu photoréaliste, sans texte, sans logo, sans filigrane.",
  ].join(" ");

  return await generate(prompt);

  async function generate(prompt: string): Promise<Response> {
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
                ...(view === "photo" && referenceMapBase64
                  ? [{ type: "image_url", image_url: { url: referenceMapBase64 } }]
                  : []),
                ...(targetRoofBase64 ? [{ type: "image_url", image_url: { url: targetRoofBase64 } }] : []),
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
      let message = "La génération a échoué.";
      try {
        const upstream = JSON.parse(text);
        const safeMessage = upstream.message ?? upstream.error?.message;
        if (typeof safeMessage === "string") message = safeMessage;
      } catch { /* Non-JSON error body. */ }
      return json({ error: message }, aiResp.status);
    }

    const data = await aiResp.json();
    if (JSON.stringify(data).includes("CIBLE_NON_IDENTIFIABLE")) {
      return json({ error: "La toiture sous le point rouge n’est pas identifiable dans cette vue. Ajoutez une photo de cette toiture précise." }, 422);
    }
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      console.error("[simulate-pv-roof] no image in response");
      return json({ error: "Aucune image générée." }, 502);
    }

    return json({ image: b64, nbPanneaux, installationType, view });
  } catch (err) {
    console.error("[simulate-pv-roof] unexpected", err);
    return json({ error: "Erreur inattendue." }, 500);
  }
  }
});
