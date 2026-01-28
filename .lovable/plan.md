

# Plan de correction : Carte RGE - Éléments manquants sur mobile

## Problème identifié

La carte RGE s'affiche correctement (photo, logos des en-têtes, certifications) mais **la zone centrale est complètement vide** (nom, téléphone, régie, SIRET, agrément, QR code).

### Cause technique

Le problème vient d'un conflit de layout CSS dans un contexte de rotation 90deg :

1. **Cascade de `flex-1` + `min-h-0`** : Ces classes sont utilisées à 3 niveaux imbriqués (lignes 324, 325, 327), ce qui cause un effondrement de hauteur
2. **`overflow-hidden` sur le conteneur** : Combiné avec les flex shrink, le contenu devient invisible car il déborde d'une zone de hauteur zéro
3. **`h-full` sur des éléments sans hauteur parent définie** : Le conteneur central (ligne 325) utilise `h-full` mais son parent `flex-1` n'a pas de hauteur explicite en contexte mobile rotaté

## Solution proposée

Remplacer le layout "flex avec shrink" par un layout plus explicite et robuste pour mobile :

### Modifications dans `RGECardDialog.tsx`

1. **Zone de contenu principal (ligne 324)** : Supprimer `min-h-0` et ajouter une hauteur minimale explicite pour mobile
   
2. **Conteneur intérieur (ligne 325)** : Remplacer `h-full` par une hauteur automatique et utiliser `flex-grow` au lieu de hauteur complète

3. **Zone photo + info (ligne 327)** : Supprimer `min-h-0` qui cause le collapse, et s'assurer que le contenu a de l'espace garanti

4. **Photo (ligne 330)** : Remplacer `h-[80%]` par une taille fixe en pixels pour mobile afin d'éviter les calculs de pourcentage sur une hauteur zéro

### Détail des changements

```text
Ligne 324 (Main content wrapper):
- Avant: className="flex-1 flex items-center justify-center min-h-0 p-2..."
- Après: className="flex-1 flex items-center justify-center p-2..." 
         + style avec minHeight conditionnel sur mobile

Ligne 325 (Inner container):
- Avant: className="...w-full h-full...overflow-hidden flex flex-col..."
- Après: className="...w-full...overflow-visible flex flex-col..."
         + hauteur gérée par le contenu au lieu de h-full

Ligne 327 (Photo and info row):
- Avant: className="flex-1 flex flex-row...min-h-0 gap-3..."
- Après: className="flex flex-row...gap-3..." (retrait flex-1 et min-h-0)

Ligne 330 (Photo container):
- Avant: h-[80%] aspect-[3/4] sm:h-40
- Après: h-20 aspect-[3/4] sm:h-40 (taille fixe sur mobile)

Ligne 394 (Agrément + QR section):
- Avant: w-[120px] sm:w-36 lg:w-44
- Après: w-24 sm:w-36 lg:w-44 (légèrement plus compact sur mobile)
```

## Résultat attendu

- La photo reste visible (comme actuellement)
- Le nom, "Technicien agréé", et téléphone s'affichent au centre
- Le numéro d'agrément et le QR code s'affichent à droite
- La régie et le SIRET s'affichent (une fois chargés)
- Les certifications en bas restent visibles

