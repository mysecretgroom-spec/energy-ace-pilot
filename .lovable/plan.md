
# Plan : Attribution intelligente de la régie via les en-têtes Reply-To/Cc

## Objectif

Modifier la logique de synchronisation Gmail pour utiliser les en-têtes `Reply-To` et `Cc` comme fallback lorsque l'email `From` ne permet pas de trouver une régie correspondante dans `emails_autorises`.

**Important** : On ne stocke pas ces headers supplémentaires, on les utilise uniquement pour la recherche de régie.

## Logique actuelle vs nouvelle logique

```text
ACTUEL:
Email From: no-reply@chelly.cloud
   → Cherche dans emails_autorises
   → Trouvé → regie_id = X (celle liée à no-reply@chelly.cloud)
   → Pas de fallback si regie_id est null

NOUVEAU:
Email From: no-reply@chelly.cloud (Reply-To: leadsb148@gmail.com)
   → Cherche From dans emails_autorises → regieId trouvé ? 
      → OUI → Utiliser ce regieId
      → NON (ou null) → Chercher Reply-To dans emails_autorises
         → Trouvé → Utiliser ce regieId
         → NON → Chercher dans Cc
            → Trouvé → Utiliser ce regieId
            → NON → regieId reste null
```

## Modifications dans `sync-gmail-rdv/index.ts`

### 1. Nouvelle fonction : extraction de tous les en-têtes utiles

```typescript
interface EmailHeaders {
  from: string;
  replyTo: string | null;
  cc: string[];
}

function extractAllEmailHeaders(headers: any[]): EmailHeaders {
  const getHeader = (name: string) => 
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
  
  const fromRaw = getHeader("From");
  const replyToRaw = getHeader("Reply-To");
  const ccRaw = getHeader("Cc");
  
  return {
    from: extractEmailAddress(fromRaw),
    replyTo: replyToRaw ? extractEmailAddress(replyToRaw) : null,
    cc: ccRaw 
      ? ccRaw.split(",").map((e: string) => extractEmailAddress(e.trim())).filter(Boolean)
      : []
  };
}
```

### 2. Nouvelle fonction : recherche de régie par ordre de priorité

```typescript
function findRegieFromHeaders(
  emailHeaders: EmailHeaders,
  emailToRegieMap: Record<string, string | null>
): { regieId: string | null; source: string } {
  // 1. D'abord essayer From (comportement actuel)
  const fromRegieId = emailToRegieMap[emailHeaders.from];
  if (fromRegieId) {
    return { regieId: fromRegieId, source: emailHeaders.from };
  }
  
  // 2. Si From n'a pas de regie, essayer Reply-To
  if (emailHeaders.replyTo && emailToRegieMap[emailHeaders.replyTo]) {
    console.log(`Regie found via Reply-To: ${emailHeaders.replyTo}`);
    return { regieId: emailToRegieMap[emailHeaders.replyTo], source: emailHeaders.replyTo };
  }
  
  // 3. Sinon essayer Cc
  for (const ccEmail of emailHeaders.cc) {
    if (emailToRegieMap[ccEmail]) {
      console.log(`Regie found via Cc: ${ccEmail}`);
      return { regieId: emailToRegieMap[ccEmail], source: ccEmail };
    }
  }
  
  // 4. Aucune régie trouvée - utiliser From quand même (peut être null)
  return { regieId: emailToRegieMap[emailHeaders.from] || null, source: emailHeaders.from };
}
```

### 3. Modification du traitement des messages

Remplacer le bloc actuel (lignes ~379-423) :

```typescript
// AVANT
const subject = headers.find(...)?.value || "";
const from = headers.find(...)?.value || "";
const senderEmail = extractEmailAddress(from);
// Verify sender is authorized
if (!authorizedEmailList.includes(senderEmail)) {
  ...
}
// Get regie_id from email source
const regieId = emailToRegieMap[senderEmail] || null;

// APRÈS
const subject = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value || "";
const emailHeaders = extractAllEmailHeaders(headers);
const senderEmail = emailHeaders.from;

// Log all headers for debugging
console.log(`Email headers: From=${senderEmail}, Reply-To=${emailHeaders.replyTo}, Cc=${emailHeaders.cc.join(",")}`);

// Verify sender is authorized (From must be in authorized list)
if (!authorizedEmailList.includes(senderEmail)) {
  console.log(`Skipping unauthorized sender: ${senderEmail}`);
  result.skipped++;
  continue;
}

// Find regie - try From first, then Reply-To, then Cc
const { regieId, source: regieSource } = findRegieFromHeaders(emailHeaders, emailToRegieMap);
if (regieId && regieSource !== senderEmail) {
  console.log(`Regie attribution via fallback header: ${regieSource}`);
}
```

## Résultat attendu

### Logs enrichis

```
Email headers: From=no-reply@chelly.cloud, Reply-To=leadsb148@gmail.com, Cc=
Regie found via Reply-To: leadsb148@gmail.com
Regie attribution via fallback header: leadsb148@gmail.com
Processing: Votre RDV du 29/01/2026 10:00 from no-reply@chelly.cloud
```

### Comportement

| Scénario | From | Reply-To | Régie attribuée |
|----------|------|----------|-----------------|
| Régie dans From | contact@groupeventvert.fr | - | Groupe Vent Vert |
| Régie dans Reply-To | no-reply@chelly.cloud | leadsb148@gmail.com | SB148 |
| Aucune régie | no-reply@chelly.cloud | autre@email.com | null |

## Prérequis

L'email `leadsb148@gmail.com` doit être configuré dans **Paramètres > Régies > SB148 > Emails autorisés** pour que l'attribution via Reply-To fonctionne.

## Fichier modifié

| Fichier | Modification |
|---------|--------------|
| `supabase/functions/sync-gmail-rdv/index.ts` | Ajout extraction headers + logique fallback régie |
