---
name: Intelligence et autonomie de l'agent IA
description: Raisonnement, accès au paramétrage métier, mémoire apprenante et confirmation intelligente de l'agent WhatsApp/chat
type: feature
---

## Contexte métier injecté
`supabase/functions/whatsapp-agent/_config-context.ts` → `loadUserConfigContext()` (cache 5 min, 9 000 car. max)
injecte dans le system prompt : régies, gammes, bouquets/grilles de prix, surcoûts, financements,
`commission_rules` actives (statut `actif`) et aides PV/PAC/ITE (perso + globales).
Les questions de paramétrage sont traitées en intent `conversation` avec réponse directe et chiffrée.

## Raisonnement
Champ `reasoning` (2-3 phrases, loggé, jamais envoyé) rempli avant le choix d'intent.
Historique conversationnel : 12 derniers messages (au lieu de 4), 1 500 car. chacun.

## Mémoire apprenante
Le modèle propose 0 à 2 `memory_suggestions` (`preference|pattern|alias|shortcut|context`) par message ;
elles sont écrites dans `whatsapp_agent_memory` via `saveMemory` (confiance 0.7), doublons de clé ignorés.

## Confirmation intelligente
`enforceConfirmation()` (garde-fou serveur, prioritaire sur la décision du modèle) :
- toujours : mark_signe, create_external_vente, update_vente_*, add_decom, import_facture, multi_request, action `supprime`
- risque faible (create_rdv, update_rdv, update_client_notes/data, create_support_ticket) : exécution directe si confidence >= 85
- query_*, user_feedback, conversation : jamais de confirmation
Le format du récapitulatif est libre ; l'exhaustivité reste obligatoire.

## Journalisation, savoir-faire et mémoire de session (v2)
- `agent_step_logs` : une ligne par étape (message_recu, contexte_charge, intention_analysee, memoire_apprise, action_executee, reponse_envoyee, echec) avec run_id, durée, statut. Écriture immédiate en tâche de fond + flush final et sur erreur.
- `agent_skills` : procédures réutilisables (globales ou par utilisateur), max 3 injectées par message selon les triggers, usage_count incrémenté.
- `agent_session_memory` : résumé roulant (6 lignes, 1200 car., périmé après 72h) + sujets en suspens, mis à jour après chaque réponse.
- Contexte de conversation persisté : 20 derniers messages (12 envoyés au modèle).
- Appel modèle : `gemini-2.5-flash-lite` d'abord ; en cas de MALFORMED_FUNCTION_CALL (contexte métier volumineux), relance automatique sur `gemini-2.5-flash`.
