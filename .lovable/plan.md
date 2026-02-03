

# Diagnostic et plan de correction : Calcul de distance

## Problème identifié

Le calcul de distance ne fonctionne pas car **beaucoup de RDVs n'ont pas de coordonnées GPS** (latitude/longitude).

**Données analysées :**
| RDVs récents | Avec coordonnées | Sans coordonnées |
|--------------|------------------|------------------|
| 30 derniers | ~10 (✅ calcul OK) | ~20 (❌ pas de calcul) |

**Les logs confirment** que quand les coordonnées existent, OSRM fonctionne :
- `OSRM: 54.2km, 48min` ✅
- `OSRM: 142.6km, 113min` ✅

**Note** : L'API Google Maps Directions est bloquée (nécessite activation de la "Routes API" au lieu de la "Directions API" legacy), mais le fallback OSRM fonctionne bien.

---

## Solution proposée : Géocodage automatique des RDVs

### 1. Trigger de géocodage automatique
Créer un trigger PostgreSQL qui appelle la fonction `geocode-address` automatiquement quand :
- Un RDV est créé avec une adresse mais sans coordonnées
- L'adresse d'un RDV est modifiée

### 2. Batch de rattrapage des RDVs existants
Créer une fonction edge pour géocoder tous les RDVs existants sans coordonnées (exécution unique).

### 3. Améliorer le géocodage lors de la création manuelle
S'assurer que `QuickRdvForm` appelle systématiquement le géocodage.

---

## Détail technique

### A. Nouvelle Edge Function : `batch-geocode-rdvs`

```text
┌─────────────────────────────────────────────────────┐
│  batch-geocode-rdvs                                 │
│  ─────────────────                                  │
│  1. SELECT tous les RDVs sans lat/lon               │
│  2. Pour chaque RDV avec adresse :                  │
│     - Appeler geocode-address                       │
│     - UPDATE rdv SET latitude, longitude            │
│  3. Retourner le nombre de RDVs mis à jour          │
└─────────────────────────────────────────────────────┘
```

### B. Trigger PostgreSQL (optionnel mais recommandé)

```sql
-- Fonction trigger pour géocodage automatique
CREATE OR REPLACE FUNCTION trigger_geocode_rdv()
RETURNS TRIGGER AS $$
BEGIN
  -- Insérer un job dans background_jobs pour géocodage async
  IF NEW.adresse IS NOT NULL 
     AND (NEW.latitude IS NULL OR NEW.longitude IS NULL)
     AND (OLD IS NULL OR OLD.adresse IS DISTINCT FROM NEW.adresse) THEN
    INSERT INTO background_jobs (type, payload, status)
    VALUES ('geocode_rdv', jsonb_build_object(
      'rdv_id', NEW.id,
      'address', NEW.adresse
    ), 'pending');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### C. Modification du formulaire QuickRdvForm

Vérifier que le géocodage est appelé après insertion du RDV et non seulement du client.

---

## Fichiers à modifier/créer

| Fichier | Action |
|---------|--------|
| `supabase/functions/batch-geocode-rdvs/index.ts` | Créer (rattrapage) |
| `supabase/functions/process-background-jobs/index.ts` | Ajouter traitement `geocode_rdv` |
| Migration SQL | Créer trigger automatique |
| `src/components/planning/QuickRdvForm.tsx` | Vérifier appel géocodage |

---

## Plan d'exécution

1. **Créer la fonction batch** pour géocoder les RDVs existants sans coordonnées
2. **Ajouter le traitement** dans `process-background-jobs` pour géocoder automatiquement les nouveaux RDVs
3. **Créer un trigger SQL** qui crée un job de géocodage quand un RDV est créé/modifié
4. **Lancer le batch** pour rattraper les ~20 RDVs sans coordonnées
5. **Tester** le calcul de distance sur le planning

---

## Impact attendu

| Métrique | Avant | Après |
|----------|-------|-------|
| RDVs avec coordonnées | ~30% | ~95%+ |
| Calcul distance affiché | Partiel | Systématique |
| Temps de trajet entre RDVs | Manquant | Affiché |

