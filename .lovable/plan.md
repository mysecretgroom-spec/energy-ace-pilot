## Objectif

Dans l'écran d'import multi-factures (`MultiImportFlow` mode `finance`), permettre de saisir une seule instruction textuelle préfixée par les numéros des factures (ex. *« 1: TVA à 20%, 2: catégorie carburant + date 12/04, 3: fournisseur Total »*) que l'IA applique automatiquement aux bonnes lignes — comme on procède pour l'import multi des RDV (ImageImportDialog).

## Comportement attendu

1. Chaque carte facture porte un **badge numéroté** bien visible (`#1`, `#2`, `#3`…) calculé sur l'ordre courant.
2. Sous la liste, un bloc **« Modifier avec l'IA »** apparaît dès qu'au moins 1 facture est analysée :
   - Textarea libre avec placeholder *« Ex : 1 : TVA 20% ; 2 : catégorie carburant, fournisseur Total ; 3 : date 12/04 »*.
   - Bouton **« Appliquer »** (disabled si vide / en cours).
3. Au clic : envoi à une nouvelle edge function `apply-invoice-edits` avec :
   - la liste `[ { index, current_data } ]` des factures actuellement à l'écran,
   - l'instruction utilisateur brute.
4. L'IA renvoie un tableau de patchs `[ { index, patch: { montant_ttc?, taux_tva?, tva?, date?, fournisseur?, description?, categorie? } } ]`.
5. Les champs des cartes ciblées sont mis à jour côté client (toast récap : *« 2 factures modifiées »*). Les factures non citées restent intactes.
6. Erreurs gérées : 429 (« trop de requêtes IA »), 402 (« crédits IA épuisés »), parsing invalide (« Aucune modification reconnue »).

## Périmètre UI (frontend)

Fichier : `src/components/scanner/MultiImportFlow.tsx` (mode finance uniquement).

- Ajouter un badge `#{idx+1}` en haut-gauche de chaque `Card` de facture.
- Ajouter sous la liste, juste avant les boutons d'action de bas de dialog :
  ```
  ┌─ Modifier avec l'IA ──────────────┐
  │ [textarea instructions]            │
  │              [Annuler] [Appliquer] │
  └────────────────────────────────────┘
  ```
- Nouvel état local : `aiEditPrompt`, `isApplyingEdits`.
- Nouvelle fonction `handleApplyAiEdits()` appelant l'edge function et mergeant les patchs reçus dans `files`.

Le mode `client_docs` (carrousel) **n'est pas modifié**.

## Périmètre Backend

Nouvelle edge function `supabase/functions/apply-invoice-edits/index.ts` :

- Auth via JWT, CORS standard.
- Body validé via Zod : `{ invoices: [{ index, fournisseur?, date?, montant_ttc?, taux_tva?, categorie?, description? }], instruction: string }`.
- Appel Lovable AI Gateway (`google/gemini-3-flash-preview`) avec `Output.object` (Vercel AI SDK) et schéma Zod :
  ```
  { patches: [{ index: number, patch: { fournisseur?, date?, montant_ttc?, taux_tva?, tva?, categorie?, description? } }] }
  ```
- Prompt système : *« Tu reçois une liste numérotée de factures et une instruction utilisateur référant aux factures par leur numéro (1, 2, 3…). Renvoie uniquement les champs à modifier pour chaque numéro mentionné. Catégories autorisées : carburant, peage, repas, hotel, parking, train, location_vehicule, autre. Dates ISO yyyy-mm-dd. »*
- Retour `{ patches: [...] }` ou `{ patches: [] }` si rien d'interprétable.
- Logs `ai_usage` via le helper existant (à reprendre depuis `analyze-document` si présent).

## Détails techniques

- Le merge côté client recalcule `tva` automatiquement si `taux_tva` ou `montant_ttc` change (réutilise `calculerTVA` de `src/lib/tva.ts`).
- Les dates renvoyées par l'IA passent par `clampDateToToday` avant application.
- Si l'IA renvoie un `index` hors plage, il est ignoré silencieusement (toast info final indique `n appliquées / m ignorées`).
- Aucune migration DB, aucun changement de schéma.

## Hors périmètre

- Pas de modif du flux d'analyse initial (chaque facture continue d'être analysée individuellement par `analyze-document`).
- Pas de chat conversationnel multi-tours (instruction unique → patch unique).
- Pas d'édition dans le mode `client_docs`.
