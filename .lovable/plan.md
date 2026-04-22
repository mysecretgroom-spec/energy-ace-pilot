

## Refonte du workflow image WhatsApp — classification d'abord, action ensuite

### Problème actuel
L'agent tente **systématiquement** une extraction RDV en premier (sauf si le classifier dit "finance" avec ≥ 0.85 de confiance). Résultat :
- Une facture peu confiante est analysée comme RDV puis seulement après comme finance → faux positifs RDV.
- Une photo de chantier ou un document client (CNI/RIB) tombe dans l'OCR fallback sans intent clair.
- 2 à 3 appels IA en cascade au lieu d'1 décision claire.

### Nouvelle logique : classifier = **chef d'orchestre**

```text
Image reçue
    │
    ▼
┌──────────────────────────────────────────────────┐
│ ÉTAPE 1 — Classifier (1 seul appel IA)           │
│  classify-image-intent v2 (gemini-2.5-flash-lite)│
│  Renvoie : { intent, confidence, reason }        │
│  Intents possibles :                             │
│   • rdv         → screenshot CRM / fiche RDV     │
│   • finance     → ticket / facture / reçu        │
│   • photo_etude → toiture / compteur / tableau   │
│   • doc_client  → CNI / RIB / justif domicile    │
│   • autre       → photo perso, illisible…        │
└──────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────┐
│ ÉTAPE 2 — Routage par intent (pas de cascade)    │
│                                                  │
│  rdv          → extract-rdv-from-image           │
│                 → flux validation/création RDV   │
│                                                  │
│  finance      → analyzeMediaStructured("finance")│
│                 → flux création frais            │
│                                                  │
│  photo_etude  → upload staging + lien client     │
│                 actif → confirme "Photo ajoutée  │
│                 au dossier {Client}"             │
│                                                  │
│  doc_client   → upload pending-documents         │
│                 → "Document reçu, je le classe   │
│                 dans le dossier {Client}"        │
│                                                  │
│  autre + conf<0.6 → OCR texte + demande          │
│                 "C'est quoi ? RDV / Frais /      │
│                 Photo / Document ?"              │
└──────────────────────────────────────────────────┘
```

### Règles de décision
- **Confidence ≥ 0.7** : on suit l'intent du classifier sans appel supplémentaire.
- **Confidence 0.4 – 0.7** : on suit l'intent mais on ajoute en réponse "Si je me trompe, réponds *frais* / *rdv* / *photo* / *document*".
- **Confidence < 0.4 OU intent=`autre`** : on demande à l'utilisateur de préciser (4 boutons : RDV / Frais / Photo étude / Document).
- **Album multi-images** : on classifie chaque image, puis on **regroupe par intent** (ex : 3 RDV + 1 facture → on traite les 3 RDV en batch puis la facture séparément).

### Fichiers modifiés

**`supabase/functions/classify-image-intent/index.ts`**
- Étendre l'enum à `["rdv", "finance", "photo_etude", "doc_client", "autre"]`.
- Mettre à jour le `SYSTEM_PROMPT` avec exemples concrets pour chaque catégorie (toiture/compteur pour `photo_etude`, CNI/RIB pour `doc_client`).
- Garder `gemini-2.5-flash-lite` (rapide, ~1s).

**`supabase/functions/whatsapp-agent/index.ts`** (lignes ~2496-2733 + ~2369-2489)
- **Inverser la logique** : appeler `classify-image-intent` en **premier et seul** décideur.
- Remplacer la stratégie "RDV-first" par un `switch(intent)` :
  - `rdv` → garder le flux existant (`extractRdvsFromImages` + menu validation/fast-path).
  - `finance` → appeler directement `analyzeMediaStructured("finance")`.
  - `photo_etude` → upload dans `documents` (bucket `documents`, type `photo_chantier`) lié au client actif (résolu via dernière action ou conversation en cours) ; si pas de client actif → demander "Pour quel client ?".
  - `doc_client` → upload dans `pending-documents` (admin inbox existante) avec confiance < 80% pour validation manuelle.
  - `autre` → OCR texte + question multi-choix.
- Pour les **albums multi-images** (~ligne 2369) : classifier chaque image en parallèle, regrouper par intent, traiter chaque groupe avec son flux.
- Supprimer le fallback OCR systématique : il devient le comportement uniquement pour `autre`.

**`supabase/functions/whatsapp-agent/_multi-rdv.ts`**
- Pas de modification (les helpers `extractRdvsFromImages` et `ocrImageToText` restent utilisés à la demande).

### Bénéfices
- **Latence** : 1 appel IA au lieu de 2-3 dans 80% des cas.
- **Précision** : plus de faux RDV depuis une facture.
- **Couverture** : photos étude et documents client enfin reconnus et routés correctement.
- **UX** : si le classifier doute, on demande explicitement au lieu de deviner.

### Hors périmètre (reste inchangé)
- Debounce album 4s (à revoir séparément si besoin).
- Authentification, RLS, structure des tables.
- L'extraction RDV elle-même (`extract-rdv-from-image`) reste identique.

