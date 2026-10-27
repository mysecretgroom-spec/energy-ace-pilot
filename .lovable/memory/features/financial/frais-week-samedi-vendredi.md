---
name: Semaine de frais samedi-vendredi
description: Le décompte hebdomadaire des frais court du samedi au vendredi, distinct de la semaine israélienne
type: constraint
---

Le décompte hebdomadaire des frais va du **samedi au vendredi** (règle utilisateur, 2026-02-08), partout : page Finance, agent WhatsApp, fonctions planifiées (check-missing-receipts).

- La semaine israélienne (dimanche→samedi) s'applique aux calendriers et dashboards, **pas** au décompte des frais.
- Helper partagé : `src/lib/fraisWeek.ts` (`getFraisWeekStart`), testé dans `src/lib/fraisWeek.test.ts`.
- Exception : l'ancien rappel lundi→vendredi a été aligné sur samedi→vendredi en 2026-02-08 ; ne pas re-divergence.
- Ne pas recalculer la semaine israélienne pour les frais lors de refactorings « semaine israélienne » (déjà arrivé une fois).
