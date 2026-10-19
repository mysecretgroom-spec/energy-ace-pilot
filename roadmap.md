# Roadmap

## En cours
- [x] Revérifier le rendu des aperçus : photos portrait/paysage, défilement, zoom, PDF 2 pages et réouverture sur téléphone simulé/ordinateur ; correction du zoom qui décalait la photo hors écran, 8 tests réussis et aucune erreur navigateur ; fichiers de contrôle seulement (aucun document accessible sur le compte), iPhone physique non vérifié.
- [x] Téléchargements : enregistrement natif mobile, téléchargement système ordinateur et nouveau tap Enregistrer si préparation longue ; 8 tests réussis, PDF/PNG téléchargés et relus, appel natif simulé vérifié connecté ; feuille OS sur iPhone physique non vérifiée.
- [x] Aperçus documents/photos unifiés (dossier client, scan, imports, factures, simulations) : miniature → plein écran sobre, défilement latéral, zoom et pages PDF ; 5 tests et parcours connecté avec documents de contrôle sur téléphone/ordinateur sans erreur ; appareil iPhone physique et fichiers privés réels non testés.
- [x] Caméra intégrée principale : capture/Terminé sécurisés, notifications non bloquantes, carrousel sans déformation ; 21 tests réussis et 3 captures simulées → original/retrait → PDF 2 pages vérifiés connecté sur téléphone/ordinateur sans erreur ; iPhone physique non testé.
- [x] Fiche flottante centrée à l'écran (RDV et pose) sur ordinateur et tablette, toujours en feuilletant depuis le bas sur téléphone, fond sombre couvrant tout l'écran ; parcours vérifié dans le navigateur sur deux cartes réelles
- [x] Mentions IA sur les visuels générés : badge « IA » et légende « généré par IA » dans l'app, badge IA superposé, légende et mention « Visuels générés par IA — rendus non contractuels » dans l'annexe carte de tous les PDF d'étude (aperçu, téléchargement, enregistré, signature) ; 5 tests réussis
- [x] Scanner après le PDF de Nathalie Rey : correction locale protégeant l’encre, détails bornés, intermédiaires sans compression et PDF jusqu’à 3072 px ; photo haute résolution native et orientation sans double rotation ; 31 tests réussis, import réel fourni/aperçu/confirmation identique/export PDF et parcours téléphone vérifiés ; flou optique existant et ombres résiduelles non récupérables entièrement, appareil iPhone et WhatsApp réels non testés
- [x] Scanner : feuille distinguée du bureau sur la photo extraite de IMG_3141, ajustement et aperçu obligatoires avant confirmation ; 30 tests réussis, parcours connecté et export PDF vérifiés sur ordinateur/téléphone ; caméra iPhone physique et envoi WhatsApp réel non revérifiés
- [x] Scanner : redressement automatique, ombres et contraste activés par défaut ; 24 tests réussis et import incliné/ombragé, aperçu puis confirmation vérifiés connecté, sans erreur de rendu ; PDF d’étude et caméra iPhone physique non revérifiés
- [x] Capture avant PDF : rejet des images caméra non décodées, cadrage redétecté sur la photo et confirmation obligatoire, suppression du double démarrage ; 18 tests réussis et deux pages confirmées avec caméra simulée, sans erreur de rendu
- [ ] Capture iPhone réel avant PDF : bloquée sans accès à un appareil physique ; parcours étude/PDF réel et défauts optiques iPhone non vérifiés
- [x] Scanner : détection multi-seuils de la page plutôt que du fond, coins accessibles et aperçu du résultat ; 8 tests réussis et import/Scan net/aperçu/confirmation vérifiés connectés sur la photo extraite de IMG_3131 ; image déjà compressée avec cadre incrusté, caméra iPhone non vérifiée
- [ ] Analyse REA de CamScanner : bloquée sans application/artefact fourni ; seules les fonctions publiques ont été comparées, aucun moteur propriétaire analysé
- [x] Scan direct en fin d’étude remplaçant le téléchargement photos ; scans rattachés à l’étude et inclus dans aperçu/export/stockage/signature selon le mode HEJJA existant ; 12 tests réussis, parcours connecté avec image de contrôle et PDF de 3 pages vérifié ; caméra iPhone/envoi WhatsApp réel non vérifiés
- [x] Scanner PWA : REA activé pour analyses futures (pas d’artefact CamScanner fourni) ; Scan net, correction locale des ombres, original consultable, rotation/coins fiabilisés et éditeur partagé ; 5 tests réussis, capture caméra simulée/import/PDF vérifiés connectés sur ordinateur et téléphone ; caméra iPhone physique non vérifiée
- [x] Vérifier 14 pages principales/publiques ; corriger les erreurs client/vente/CRM et la vérification d’accès, ajouter une reprise globale ; 4 tests réussis et reprise après panne vérifiée sur ordinateur/téléphone (compte sans dossiers, sous-pages non exhaustives)
- [x] Visualisation PV : repère transmis aux deux boutons avec coordonnées et gros plan ; essai satellite réel sur la toiture sélectionnée confirmé, précision du nombre non garantie
- [x] Hors-ligne RDV : paramètres régie (prix, gammes, aides, financements, surcoûts) préchargés et utilisés par l’étude
- [x] Hors-ligne RDV : préchargement RDV en cours + suivant puis jour/lendemain (infos client, étude, régie, modèles WhatsApp, bouquets, surcoûts, tuiles satellite)
- [x] Hors-ligne RDV : prochain client (adresse, téléphone, itinéraire) affiché sans réseau
- [x] Hors-ligne RDV : statut, signature, R2, vente enregistrés sur le téléphone et rejoués sans doublon ; récap WhatsApp construit depuis les données enregistrées
- [ ] Hors-ligne RDV : photos stockées sur le téléphone et PDF d'étude généré sans réseau (étape suivante)
- [ ] Hors-ligne RDV : écran détaillé des envois en attente / conflits
- [x] Ajouter le placement manuel des panneaux par zone sur la carte et dans l’annexe PDF ; 11 tests réussis et interactions vérifiées ; relecture d’une étude sauvegardée non vérifiée (aucune étude sur le compte de contrôle)
- [x] Rétablir le PDF avec le message de signature WhatsApp ; tests du partage texte + fichier réussis, autres statuts inchangés ; envoi réel iPhone non vérifié
- [x] Aligner le cadrage toiture étude/PDF ; 6 tests et comparaison visuelle au zoom 20 réussis (relecture d'une étude enregistrée non vérifiée : aucune étude accessible sur la session de contrôle)
- [x] Remplacer les PDF des messages aux régies par consommation, puissance, prix, mensualité et commentaire commercial ; tests d'envoi texte réussis
- [x] Conserver le CQ enregistré en tête des positifs et les informations du rendez-vous initial ; tests de données réussis
- [x] Masquer la Prime Coup de Pouce Producteur du récapitulatif des aides (formulaire d'étude, HEJJA, PDF, WhatsApp)
- [x] Traiter la Prime Coup de Pouce Producteur comme une charge société répercutée sur le prix TTC
- [x] Arrondir cette charge au multiple de 500 € supérieur et itérer sur la mensualité
- [ ] Vérifier en preview que les totaux restent cohérents

## Reste à faire
- [ ] Assainir l'architecture globale (suite du chantier de nettoyage)
- [ ] Appliquer une règle de prix + une aide via Paramétrage assisté et vérifier études/commissions
- [x] Outil d'étude : bouton d'édition des infos client + adresse d'installation distincte
- [x] Agent : exécution directe sans validation + compréhension d'entrées libres
- [x] Mémoire par régie dans Paramètres (règles/grilles/aides prioritaires sur les apprentissages généraux)
- [x] RDV négatif : WhatsApp au technicien avec commentaire, sans PDF d'étude ni photos

- [ ] Vidéo v3 1min20 : vraie interface (itinéraire RDV, long touch étude, dossiers en cours, RDV installation doré + com, factures WhatsApp + scan mail), voix plus humaine

## Abonnements & paiement
- [x] Offres Classique / Premium (mensuel + annuel 2 mois offerts), recharges IA 5/20/50 €
- [x] Montée immédiate / baisse à l'échéance, portail de gestion, quotas IA 10/15 €
- [x] Suppression des anciens liens Stripe, verrouillage des fonctions de changement d'accès
- [ ] Pages légales (CGV/remboursement/confidentialité) conformes — en attente de la raison sociale
- [ ] Test d'achat manuel en aperçu avec carte de test

## Latence (audit 19/10)
- [x] Base : index RDV, purges par lots, historique Google allégé
- [x] Lectures répétées : tâches de fond + session stable
- [ ] RDV/clients : charger seulement la période affichée (à faire écran par écran)
- [ ] Écran Étude découpé ; moteur scanner unique ; suivi des temps
- [ ] Démarrage : vérifications d'accès en parallèle
- [x] Étude : PDF auto seulement si modification
- [x] Latence création de document (scanner → enregistrement)
- [x] Latence des appels IA
- [x] Nom de doc avec heure:minute:seconde (éviter faux doublons)
- [x] Long-press RDV : bouton ajouter/scanner docs au dossier client (si étude existe)
- [x] Long-press RDV : bouton envoyer dossier complet WhatsApp (même que fin d'étude)
