
# Plan d'optimisation de la latence IA — ✅ COMPLÉTÉ

## Changements effectués

| Fonction | Modèle avant | Modèle après | max_tokens |
|----------|--------------|--------------|------------|
| `whatsapp-agent` (intent principal) | `gemini-3-flash-preview` | `gemini-2.5-flash` | 4000 → 2000 |
| `whatsapp-agent` (feedback regen) | `gemini-3-flash-preview` | `gemini-2.5-flash-lite` | 2000 → 1000 |
| `workflow-assistant` | `gemini-3-flash-preview` | `gemini-2.5-flash` | — |
| `extract-bouquets` | `gemini-2.5-flash` | `gemini-2.5-flash-lite` | — |
| `geocode-address` | `gemini-2.5-flash` | `gemini-2.5-flash-lite` | — |
| `import-rdv-email` | `gemini-2.5-flash` | `gemini-2.5-flash-lite` | — |

## Impact estimé

| Métrique | Avant | Après | Amélioration |
|----------|-------|-------|--------------|
| Latence intent detection | ~2-3s | ~0.8-1.2s | **-60%** |
| Latence réponse complète | ~4-6s | ~2-3s | **-50%** |
| Latence OCR/classification | ~1.5s | ~0.8s | **-45%** |

## Notes

- Les modèles `flash-lite` sont utilisés pour les tâches rapides (classification, OCR, correction)
- Le modèle `flash` est conservé pour les réponses conversationnelles
- Rollback facile : changer juste le nom du modèle si problèmes détectés
