# Mode hors-ligne complet pour le commercial en RDV

## Audit — ce qui bloque aujourd'hui sans réseau

| Étape du RDV | État actuel hors-ligne |
|---|---|
| Consulter le planning | OK (lecture en cache) |
| Ouvrir la fiche client / étude existante | Partiel : seulement si déjà consultée en ligne |
| Remplir l'étude | OK (brouillon local), mais prix/bouquets/aides/financement relus en ligne |
| Photos toiture / autres photos | Bloqué : envoi direct au stockage |
| Carte satellite + repère / panneaux | Bloqué : tuiles non mises en cache |
| Générer le PDF d'étude | Bloqué : relit l'étude et les photos en ligne |
| Changer le statut (Signé, Négatif, R2…) | Bloqué : écriture directe, erreur affichée |
| Fiche signature (date, CQ, financement) | Bloqué : relit étude, bouquets, surcoûts en ligne |
| Commentaire / compte-rendu | Bloqué (lié au statut) |
| Envoi WhatsApp à la régie | Bloqué : contact régie, modèles et étude relus en ligne avant d'ouvrir WhatsApp |

Conclusion : le hors-ligne s'arrête au remplissage de l'étude. Tout ce qui clôt le RDV dépend du réseau, alors que WhatsApp lui-même s'ouvre très bien sans connexion (le message part dès que le téléphone retrouve du réseau).

## Ce qu'on construit

1. **Préchargement du "dossier de la journée"** : dès que le réseau est disponible (ouverture de l'app, retour du réseau, puis toutes les 15 min), l'app télécharge en priorité le RDV en cours et le suivant, puis tous les RDV restants du jour et ceux du lendemain, avec toutes leurs infos : fiche client, étude et photos existantes, RDV parent/R2, contacts WhatsApp de la régie, modèles de message, bouquets/gammes, surcoûts, aides, réglages financement, et les tuiles satellite autour de chaque adresse. Un indicateur sur chaque fiche du planning montre "disponible hors-ligne".
2. **Calcul et PDF 100 % locaux** : l'étude, la mensualité et le PDF (photos + annexe carte) sont générés depuis les données du téléphone.
3. **Photos hors-ligne** : stockées sur le téléphone, affichées et intégrées au PDF immédiatement, envoyées au retour du réseau.
4. **Clôture du RDV hors-ligne** : statut, fiche signature, commentaire et R2 enregistrés localement, visibles tout de suite dans le planning avec un petit indicateur "à synchroniser".
5. **WhatsApp sans réseau** : le récap (texte, ou PDF pour une signature) est construit localement et WhatsApp s'ouvre avec le message prêt, comme en ligne.
6. **Synchronisation fiable au retour du réseau** : envoi dans l'ordre (client → étude → photos → statut/vente), sans doublon, avec un écran listant ce qui est en attente et les éventuels conflits. Remplace la logique fragile de l'ancienne file (pas de fausses réponses "OK").

## Limites assumées
- Un RDV jamais préchargé (créé dans la journée sans réseau) n'aura pas sa carte satellite.
- La visualisation IA des panneaux reste en ligne uniquement ; le dessin manuel fonctionne hors-ligne.
- Les calculs de commissions côté serveur sont refaits à la synchronisation.

## Détails techniques
- IndexedDB : stores `day_pack` (référentiels par régie + dossiers RDV), `outbox` (opérations typées idempotentes avec `client_op_id`), `blobs` (photos/PDF).
- Couche `offlineRepo` lue par EtudeForm, SigneDialog, RdvStatusSelector, useWhatsAppNotification et signatureStudyPdf (lecture réseau → repli cache).
- Outbox rejouée par un worker unique au retour en ligne ; mapping IDs locaux → serveur ; upsert sur `client_op_id` pour éviter les doublons.
- Tuiles Leaflet préchargées (zoom 17–20, rayon ~150 m) dans le cache du service worker `/sw.js`, uniquement en production.
- Tests : rejouage de l'outbox dans l'ordre, idempotence, construction du récap WhatsApp depuis le cache.
