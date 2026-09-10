---
name: OCR factures — double lecture et erreurs affichées
description: ocr-receipt en 2 passes (gemini-3.1-flash-lite puis gemini-3.8-flash), contrôles de cohérence et affichage des erreurs de lecture
type: feature
---

- `supabase/functions/ocr-receipt` : 1re passe `google/gemini-3.1-flash-lite`; 2e passe automatique avec `google/gemini-3.8-flash` si montant TTC manquant, confiance < 0.75, image "mauvaise" ou erreur de cohérence. On garde le résultat avec le moins d'erreurs.
- Le modèle renvoie aussi `confiance`, `champs_illisibles`, `qualite_image`. Le serveur ajoute `issues[{field, level, message}]` (TTC manquant/aberrant, HT+TVA ≠ TTC, taux hors 0/2.1/5.5/10/20, date future ou > 3 ans, commerçant/catégorie manquants, période location/hôtel incomplète).
- Front : `src/lib/ocrIssues.ts` (recalcul local à chaque édition) + `src/components/finance/OcrIssuesBanner.tsx`. Bandeau global + surlignage des champs (`border-destructive` / `border-warning`).
- Token `--warning` ajouté dans `src/index.css` et `tailwind.config.ts`.
- Jeu de test : 12 tickets réels de `frais.justificatif_url` (péage, carburant, hôtel, supermarché) — 12/12 montants corrects après refonte (une valeur stockée erronée, 11,80 € au lieu de 11,60 €, a été détectée).
