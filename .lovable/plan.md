# Plafond IA 10 €/mois par compte

## Objectif
Limiter la consommation Gemini à ~10 € par utilisateur et par mois, sans bloquer brutalement l'usage : optimisations silencieuses + dégradation douce à 80% + blocage total à 100%.

## Architecture

### 1. Table de tracking `ai_usage`
Nouvelle table pour comptabiliser chaque appel IA :
- `id`, `user_id`, `created_at`
- `function_name` (whatsapp-agent, smart-analyze, agent-chat, workflow-assistant, etc.)
- `model` (ex. `google/gemini-2.5-flash`)
- `input_tokens`, `output_tokens`, `image_count`
- `estimated_cost_usd` (calculé selon le modèle)
- `month_key` (YYYY-MM, indexé pour agrégations rapides)

RLS : utilisateur ne lit que ses propres lignes ; insert via service role (edge functions).

### 2. Helper partagé `_shared/aiUsage.ts`
Fonction utilitaire importée par toutes les edge functions IA :
- `checkUsageBudget(userId)` → retourne `{ used, budget, status: 'ok' | 'warning' | 'soft_capped' | 'hard_capped', forceModel? }`
- `logUsage(userId, response, model, functionName)` → extrait `usage.prompt_tokens` / `completion_tokens` du payload Lovable AI Gateway et insère la ligne
- Tarifs hardcodés par modèle (Flash, Flash-Lite, Pro, image)

Seuils :
- 0–80 % (0–8 €) : `ok`, modèle nominal
- 80–100 % (8–10 €) : `warning`, modèle nominal mais bandeau visible
- 100–150 % (10–15 €) : `soft_capped`, force `gemini-2.5-flash-lite` partout (sauf flux critiques)
- > 150 % (15 €) : `hard_capped`, refus poli avec message

### 3. Flux critiques exemptés du hard cap
Toujours autorisés même au-delà du budget (pour ne pas casser l'expérience commerciale) :
- `send-whatsapp-notification` (notifications RDV/vente)
- `daily-recap` / briefings automatiques
- `reconcile-installation-rdvs`

Tout le reste (chat agent, OCR manuel, workflows, smart-analyze) respecte le cap.

### 4. Edge functions à modifier
Wrapping unifié des appels Lovable AI Gateway dans :
- `supabase/functions/whatsapp-agent/index.ts`
- `supabase/functions/smart-analyze/index.ts`
- `supabase/functions/workflow-assistant/index.ts`
- `supabase/functions/analyze-document/index.ts`
- Toute autre fonction appelant `ai.gateway.lovable.dev`

Logique ajoutée en début de chaque fonction :
1. Récupérer `user_id` depuis le JWT
2. `checkUsageBudget(user_id)`
3. Si `hard_capped` et non critique → `429` avec message FR clair
4. Si `soft_capped` → forcer `model = 'google/gemini-2.5-flash-lite'`
5. Après réponse OK → `logUsage(...)` (non bloquant, fire-and-forget)

### 5. Optimisations transverses (gain ~30-50%)
- **Smart-analyze** : downscale à 1024 px au lieu de 1600 px, qualité JPEG 75%
- **Whatsapp-agent / agent chat** : tronquer historique à 10 derniers messages au lieu de tout
- **Tous prompts système** : audit pour réduire la verbosité (les longs system prompts sont facturés à chaque appel)
- **Cache mémoire** déjà en place (mem `latency-optimization-strategy`) à étendre aux requêtes de bilan

### 6. UI : jauge dans Paramètres
Nouveau composant `src/components/settings/AIUsageGauge.tsx` :
- Card affichant "Consommation IA ce mois : 6,40 € / 10 €"
- Barre de progression colorée (vert < 80%, orange 80-100%, rouge > 100%)
- Mini-breakdown : "Agent IA : 4,20 € · OCR : 1,80 € · Notifications : 0,40 €"
- Date de reset (1er du mois prochain)
- Bouton "Voir le détail" → dialogue avec liste des 30 derniers appels

Intégration dans `src/pages/Parametres.tsx` (section "Mon compte").

### 7. Bandeau d'avertissement global
Nouveau composant `src/components/saas/AIUsageBanner.tsx` monté dans `MobileLayout` :
- À ≥80% : bandeau orange discret en haut "Vous avez utilisé 80% de votre budget IA mensuel"
- À ≥100% : bandeau rouge "Mode économique activé — l'agent utilise un modèle plus rapide"
- Fetch via React Query toutes les 5 min, dismissable pour la session

### 8. Page admin (bonus)
Dans `src/pages/admin/AdminAnalytics.tsx`, ajouter un tableau "Consommation IA par utilisateur ce mois" trié desc, pour repérer les outliers.

## Détails techniques

### Calcul du coût (USD → € au taux fixe 0.92)
```
flash:       input 0.30/M, output 2.50/M
flash-lite:  input 0.10/M, output 0.40/M
pro:         input 1.25/M, output 10.0/M
```
Budget mensuel : `10 € / 0.92 ≈ 10.87 USD`

### Reset mensuel
Pas de cron : le calcul se fait à la volée par `SUM(estimated_cost_usd) WHERE month_key = current_month`. Aucune purge nécessaire (table archivée).

### Fallback en cas d'erreur de check
Si `checkUsageBudget` échoue (DB down) → on laisse passer (fail-open) pour ne pas casser l'agent. L'usage sera quand même loggé après l'appel.

## Réponse à la question "sans sentir de limitation ?"
- **0–80 %** : aucune différence perceptible
- **80–100 %** : bandeau d'avertissement, qualité identique
- **100–150 %** (mode éco) : réponses agent légèrement moins nuancées sur questions complexes, OCR identique. Notifications WhatsApp inchangées
- **> 150 %** : blocage avec message explicite. Cas rare si optimisations + soft cap fonctionnent

Pour un usage normal (≤200 conversations agent + ≤30 OCR/jour), un utilisateur ne devrait jamais dépasser 80%.

## Fichiers concernés
- **Migration** : nouvelle table `ai_usage` + RLS
- **Nouveau** : `supabase/functions/_shared/aiUsage.ts`
- **Modifiés** : `whatsapp-agent`, `smart-analyze`, `workflow-assistant`, `analyze-document` (et toute fonction appelant Gemini)
- **Nouveaux composants** : `AIUsageGauge.tsx`, `AIUsageBanner.tsx`
- **Modifiés** : `Parametres.tsx`, `MobileLayout.tsx`, `AdminAnalytics.tsx`
