# Débalepro

1. Contexte général

Créer une application mobile métier (mobile-first iOS/Android) pour commerciaux ENR. Centraliser RDV, planning trajets, étude interne, suivi dossiers, finance/frais, paramètres (tables DATA).
L’étude n’est jamais envoyée au client. Le devis/bon de commande est papier, signé sur place.

2. Accès & sécurité

Compte utilisateur + cloud. Mode interne sécurisé (PIN/biométrie) auto-désactivé à la sortie de l’étude.

3. MODULE 1 — Import RDV (Email) + Déduplication + Rattachement client
Filtre impératif

Importer uniquement depuis des emails dont l’expéditeur figure dans Paramètres > Emails autorisés.

Extraction

Extraire nom, adresse, téléphone, email, date/heure, type projet. Si manquant : “RDV incomplet” et édition manuelle.

Déduplication & mise à jour (CRITIQUE)

À la réception d’un RDV :

Identifier/Créer le client par priorité : email > téléphone > (nom+adresse)

Rechercher RDV existant pour ce client (même date/heure ± tolérance paramétrable, ou même adresse + date, ou ID RDV si présent)

Si RDV existe : ne pas dupliquer, mettre à jour champs manquants, attacher le mail source, conserver le statut déjà classé (R2 / pré-étude / reporté / signé), historiser “MAJ via email du…”

Si RDV n’existe pas : créer RDV avec statut “Nouveau/À qualifier”
Toujours attacher le mail source au RDV.

4. MODULE 2 — Planning intelligent

Vues jour/semaine/mois. Calcul distances et temps entre RDV, + distance dernier RDV J vers 1er RDV J+1, alertes planning irréaliste.
Clic RDV : ouvrir itinéraire Waze/Google Maps/Plans.
Afficher badge de statut RDV dans le planning (Nouveau, Reporté, R2 normal, R2 pré-étude, Signé, Négatif, Annulé).

5. MODULE 3 — Logistique hôtel (simple)

Bouton “Trouver un hôtel” toujours visible. Au clic : redirection Booking.com avec ville du 1er RDV du lendemain + date nuit du jour en cours → lendemain. Pas d’API Booking.

6. MODULE 4 — Cycle de vente & classement RDV

Classements obligatoires : Annulé, Reporté, Négatif, Positif/Signé, R2 normal, R2 pré-étude.
Actions automatiques : envoyer mail/WhatsApp au confirmateur avec le statut + commentaire.

7. MODULE 5 — Étude commerciale/technique (support interne)

Collecter conso, facture, kWc, type revente, support, orientation (boussole), inclinaison (photo), compteur/tableau (photos), options/surcoûts.
Calculs basés sur tables DATA : PSH/heures, coefficients orientation/inclinaison, production, surplus, autoconsommation, revente, mensualité estimée, résultat mensuel, verdict Valide/À étudier/Invalide.
Aucun envoi client.

8. MODE INTERNE “HEJJA” (2 switches seulement)

Accès PIN/biométrie, invisible client, auto-désactivation en quittant l’étude.
Switch 1 Ensoleillement : OFF standard / ON valeur max autorisée (PSH ou heures) — uniquement étude en cours.
Switch 2 Prix : OFF prix recommandé (tables DATA) / ON grille plus élevée ou saisie manuelle — uniquement étude en cours.

9. MODULE 6 — Tables DATA paramétrables

Admin simple pour gérer : PSH/heures par département, matrice orientation/inclinaison, tarifs revente, prix bouquets, surcoûts (tri, carport, bac GSE…), commissions/surventes. Jamais visibles côté client.

10. MODULE 7 — Fiche client = dossier complet (CRITIQUE)

Quand on ouvre un client, afficher tout :

infos client + notes

RDV passés/futurs + statuts

études + résultats + photos

tous documents importés/scannés (CNI, justificatifs, docs signés…)

historique actions (envois WhatsApp/mail, changements statut, relances)

raccourcis : appeler / WhatsApp / itinéraire / créer R2 / créer étude

11. MODULE 8 — Finance & frais

Ventes : CA, commissions, rentabilité.
Frais : scan factures OCR IA, catégorisation, calcul jour/semaine/mois/année, export PDF, transmission compta.

12. Pages

1 Accueil (RDV du jour, alertes, mini dashboard)
2 Planning (RDV + trajets + statuts)
3 Clients (dossiers complets)
4 Finance
5 Paramètres (profil, emails autorisés, tables DATA, règles prix/commissions)

UX/UI

Sobre, premium, rapide, mobile-first, aucune info technique visible client.

Si tu veux, je peux aussi ajouter dans le prompt :

une tolérance de matching (ex : ±2h) paramétrable,

une fusion contrôlée quand le mail change l’adresse/heure (ex : “conflit : conserver ancien / remplacer / dupliquer en reporté”).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://energy-ace-pilot.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fdcd1698-fd4a-4278-bd39-8e8b51039a6a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
