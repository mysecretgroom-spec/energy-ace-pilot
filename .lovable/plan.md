
# Refonte Complete du Module "Live Scanner Documents"

## Objectif
Creer un nouveau module autonome `src/modules/docScanner/` offrant une experience de scanner de documents de qualite professionnelle (type CamScanner), avec traitement 100% local pour la detection/correction et appels backend uniquement pour l'OCR/IA.

## Architecture du module

```text
src/modules/docScanner/
  types.ts                          -- Types partages (ScanPage, Quad, Session, FilterPreset, etc.)
  components/
    DocScannerPage.tsx              -- Page principale / orchestrateur du flow
    CameraCapture.tsx               -- Camera live + overlay detection
    ImportButton.tsx                -- Import galerie / fichier
    PagesTray.tsx                   -- Bande miniatures multi-pages (drag & drop)
    CropEditor.tsx                  -- Editeur de recadrage (coins + loupe + rotation)
    FiltersPanel.tsx                -- Panneau des filtres (Original, Photo, Document, N&B, Ameliore)
    ExportPanel.tsx                 -- Export PDF/image + selection qualite
    OCRPanel.tsx                    -- Resultats OCR + extraction champs
    QualitySelector.tsx             -- Selecteur compression (High/Medium/Low)
  hooks/
    useCameraStream.ts              -- Gestion getUserMedia + cleanup
    useScanSession.ts               -- Etat multi-pages + persistence IndexedDB
    useWorkerPipeline.ts            -- Communication avec le Web Worker
  workers/
    scanWorker.ts                   -- Detection coins + scoring + warp + filtres (pur Canvas)
  utils/
    quad.ts                         -- orderQuad, rescaleQuad, computeOutputSize, confidenceScore
    exif.ts                         -- Lecture EXIF + normalisation orientation
    image.ts                        -- downscale, toImageBitmap, canvasToBlob, generateThumbnail
    pdf.ts                          -- Generation PDF multi-pages (A4/Original, marges, compression)
    homography.ts                   -- Calcul matrice H 3x3 + warp bilineaire (reecrit from scratch)
    filters.ts                      -- Presets filtres (Document, N&B, Ameliore, Photo)
    metrics.ts                      -- confidenceScore, blurScore, stabilityCheck
```

## Integration dans l'app

- Nouvelle route `/docs/scan` (lazy-loaded dans App.tsx)
- Le module est totalement isole, importable aussi comme composant dans les flows existants (finance, client docs)
- Les anciens composants sous `src/components/scanner/` restent en place temporairement pour ne pas casser les flows existants ; la migration se fait progressivement

## Details techniques par composant

### 1. Web Worker (`scanWorker.ts`)
Pipeline complet execute hors du thread principal :
- **Preprocess** : grayscale, gaussian blur 5x5
- **Edges** : Sobel + Canny (NMS + hysteresis avec Otsu auto-threshold)
- **Contours** : Hough lines -> intersections -> meilleur quadrilatere (+ fallback convex hull)
- **orderQuad** : tri TL/TR/BR/BL par centroide + angles
- **confidenceScore** : area ratio, convexite, angles ~90 degres, stabilite temporelle
- **computeOutputSize** : outW/outH = max des distances haut/bas et gauche/droite du quad (jamais arbitraire)
- **Homographie** : matrice H 3x3 via systeme 8x8 (Gauss pivot), sampling bilineaire, cap 2048px
- **Filtres rapides** : Document (contraste + fond eclair + unsharp), N&B (threshold adaptatif Otsu), Ameliore (gamma + sharpen + shadow reduce), Photo (leger contraste)
- Communication via `postMessage` avec transfert d'`ImageBitmap` / `Uint8ClampedArray`

### 2. `useCameraStream.ts`
- `getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } })`
- Gestion `denied` / `error` -> fallback import fichier
- Cleanup propre du stream au unmount
- iOS Safari : pas d'`OffscreenCanvas` -> fallback canvas classique

### 3. `useWorkerPipeline.ts`
- Initialise le Worker, throttle a 3-4 fps
- Envoie les frames en `ImageBitmap` (ou Uint8ClampedArray si pas supporte)
- Recoit : `{ quad, confidence, stable, warpedPreview }`
- Buffer des N derniers quads pour calcul de stabilite (variance < seuil -> "Snap Ready")
- Expose : `detectedQuad`, `isStable`, `confidence`, `processImage(bitmap)`

