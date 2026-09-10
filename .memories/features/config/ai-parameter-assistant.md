---
name: Paramétrage assisté par IA (régies + aides)
description: Assistant IA généralisé pour bouquets, surcoûts, financements, gammes et aides, avec prévisualisation, garde-fous et annulation
type: feature
---

## Portée
Écran `Paramètres → Paramétrage assisté par IA` (`/parametres/assistant`, `src/pages/settings/ConfigAssistant.tsx`).
Domaines pilotables (`src/lib/configDomains.ts`) :
- `regie_bouquets` (bouquets), `regie_surcouts`, `regie_financements`, `regie_gammes` — portée régie
- `aides_pv` (data_aides), `aides_pac`, `aides_ite` — portée utilisateur

## Fonctionnement
1. L'utilisateur décrit sa demande (texte, dictée vocale, image ou PDF).
2. Edge function `config-assistant` reçoit le domaine, la liste blanche des champs et le paramétrage actuel,
   puis renvoie `{ resume, raisonnement, changements[] }` (`creer` | `modifier` | `supprimer`).
3. Rien n'est écrit avant validation : la proposition est prévisualisée changement par changement.

## Garde-fous
- Liste blanche stricte des colonnes ; les colonnes techniques (id, user_id, dates) ne sont jamais pilotables.
- `sanitizeChange` valide types, bornes min/max, enums et champs obligatoires ; tout changement non conforme
  est écarté et affiché dans « Changements écartés ».
- Les lignes globales (`user_id` null) des tables `data_aides*` ne sont ni modifiables ni supprimables.
- Les ids inconnus renvoyés par l'IA sont rejetés côté fonction.

## Historique et annulation
Table `config_ai_changes` (RLS par utilisateur) : domaine, régie, résumé, raisonnement, prompt d'origine,
`snapshot_avant` (lignes avant modification) et `changements`. L'annulation supprime les lignes créées et
restaure les lignes modifiées/supprimées, puis passe l'entrée en statut `annule`.
