---
name: Modèle de commissionnement modulable
description: Changement complet de style de commissionnement raisonné par l'IA (schema_nom, raisonnement, condition_base)
type: feature
---

Paramètres → Calcul des commissions permet deux niveaux :
1. **Règles unitaires** (créer / ajuster à la voix, à l'écrit, par document).
2. **Modèle de commissionnement complet** : l'utilisateur décrit son nouveau style de rémunération,
   l'IA (`commission-rule-assistant`, `mode: "schema"`) renvoie `{ schema_nom, raisonnement, rules[] }`,
   affiche le raisonnement pour validation, puis à l'application désactive toutes les règles actives
   et insère le nouveau jeu (`schema_nom`, `raisonnement` stockés sur chaque règle).

Colonnes `commission_rules` : `schema_nom`, `raisonnement`, `condition_base`
(`montant_ht` | `montant_ttc` | `puissance_kwc`) qui définit la grandeur testée par `condition_min/max`.
Les tranches sont exprimées par plusieurs règles `remplace_base` bornées.
Le calcul historique (bouquet / pourcentage / pose externe) reste la base tant qu'aucune règle
`remplace_base` ne s'applique.