### 4. `CameraCapture.tsx`
- Video plein ecran avec overlay SVG (contour quad en teal `#2dd4bf`)
- Badge "Detection OK" quand `isStable && confidence >= 0.75`
- Guide pointille si pas de detection
- Bouton Capturer (pas d'auto-capture pour fiabilite PWA)
- Bouton Import (ouvre le file picker)
- Flash blanc a la capture + haptic feedback
- Bande miniatures en bas a droite si pages deja scannees

### 5. `CropEditor.tsx` (reecrit)
- Image affichee en "contain" (letterbox, jamais etiree)
- 4 coins deplacables avec zone tactile 44px
- **Loupe de precision** : quand un coin est drag, une loupe circulaire (80px, zoom x3) s'affiche au-dessus du doigt
- Midpoints sur les aretes pour deplacer un bord entier
- Boutons : Rotation 90 degres, Auto (relance detection locale), Annuler, Valider
- Si confiance < 0.6 : bouton "Ameliorer via IA" visible -> appel `ai-crop-detect` (version compressee 1600px)
- Badge "Coins IA" si les coins viennent du backend
- Calcul scale preview/original pour mapper les points correctement

### 6. `FiltersPanel.tsx`
- 5 presets avec apercu miniature instantane (sur version downscalee ~400px)
- Original, Photo, Document, N&B, Ameliore
- Application HQ differee (au moment export ou sur demande)
- Les filtres sont calcules dans le Worker pour ne pas bloquer l'UI

### 7. `PagesTray.tsx`
- Miniatures horizontales scrollables (drag & drop via `@dnd-kit`)
- Bouton + pour ajouter une page
- Supprimer une page (swipe ou bouton)
- Indicateur page active

### 8. `ExportPanel.tsx`
- Format : PDF multi-pages / JPEG / PNG
- PDF mode : A4 (contain centre) ou Taille originale
- Compression : High (0.92) / Medium (0.75) / Low (0.55)
- Marges : 0 ou 5mm
- Orientation auto
- Nom fichier : `Scan_YYYY-MM-DD.pdf`
- Boutons Telecharger + Partager (Web Share API)

### 9. `OCRPanel.tsx`
- Bouton "OCR" par page ou sur tout le document
- Appel backend `ocr-receipt` (image warped HQ) ou `analyze-document`
- Affichage texte + champs extraits (montant, date, fournisseur, etc.)
- Boutons Copier, Creer fiche frais

### 10. `useScanSession.ts`
- State : `pages[]`, `activePageId`, `exportSettings`
- Chaque page : `{ id, originalBlobUrl, originalSize, normalizedBlobUrl, quad, filterPreset, rotation, warpedPreviewUrl }`
- Persistence IndexedDB (blobs) + localStorage (meta `docScannerSession_v2`)
- Recovery automatique apres refresh PWA

### 11. Utilitaires cles

**`homography.ts`** (reecrit, pas de reutilisation de l'ancien) :
- Systeme lineaire 8x8 Gauss pivot partiel
- `computeHomography(srcQuad, dstRect)` -> matrice H[9]
- `warpPerspective(srcPixels, H, outW, outH)` -> pixels destination
- Sampling bilineaire pour qualite
- outW/outH toujours calcules depuis les distances du quad
- Cap MAX_OUTPUT_DIM = 2048

**`exif.ts`** :
- Lecture tag EXIF orientation depuis ArrayBuffer
- Rotation canvas pour normaliser "upright"
- Downscale si > 12MP (protection memoire iOS)

**`quad.ts`** :
- `orderQuad(points)` : tri TL/TR/BR/BL via centroide + atan2
- `rescaleQuad(quad, fromSize, toSize)` : conversion coordonnees entre resolutions
- `computeOutputSize(quad)` : max distances cotes opposes

**`filters.ts`** :
- Chaque filtre opere sur `ImageData` en place
- Document : white balance approx + background lighten + text enhance + unsharp
- N&B : adaptive threshold (block mean Otsu)
- Ameliore : gamma correction + local contrast + unsharp mask
- Photo : leger contraste + slight sharpen

## Gestion des erreurs

| Situation | Comportement |
|---|---|
| Camera refusee | Fallback Import + message clair |
| Detection echoue | Coins par defaut (rectangle 2% marge) + invitation recadrage manuel |
| IA crop echoue | Rester sur coins manuels |
| Export memoire insuffisante | Proposer qualite Medium/Low |
| Worker non supporte | Fallback main thread avec throttle reduit |

## Securite / RGPD
- Traitement local par defaut
- Appels backend explicites avec indication "envoye au serveur"
- Versions compressees envoyees au backend (pas les originaux)
- Pas d'upload sans action utilisateur explicite

## Performance
- Worker obligatoire pour detection + warp
- Throttle detection live : 3-4 fps max
- Downscale analyse : 1280px max
- Warp preview : 1200px max
- Warp HQ export : 2400px max selon device
- Liberation memoire GPU : `canvas.width = 0` apres usage
- Device low-end : detection de performance, reduction frequence et tailles automatique

## Etapes d'implementation

1. Creer `types.ts` + utilitaires (`quad.ts`, `exif.ts`, `image.ts`, `homography.ts`, `filters.ts`, `metrics.ts`)
2. Creer `scanWorker.ts` avec pipeline complet
3. Creer les hooks (`useCameraStream`, `useWorkerPipeline`, `useScanSession`)
4. Creer les composants UI un par un : CameraCapture -> CropEditor -> FiltersPanel -> PagesTray -> ExportPanel -> OCRPanel -> QualitySelector
5. Assembler dans `DocScannerPage.tsx`
6. Creer `pdf.ts` (generation multi-pages)
7. Ajouter route `/docs/scan` dans App.tsx (lazy-loaded)
8. Integration minimale : bouton "Scanner" dans les endroits existants pointant vers le nouveau module
