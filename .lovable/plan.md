
# Correction du chemin d'upload dans ReceiptScanner.tsx

## Probleme identifie

Le fichier `ReceiptScanner.tsx` utilise un format de chemin incompatible avec les politiques RLS du bucket `receipts` :

**Ligne 25 actuelle :**
```typescript
const fileName = `frais/${userId}/${timestamp}.${extension}`;
```

**Format requis par RLS :**
```typescript
const fileName = `${userId}/frais/${timestamp}.${extension}`;
```

Les politiques RLS exigent que le **premier segment** du chemin soit l'ID de l'utilisateur : `(storage.foldername(name))[1] = (auth.uid())::text`

## Correction a effectuer

### Fichier : `src/components/finance/ReceiptScanner.tsx`

Modifier la fonction `uploadReceiptToStorage` (ligne 25) :

```typescript
// AVANT (ligne 25)
const fileName = `frais/${userId}/${timestamp}.${extension}`;

// APRES
const fileName = `${userId}/frais/${timestamp}.${extension}`;
```

### Amelioration supplementaire

Ajouter une logique de retry pour la signature d'URL (comme dans `uploadService.ts`) afin de gerer les delais de propagation :

```typescript
// Utiliser le path retourne par Supabase plutot que le path local
const { data, error } = await supabase.storage
  .from("receipts")
  .upload(fileName, blob, { contentType, upsert: false });

// Retry logic pour signed URL
let signedUrl: string | null = null;
for (let attempt = 0; attempt < 3; attempt++) {
  if (attempt > 0) {
    await new Promise(resolve => setTimeout(resolve, 500 * attempt));
  }
  const { data: urlData } = await supabase.storage
    .from("receipts")
    .createSignedUrl(data.path, 60 * 60 * 24 * 365);
  if (urlData?.signedUrl) {
    signedUrl = urlData.signedUrl;
    break;
  }
}
```

## Resume des modifications

| Ligne | Avant | Apres |
|-------|-------|-------|
| 25 | `frais/${userId}/${timestamp}` | `${userId}/frais/${timestamp}` |
| 44-52 | Appel direct sans retry | Logique de retry avec 3 tentatives |

## Section technique

### Pourquoi ce changement ?

La politique RLS du bucket `receipts` verifie :
```sql
(storage.foldername(name))[1] = (auth.uid())::text
```

Cela signifie que le **premier dossier** du chemin doit etre l'ID de l'utilisateur connecte. Avec `frais/userId/...`, le premier segment est `frais`, ce qui echoue la verification RLS.

### Impact

- Les nouveaux uploads de factures respecteront les politiques RLS
- Les fichiers existants avec l'ancien format (`frais/userId/...`) resteront inaccessibles via l'API (mais toujours en base)
