
# Ajouter le bloc Produit principal au mode lecture du profil

## Contexte
Le placeholder (mode lecture) du profil affiche les informations personnelles en lecture seule avant que l'utilisateur ne clique sur "Modifier le profil". Actuellement, le bloc "Produit principal" n'est visible que dans le formulaire éditable (après vérification MFA).

## Modification prévue

### Fichier : `src/pages/Profil.tsx`

Ajouter le bloc "Produit principal" dans le placeholder, juste après le champ "N° Agrément RGE" (ligne 388) et avant le message "Cliquez sur Modifier le profil" (ligne 390).

**Code à ajouter (lignes 389-410 environ) :**

```tsx
{/* Produit principal - lecture seule */}
<div className="pt-4 border-t border-border">
  <div className="flex items-center gap-2 mb-3">
    <Sun className="h-4 w-4 text-primary" />
    <span className="text-sm font-medium">Produit principal</span>
  </div>
  <Input 
    value={
      formData.produit_principal === "photovoltaique" ? "Photovoltaïque" :
      formData.produit_principal === "pompe_a_chaleur" ? "Pompe à Chaleur" :
      formData.produit_principal === "isolation" ? "Isolation (ITE)" : "—"
    } 
    disabled 
    className="bg-muted" 
  />
</div>
```

## Structure résultante du placeholder

```text
┌─────────────────────────────────────┐
│  Prénom         │  Nom              │
├─────────────────┴───────────────────┤
│  Email                              │
│  Téléphone personnel                │
│  Téléphone professionnel            │
│  Zone géographique                  │
│  N° Agrément RGE                    │
├─────────────────────────────────────┤
│  Produit principal  ← AJOUTÉ        │
│  [Photovoltaïque] (désactivé)       │
├─────────────────────────────────────┤
│  Cliquez sur "Modifier le profil"   │
└─────────────────────────────────────┘
```

## Résultat attendu
Le bloc "Produit principal" sera visible en mode lecture, avec la valeur actuelle affichée dans un champ désactivé, cohérent avec le reste du placeholder.
