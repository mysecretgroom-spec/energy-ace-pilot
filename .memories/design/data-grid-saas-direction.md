---
name: Direction design « Grille de données »
description: Refonte 2026 — esthétique SaaS B2B sobre, grille dense, bleu #1E88E5 ; rejette tout rendu « IA » (glass, gradients, glow)
type: design
---

Direction validée par l'utilisateur (inspirée open-saas / Linear / Stripe Dashboard, JAMAIS de glassmorphism, gradients colorés, halos, ombres dramatiques ou mockups décoratifs — l'utilisateur rejette explicitement les « rendus IA »).

**Règles :**
- Grille de cartes jointives (`gap-px bg-border border`), coins quasi carrés (`rounded-sm`/`rounded-none`), bordures fines 1px.
- Labels compacts : `text-[9px]/[11px] font-bold uppercase tracking-widest text-muted-foreground`.
- Chiffres : `tabular-nums tracking-tight`, colonnes horaires accentuées en `text-primary`.
- Noms clients en majuscules, statuts en badges outline `rounded-sm uppercase`.
- Animations minimales (`duration-100`, hover bg seul).

**Tokens :**
- Accent primaire global (clair + sombre) : bleu #1E88E5 (`--primary: 209 85% 47/53%`) — remplace l'ancien vert solaire.
- Dark (HEJJA) : fond #0B1220, surfaces #111C31, texte #E6EDF7.
- `--radius: 0.3rem`.

**Appliqué :** BottomNav (indicateur haut, labels 9px uppercase), Dashboard KPIs + liste RDV (colonne heure/date tabulaire).
**Note :** l'app démarre en mode clair ; le dark reste réservé au mode HEJJA — ne pas forcer `.dark` globalement sans décision explicite.
