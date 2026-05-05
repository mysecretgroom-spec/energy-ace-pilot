## Objectif

Permettre aux utilisateurs de recharger leur crédit IA (5€ ou 10€) lorsqu'ils approchent ou dépassent leur budget mensuel de 10€, via un paiement Stripe one-shot. Le crédit acheté **ne se réinitialise pas** chaque mois (il s'ajoute au budget jusqu'à épuisement).

## Comportement utilisateur

- Dans **Paramètres**, sous la jauge `AIUsageGauge`, deux boutons : **+5 €** et **+10 €**.
- Le bandeau global `AIUsageBanner` (à 80 %, soft cap, hard cap) gagne un bouton **« Recharger »** qui ouvre la même feuille de choix.
- Clic → redirection Stripe Checkout (mode `payment`, one-time) → retour sur `/parametres?topup=success`.
- Une fois le paiement confirmé, le solde apparaît dans la jauge sous la forme :
  `2,40 € / 10 € + 5 € rechargés` (`used / monthly + topup_remaining`).
- La logique de cap utilise désormais `budget_total = budget_mensuel + topup_remaining`. Tant qu'il reste du crédit rechargé, l'agent reste en mode normal (pas de soft/hard cap).

## Sections techniques

### 1. Base de données

Nouvelle table `ai_credit_topups` :
- `id`, `user_id`, `amount_eur` (5 ou 10), `amount_remaining_eur`, `stripe_session_id` (unique), `stripe_payment_intent`, `status` (`pending` / `paid` / `refunded`), `created_at`, `paid_at`.
- RLS : utilisateur lit ses propres lignes ; insertion/mise à jour via service role uniquement.
- Index sur `(user_id, status)`.

Fonction SQL `get_user_topup_balance(p_user_id uuid) returns numeric` (security definer) : somme `amount_remaining_eur` des lignes `paid`. Utilisée par les edge functions et le hook front.

Trigger / RPC `consume_topup_balance(p_user_id, p_amount_usd)` appelé après chaque `logUsage` pour décrémenter le pool si le mois courant a dépassé le budget de base.

### 2. Edge functions

- **`create-topup-checkout`** (nouvelle) : input `{ amount_eur: 5 | 10 }`. Vérifie JWT, crée une session Stripe Checkout `mode=payment`, `client_reference_id=user_id`, metadata `{ type: "ai_topup", amount_eur }`, succès → `/parametres?topup=success`, annulation → `/parametres?topup=cancel`. Retourne `{ url }`.
- **`saas-stripe-webhook`** (existante, modifiée) : dans `checkout.session.completed`, si `metadata.type === "ai_topup"` :
  - Insère/upsert la ligne dans `ai_credit_topups` (statut `paid`, `amount_remaining_eur = amount_eur`).
  - Notifie l'admin via WhatsApp (réutilise `notifyAdminNewSubscription` adapté).
  - Court-circuite la logique abonnement existante.
- **`_shared/aiUsage.ts`** :
  - `checkUsageBudget` : récupère `topup_balance`, calcule `budget_total = MONTHLY_BUDGET_USD + topup_balance_usd`, applique seuils sur `used / budget_total`.
  - `logUsage` : si l'usage du mois dépasse le budget mensuel de base, décrémente `amount_remaining_eur` (FIFO : top-up le plus ancien d'abord) via RPC.

### 3. Frontend

- **`useAIUsage`** : ajoute `topup_balance_eur` (via select sur `ai_credit_topups` filtré `paid` + remaining > 0) ; `budget_eur` devient `10 + topup_balance_eur` ; recalcule `ratio`.
- **`AIUsageGauge`** : affiche `topup_balance` séparément, ajoute un bouton **« Recharger »** ouvrant `<TopupSheet />`.
- **`AIUsageBanner`** : ajoute un bouton **« Recharger »** dans les variantes warning/soft/hard.
- **Nouveau composant `TopupSheet.tsx`** : Sheet/Dialog avec deux cartes (5 € / 10 €), bouton appelle `supabase.functions.invoke('create-topup-checkout', { body: { amount_eur } })` puis `window.location.href = url`.
- **`Parametres.tsx`** : détecte `?topup=success` au mount → toast succès + invalide la query `useAIUsage` ; `?topup=cancel` → toast info.

### 4. Sécurité & cohérence

- `create-topup-checkout` valide `amount_eur ∈ {5, 10}` avec Zod.
- Webhook : idempotence garantie par contrainte unique sur `stripe_session_id`.
- Pas de remboursement automatique côté app (admin manuel via Stripe dashboard).
- Le top-up reste valable indéfiniment (pas d'expiration).

## Fichiers touchés

**Créés**
- Migration `ai_credit_topups` + RPCs `get_user_topup_balance`, `consume_topup_balance`.
- `supabase/functions/create-topup-checkout/index.ts`
- `src/components/settings/TopupSheet.tsx`

**Modifiés**
- `supabase/functions/saas-stripe-webhook/index.ts` (branche top-up)
- `supabase/functions/_shared/aiUsage.ts` (intégration solde rechargé)
- `src/hooks/useAIUsage.ts` (lecture solde)
- `src/components/settings/AIUsageGauge.tsx` (affichage + bouton)
- `src/components/saas/AIUsageBanner.tsx` (bouton recharger)
- `src/pages/Parametres.tsx` (gestion `?topup=...`)

## Pré-requis

L'intégration Stripe est déjà en place (`saas-stripe-webhook`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). Aucun nouveau secret nécessaire.