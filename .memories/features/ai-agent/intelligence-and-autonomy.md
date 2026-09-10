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
