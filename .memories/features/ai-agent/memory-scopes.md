---
name: Portées de mémoire de l'agent
description: Deux types d'apprentissages agent — communs (globaux) et personnels (par utilisateur)
type: feature
---
La table `whatsapp_agent_memory` a une colonne `scope` :
- `global` : apprentissage commun à tous, `user_id` NULL. Lecture par tout utilisateur connecté, écriture réservée aux admins (`has_role(auth.uid(),'admin')`).
- `user` : apprentissage personnel, `user_id` obligatoire, visible/modifiable par son propriétaire uniquement.

Unicité : `(user_id, memory_type, key)` pour le scope user, index unique partiel `(memory_type, key) WHERE scope='global'`.

L'agent charge les deux jeux ; en cas de même `memory_type|key`, la mémoire personnelle prime sur la commune. Les mémoires communes sont marquées `[commun]` dans le prompt.

UI : `AgentMemoryManager` affiche deux onglets « Pour vous » / « Communes ». Le bouton « Tout effacer » ne touche que les mémoires personnelles.
