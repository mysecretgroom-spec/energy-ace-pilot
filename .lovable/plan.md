

## Plan : Intégration Stripe via Payment Links + flag bêta-testeur

### Contexte actuel
- Le système SaaS existe déjà : `saas.access_state` (trial/active/paywall/blocked), `saas.subscriptions`, fonctions RPC, `ProtectedRoute` avec paywall.
- Les edge functions `saas-create-checkout-session` et `saas-create-portal-session` sont référencées dans le code mais **n'existent pas encore**.
- Les prix affichés sont hardcodés à 29€/mois — à remplacer par 55,26€/mois et 555,26€/year.

### Approche : Payment Links Stripe

Puisque vous avez déjà créé des Payment Links dans Stripe, l'approche est simple : on redirige directement vers ces liens en passant l'email de l'utilisateur en paramètre (`prefilled_email`). Stripe gère tout le reste (paiement, abonnement).

Pour synchroniser le statut de paiement, un **webhook Stripe** écoute les événements et met à jour `saas.subscriptions` + `saas.access_state`.

---

### Étapes d'implémentation

#### 1. Ajouter le flag `is_beta_tester` en base
- Migration : ajouter `is_beta_tester BOOLEAN DEFAULT false` à `saas.access_state`
- Fonction RPC `get_saas_access_state` mise à jour pour retourner ce champ

#### 2. Mettre à jour `useSaasAccess` et `ProtectedRoute`
- Ajouter `isBetaTester` au hook
- Si `isBetaTester === true` → ne jamais montrer le paywall, traiter comme `active`

#### 3. Mettre à jour la page Abonnement + PaywallScreen
- Remplacer le prix 29€ par les deux options : **55,26€/mois** ou **555,26€/an**
- Au lieu d'appeler une edge function checkout, rediriger directement vers les Payment Links Stripe avec `?prefilled_email={email}&client_reference_id={userId}`

#### 4. Créer l'edge function `saas-stripe-webhook`
- Écoute les événements Stripe : `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
- Met à jour `saas.subscriptions` (status, stripe_customer_id, current_period_end)
- Met à jour `saas.access_state` (app_access = 'active' ou 'paywall')
- Nécessite le secret `STRIPE_WEBHOOK_SECRET`

#### 5. Supprimer/remplacer les edge functions inutilisées
- `saas-create-checkout-session` → remplacé par Payment Links directs
- `saas-create-portal-session` → garder si vous voulez le portail Stripe pour gérer la facturation (nécessite `STRIPE_SECRET_KEY`)

---

### Secrets nécessaires
- **STRIPE_WEBHOOK_SECRET** : pour valider les webhooks Stripe
- **STRIPE_SECRET_KEY** : uniquement si vous voulez le portail de gestion billing

### Informations requises de votre part
- L'URL du Payment Link **mensuel** (55,26€/mois)
- L'URL du Payment Link **annuel** (555,26€/an)

---

### Résumé du flux
```text
Utilisateur (paywall/trial) 
  → clique "S'abonner" 
  → choisit Mensuel ou Annuel
  → redirigé vers Payment Link Stripe (email pré-rempli)
  → paie sur Stripe
  → Stripe envoie webhook → edge function met à jour la base
  → utilisateur recharge l'app → accès "active"

Bêta-testeur (is_beta_tester = true)
  → jamais de paywall, accès total
```

