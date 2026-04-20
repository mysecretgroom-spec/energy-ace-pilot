

L'utilisateur confirme : sur WhatsApp, l'agent doit créer **à la fois le client ET le rdv** depuis l'image (logique conditionnelle existante : recherche client par téléphone d'abord, sinon création).

## Plan : Bouton "Image" + Intent agent IA WhatsApp

### 1. Bouton "Image" dans `QuickRdvForm`
- Petit bouton **"Image"** (icône caméra) en haut du formulaire
- Ouvre un dialogue qui demande :
  - **Régie** (obligatoire)
  - Upload 1 ou plusieurs screenshots (galerie/caméra)
- L'IA extrait les champs → pré-remplit le formulaire
- L'utilisateur valide/corrige → enregistre normalement (réutilise `createNewClient` + insert RDV existants)

### 2. Edge function `extract-rdv-from-image`
- Modèle vision : `google/gemini-2.5-flash`
- Tool calling pour sortie structurée fiable (nom, prénom, téléphone, email, adresse, CP, ville, date, heure, type projet, notes)
- Compression image côté client (max 1200px, qualité 0.7)
- Gestion 429 / 402 avec messages clairs

### 3. Intent agent IA WhatsApp (`whatsapp-agent`)
- Nouvel intent `import_rdv_from_image`
- Quand l'utilisateur envoie une image **sans contexte "frais/facture/reçu"** :
  1. Appel `extract-rdv-from-image`
  2. Si extraction réussie (nom + date trouvés) :
     - Recherche client existant par téléphone (logique conditionnelle existante)
     - Si trouvé → crée seulement le RDV lié
     - Sinon → crée client + RDV
     - Régie : prise depuis profil user (régie principale) ou demandée si plusieurs
     - Géocodage auto déclenché par triggers existants
  3. Confirme : "✅ RDV créé pour [Nom] le [date] à [heure] 📅"
  4. Si échec extraction → fallback vers flux frais existant
- Si infos critiques manquantes (date) → flux conversationnel `collecting_missing_data` existant

### Fichiers concernés

**Nouveaux**
- `supabase/functions/extract-rdv-from-image/index.ts`
- `src/components/planning/ImageImportDialog.tsx`

**Modifiés**
- `src/components/planning/QuickRdvForm.tsx` — ajout bouton "Image" + retour pré-rempli
- `supabase/functions/whatsapp-agent/index.ts` — nouvel intent + branchement détection image

### Hors périmètre
- Multi-images en un message WhatsApp (1 image = 1 RDV)
- Édition d'un RDV existant via image

