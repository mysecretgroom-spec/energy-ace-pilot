
# Plan d'optimisation de la latence IA

## Analyse de la situation actuelle

Ton projet utilise Lovable AI Gateway pour plusieurs fonctions :

| Fonction | Modèle actuel | Cas d'usage |
|----------|---------------|-------------|
| `whatsapp-agent` | `gemini-3-flash-preview` | Agent conversationnel principal |
| `workflow-assistant` | `gemini-3-flash-preview` | Création de workflows |
| `analyze-document` | `gemini-2.5-flash-lite` | Classification documents |
| `ocr-receipt` | `gemini-2.5-flash-lite` | OCR tickets de caisse |
| `extract-bouquets` | `gemini-2.5-flash` | Extraction données bouquets |
| `import-rdv-email` | `gemini-2.5-flash` | Import emails |
| `geocode-address` | `gemini-2.5-flash` | Normalisation adresses |

---

## Optimisations proposées

### 1. Utiliser des modèles plus rapides

| Fonction | Modèle actuel | Modèle optimisé | Gain estimé |
|----------|---------------|-----------------|-------------|
| `whatsapp-agent` (intent) | `gemini-3-flash-preview` | `gemini-2.5-flash-lite` | -50% latence |
| `whatsapp-agent` (réponse) | `gemini-3-flash-preview` | `gemini-2.5-flash` | -30% latence |
| `extract-bouquets` | `gemini-2.5-flash` | `gemini-2.5-flash-lite` | -40% latence |
| `geocode-address` | `gemini-2.5-flash` | `gemini-2.5-flash-lite` | -40% latence |

**Hiérarchie des modèles (du plus rapide au plus lent) :**
1. `gemini-2.5-flash-lite` — Ultra-rapide, parfait pour classification/OCR
2. `gemini-2.5-flash` — Équilibré, bon pour raisonnement modéré
3. `gemini-3-flash-preview` — Plus intelligent mais plus lent
4. `gemini-2.5-pro` / `gpt-5` — Très puissants mais lents

### 2. Réduire `max_tokens`

Actuellement `max_tokens: 4000` sur l'agent principal. Pour les requêtes courtes :
- Intent detection → `max_tokens: 500`
- Réponses simples → `max_tokens: 1000`
- Réponses complexes → `max_tokens: 2000`

### 3. Optimiser les prompts système

Le prompt système de `whatsapp-agent` fait ~6000 caractères. Options :
- Créer un prompt court pour l'intent detection (~1000 chars)
- Utiliser le prompt complet uniquement pour les réponses complexes

### 4. Paralléliser les appels indépendants

Dans `whatsapp-agent`, certains appels peuvent être parallélisés :
- Chargement mémoires + prompts utilisateur → en parallèle
- Detection type document + contexte conversation → en parallèle

### 5. Cache des résultats fréquents

Mettre en cache (15-30 min) :
- Bouquets et tarifs
- Mémoires utilisateur
- Profil utilisateur

---

## Détail technique des changements

### A. Fonction `whatsapp-agent` (impact majeur)

**Intent detection rapide :**
```typescript
// Étape 1: Classification rapide avec modèle léger
const intentResponse = await fetch(GATEWAY, {
  body: JSON.stringify({
    model: "google/gemini-2.5-flash-lite", // ← Plus rapide
    max_tokens: 500, // ← Réduit
    messages: [{ role: "system", content: SHORT_INTENT_PROMPT }, ...]
  })
});

// Étape 2: Réponse détaillée seulement si nécessaire
if (needsDetailedResponse) {
  const fullResponse = await fetch(GATEWAY, {
    model: "google/gemini-2.5-flash", // Modèle équilibré
    max_tokens: 1500
  });
}
```

### B. Parallélisation du chargement contexte

```typescript
// AVANT (séquentiel)
const memories = await loadUserMemories(...);
const prompts = await loadUserPrompts(...);
const context = await getConversationContext(...);

// APRÈS (parallèle)
const [memories, prompts, context] = await Promise.all([
  loadUserMemories(...),
  loadUserPrompts(...),
  getConversationContext(...)
]);
```

### C. Fonctions secondaires

| Fonction | Changement |
|----------|------------|
| `extract-bouquets` | `flash` → `flash-lite`, `max_tokens: 300` |
| `geocode-address` | `flash` → `flash-lite`, `max_tokens: 200` |
| `import-rdv-email` | `flash` → `flash-lite`, `max_tokens: 400` |

---

## Impact estimé

| Métrique | Avant | Après | Amélioration |
|----------|-------|-------|--------------|
| Latence intent detection | ~2-3s | ~0.8-1.2s | **-60%** |
| Latence réponse complète | ~4-6s | ~2-3s | **-50%** |
| Latence OCR/classification | ~1.5s | ~0.8s | **-45%** |

---

## Fichiers à modifier

1. `supabase/functions/whatsapp-agent/index.ts` — Optimisation majeure
2. `supabase/functions/extract-bouquets/index.ts` — Modèle plus léger
3. `supabase/functions/geocode-address/index.ts` — Modèle plus léger
4. `supabase/functions/import-rdv-email/index.ts` — Modèle plus léger

---

## Risques et compromis

- **Qualité légèrement réduite** : Les modèles `flash-lite` sont moins précis sur les cas complexes
- **Mitigation** : Utiliser `flash` pour les réponses finales, `flash-lite` uniquement pour classification
- **Rollback facile** : Changer juste le nom du modèle si problèmes détectés
