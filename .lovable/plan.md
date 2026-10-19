# Audit de latence — DébalePro

## Ce qui a été mesuré
- Requêtes les plus lentes de la base (cumul depuis le dernier redémarrage).
- Tâches qui se répètent automatiquement dans l'app.
- Taille des pages les plus lourdes.

## Constats (par ordre d'impact pour l'utilisateur)

1. **Historique de synchro Google qui gonfle** — 7 676 écritures, 11 000 lignes, 24 Mo. Le nettoyage a pris jusqu'à 20 s, et la purge des images WhatsApp jusqu'à 63 s. Ces gros nettoyages bloquent la base pendant que les commerciaux travaillent.
2. **Suivi des tâches de fond appelé 1 415 fois** (moyenne 48 ms, pic 0,8 s) alors qu'il n'y a que 39 tâches : interrogation répétée, en plus d'une écoute en temps réel déjà en place.
3. **Chargement de la liste RDV / clients sans limite** — plusieurs lectures récupèrent tous les RDV d'un utilisateur, sans tri par date ni pagination (pics de 1,4 à 1,9 s).
4. **Fiche client** : RDV relus avec la régie à chaque ouverture (pic 0,8 s), sans cache partagé avec le planning.
5. **Écran Étude très lourd** (environ 5 900 lignes dans une seule page) : ouverture lente sur iPhone, et PDF régénéré automatiquement toutes les 5 minutes, même sans modification.
6. **Scanner** : analyse en direct déjà allégée ; il reste deux moteurs de détection en parallèle (ancien et nouvel écran caméra).
7. **Démarrage de l'app** : pages déjà chargées à la demande (73) et cache de 2 min, ce qui est correct ; les vérifications d'accès (abonnement, HEJJA) s'enchaînent au lieu d'être lancées en même temps.

## Plan proposé (chaque étape laisse l'app fonctionnelle)

1. **Base de données**
   - N'écrire dans l'historique Google que lors d'un vrai changement ou d'une erreur, et nettoyer par petits lots chaque nuit.
   - Purger les images WhatsApp expirées par petits lots, avec un index sur la date d'expiration.
   - Ajouter des index « utilisateur + date » sur les RDV et « client + date » pour la fiche client.
   - Vérification : comparer de nouveau le classement des requêtes lentes.
2. **Lectures répétées**
   - Tâches de fond : s'appuyer uniquement sur le temps réel, avec une lecture au retour dans l'app.
   - RDV et clients : ne charger que la période affichée (semaine dimanche–samedi) et les colonnes utiles, et partager le cache entre le planning, le CRM et la fiche client.
   - Vérification : compter les appels sur un parcours type (connexion → planning → fiche client → étude).
3. **Démarrage**
   - Lancer les vérifications d'accès en parallèle et précharger le planning juste après la connexion.
   - Vérification : mesurer le temps jusqu'au premier écran utilisable sur un téléphone simulé.
4. **Étude**
   - Découper l'écran Étude en sections chargées à l'ouverture.
   - Ne régénérer le PDF automatique qu'après une modification réelle.
   - Vérification : temps d'ouverture de l'étude et nombre de PDF générés.
5. **Scanner** : garder un seul moteur de détection pour les deux écrans caméra.
6. **Suivi continu** : mesure simple des temps de chargement par page et rapport hebdomadaire des requêtes lentes.

## Hors périmètre
- Le changement de serveur n'est pas nécessaire : les tables sont petites, la lenteur vient du nombre d'appels et des nettoyages.
- Pas de réécriture complète.

## Détails techniques
- Requêtes en cause : `background_jobs` (filtre utilisateur et statut, trié par date) ; `rdv` sélectionné par `user_id` sans LIMIT ni plage de dates ; `rdv` par `client_id` trié par `date_heure` ; DELETE de purge sur `google_sync_history` et `whatsapp_pending_images` ; INSERT dans `google_sync_history` à chaque synchronisation.
- Index prévus : `rdv(user_id, date_heure)`, `rdv(client_id, date_heure desc)`, `whatsapp_pending_images(expires_at)`.
- Purges en lots (DELETE … WHERE id IN (SELECT … LIMIT 1000)) planifiées la nuit.
