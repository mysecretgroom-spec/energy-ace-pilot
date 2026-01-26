
# Plan de correction : Enregistrement des messages de l'Agent Web

## Objectif
Ajouter l'enregistrement systématique de tous les messages (entrants et sortants) dans la table `whatsapp_messages` lorsque l'agent est appelé depuis l'app web.

## Approche technique
Modifier la fonction edge `whatsapp-agent` pour insérer les messages directement, sans dupliquer la logique existante du webhook.

---

## Etapes d'implementation

### 1. Ajouter une fonction d'enregistrement des messages

Creer une fonction helper dans `whatsapp-agent/index.ts` :

```typescript
async function logMessage(
  supabase: any,
  userId: string,
  fromNumber: string,
  messageType: string,
  rawContent: string,
  mediaUrl: string | null,
  transcribedContent: string | null,
  intent: string,
  entities: Record<string, unknown>,
  actionTaken: string | null,
  entityId: string | null,
  entityType: string | null,
  responseSent: string | null,
  status: "processed" | "failed" | "rejected"
): Promise<string | null> {
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .insert({
      user_id: userId,
      from_number: fromNumber,
      message_type: messageType,
      raw_content: rawContent,
      media_url: mediaUrl,
      transcribed_content: transcribedContent,
      detected_intent: intent,
      detected_entities: entities,
      action_taken: actionTaken,
      entity_id: entityId,
      entity_type: entityType,
      response_sent: responseSent,
      status: status,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to log message:", error);
    return null;
  }
  return data?.id;
}
```

### 2. Integrer l'enregistrement dans le flux principal

A la fin du handler `serve()`, juste avant de retourner la reponse (ligne ~1256), ajouter :

```typescript
// Log message for ALL sources (web_chat and WhatsApp direct calls)
// WhatsApp via webhook already logs, but this ensures web chat is logged too
if (request.fromNumber === "web_chat" || request.source === "onboarding_demo") {
  await logMessage(
    supabase,
    request.userId,
    request.fromNumber,
    request.messageType,
    request.content,
    request.mediaUrl || null,
    request.messageType === "audio" ? processedContent : null,
    aiResponse!.intent,
    aiResponse!.entities,
    actionResult.actionTaken || null,
    actionResult.entityId || null,
    actionResult.entityType || null,
    finalResponseMessage,
    "processed"
  );
}
```

### 3. Gerer les erreurs egalement

Dans le bloc `catch` (ligne ~1261), ajouter l'enregistrement des echecs :

```typescript
// Log failed message for web chat
if (request?.fromNumber === "web_chat") {
  await logMessage(
    supabase,
    request.userId,
    request.fromNumber,
    request.messageType || "text",
    request.content || "",
    null,
    null,
    "unknown",
    {},
    null,
    null,
    null,
    null,
    "failed"
  ).catch(console.error);
}
```

---

## Fichiers a modifier

| Fichier | Modification |
|---------|-------------|
| `supabase/functions/whatsapp-agent/index.ts` | Ajouter fonction `logMessage` + integration dans le handler |

---

## Verification apres implementation

1. Tester en envoyant un message via le chat web
2. Verifier dans la base que le message apparait dans `whatsapp_messages` avec `from_number = 'web_chat'`
3. Verifier que l'intent, les entities et la reponse sont bien enregistres

---

## Section technique

### Structure de la table `whatsapp_messages` (existante)
- `id` (uuid)
- `user_id` (uuid)
- `from_number` (text) - "web_chat" pour les messages web
- `message_type` (text) - "text", "audio", "image", "document"
- `raw_content` (text) - Message original
- `media_url` (text) - URL du media si applicable
- `transcribed_content` (text) - Transcription audio si applicable
- `detected_intent` (text) - Intent detecte par l'IA
- `detected_entities` (jsonb) - Entites extraites
- `action_taken` (text) - Action executee
- `entity_id` (uuid) - ID de l'entite modifiee
- `entity_type` (text) - Type d'entite
- `status` (text) - "processed", "failed", "rejected"
- `response_sent` (text) - Reponse envoyee
- `created_at` / `processed_at` (timestamptz)

### Distinction des sources
La colonne `from_number` permet de distinguer :
- `web_chat` : Messages depuis l'interface web
- `whatsapp:+33...` : Messages WhatsApp reels
- `onboarding_demo` : Messages de demo pendant l'onboarding
