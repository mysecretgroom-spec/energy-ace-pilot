## Objectif

Assainir le projet sans modifier la logique métier. Tout est **additif** (validations, RLS, types, tests) ou **cosmétique** (logs). Aucun découpage de composant, aucun changement de signature publique, aucun renommage de table.

Le backlog de refactor structurel (God components, monolithes) est documenté en fin de plan mais **pas exécuté** dans cette session.

---

## Lot 1 — Sécurité edge functions (Zod validation) — en cours

Validation Zod stricte sur edge functions exposées :

- ✅ `whatsapp-agent` — `_validation.ts` + tests
- ✅ `sync-gmail-rdv` — body validé (days 1..90, ISO dates strict)
- ✅ `whatsapp-webhook` — schéma Twilio + URL média épinglée à `api/media.twilio.com` + **vérification de signature HMAC-SHA1 `X-Twilio-Signature`** (`_shared/twilioSignature.ts` + tests)
- ✅ `saas-stripe-webhook` — comparaison de signature timing-safe
- ✅ `analyze-document` — Zod sur `image_base64` (base64 only, max ~20MB) + `context` enum
- ✅ `whatsapp-send` — Zod : `to` E.164, `mediaUrl` épinglée à api/media.twilio.com (anti-SSRF), `message` ≤4096
- ✅ `enhance-document-image` — Zod : base64/data-url, `enhancement_type` enum
- ✅ `smart-analyze` — Zod : base64/data-url, ids UUID
- ✅ `plaid` — déjà validé (Zod + signature JWT existante)
- ✅ `weekly-recap` — Zod `week_offset` ∈ [-52,0] + `requireCronAuth`
- ✅ `rdv-preparation` — `requireCronAuth` (gate anti-DoS cron-only)
- ✅ `pipeline-tracker` — `requireCronAuth`
- ✅ `check-relance-paiement` — `requireCronAuth`
- ✅ `scheduled-gmail-sync` — `requireCronAuth`
- 🆕 `_shared/cronAuth.ts` — auth cron timing-safe (Bearer service key OR `x-cron-secret`) + tests Deno (6/6 ✅)

## Lot 2 — RLS & GRANT manquants

Audit + migration corrective :
- Schema `saas.*` (RLS manquante d'après l'audit) — politiques `has_role('admin')` ou scope `auth.uid()`
- Vérifier `GRANT` sur toutes les tables `public.*` créées sans `GRANT`
- Vérifier policies storage buckets `etudes-pdf`, `staging-uploads`, `pending-documents` (privés)
- Linter Supabase passé en fin de lot

## Lot 3 — Durcissement client (types stricts)

Remplacer les `any` non justifiés (~336) par des types issus de `src/integrations/supabase/types.ts` ou des génériques explicites. **Aucun changement runtime** — uniquement annotations.

Priorité aux hooks critiques : `useAuth`, `useSaasAccess`, `useRdvActions`, `useDeleteEntity`, `useGmailSync`, `useEtudeFormPersistence`.

Les `any` justifiés (intégrations tierces sans types) sont conservés avec un commentaire `// deno-lint-ignore` / `// eslint-disable-next-line` motivé.

## Lot 4 — Nettoyage console.log

Remplacer les 527 `console.log` par :
- `console.error` / `console.warn` pour les vrais cas d'erreur
- Suppression pour les logs de debug oubliés
- Conservation explicite quand c'est intentionnel (briefing, sync) avec préfixe `[domain]`

## Lot 5 — Tests de sécurité & garde-fous

- Suite Vitest pour `dateValidation`, `tva`, `commissionTypes`, `financingCalculation`, `installationDate` (logique financière critique)
- Suite Deno test pour les Zod schemas du Lot 1
- Test RLS via `supabase--read_query` sur les tables sensibles

## Lot 6 — Documentation dette technique

Mise à jour `/mnt/documents/architecture.md` avec :
- État après assainissement (score santé révisé)
- Backlog P2 chiffré : découpage EtudeForm (5589L → ~10 fichiers), fragmentation whatsapp-agent (12k L → handlers par intent), React.memo + manual chunks Vite, suppression code mort détecté
- Plan de migration progressif pour chaque item P2 (non exécuté ici)

---

## Détails techniques

**Ordre d'exécution :** lots indépendants → exécutables en parallèle via sub-agents pour Lot 1 (1 sub-agent par groupe de 3-4 functions) et Lot 3 (1 sub-agent par groupe de hooks). Lots 2, 5, 6 séquentiels.

**Validation après chaque lot :**
- Lot 1 : `supabase--test_edge_functions` sur chaque function
- Lot 2 : `supabase--linter` + `supabase--read_query`
- Lot 3 : build TypeScript propre (déclenché automatiquement)
- Lot 4 : grep résiduel + build
- Lot 5 : `bunx vitest run` + `supabase--test_edge_functions`

**Hors scope explicite (P2, non exécuté) :**
- Découpage `EtudeForm.tsx` (5589L)
- Découpage `whatsapp-agent/index.ts` (12k L) — déjà partiellement modularisé
- Ajout `React.memo` sur composants lourds
- Manual chunks Vite pour `jsPDF`, `xlsx`, etc.
- Suppression code mort détecté à l'audit

Durée estimée : ~45-60 min de travail agent (lots 1+3 parallélisés).