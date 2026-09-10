---
name: Modèles de commissionnement personnalisables
description: Règles de commission IA, mode brouillon, historique des versions et repli sur le calcul historique
type: feature
---

## Principe
Le calcul historique (bouquet / pourcentage / pose externe, prime coup de pouce déduite à 50 %) reste la BASE.
Les règles de `commission_rules` s'appliquent par-dessus (déduction, bonus, remplace_base).

## Sécurisation (garde-fous)
- `commission_rules.statut` : `brouillon` | `actif` | `archive`. Seules les règles `actif` + `actif=true` entrent dans un calcul réel.
- `commission_rules.version` : numéro de version du modèle.
- Table `commission_schema_versions` : snapshot JSONB de chaque modèle (nom, version, raisonnement, prompt, règles, date d'activation). Restaurable depuis Paramètres → Calcul des commissions.
- `applyCommissionRulesSafe` (src/lib/commissionRules.ts) : valide chaque règle (pourcentage borné, part 0-100, min<=max) et replie **intégralement** sur la commission historique si une règle est invalide, si le résultat n'est pas fini ou dépasse le montant HT de la vente. Résultat négatif ⇒ 0.
- `useVenteCommissions` utilise exclusivement `applyCommissionRulesSafe`.

## UI
- Proposition IA : « Enregistrer en brouillon » (aucun impact) ou « Activer ce modèle » (archive l'ancien).
- Carte « Historique des modèles » avec restauration d'une version passée.
- Badge de statut cliquable sur chaque règle pour basculer brouillon/actif.
