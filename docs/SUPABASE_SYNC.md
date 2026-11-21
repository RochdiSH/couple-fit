# Synchronisation IndexedDB ↔ Supabase

## Contrat SQL consommé

Le frontend utilise le contrat de `supabase/migrations/20261121000000_sync_schema.sql` sans le modifier :

- `apply_sync_batch(p_op_id uuid, p_changes jsonb)` ; les entrées sont `profile_id`, `entity`, `record_id`, `expected_version`, `deleted`, `payload`.
- `entity` vaut `program`, `cycle`, `session`, `profile_state` ou `active_session`.
- Les réponses RPC sont `status: applied` avec `op_id` et `records[{entity,record_id,version}]`, ou `status: conflict` avec les snapshots distants dans `conflicts`.
- La lecture de l’état courant passe par `sync_records`; le rattrapage incrémental passe par `sync_record_history`, filtré par `profile_id` et parcouru avec `change_id`.
- Les lots comptent au plus 100 changements, portent sur un seul profil et ne transmettent jamais `owner_id` (dérivé par le RPC de `auth.uid()`).
- `active_session/current` est le seul emplacement de séance active pour chaque profil. Les opérations cycle+`profile_state` et fin de séance+suppression logique de l’emplacement actif sont envoyées ensemble.

## Stockage et reprises

IndexedDB passe en version 3 de façon additive : aucun store existant n’est supprimé. `outbox` reçoit une opération après chaque écriture sportive dans la même transaction IndexedDB. `syncMeta` contient les versions serveur par enregistrement, le curseur d’historique, l’état de première liaison et la date de dernière réussite.

Chaque opération conserve un `opId` et un payload préparé avant l’appel réseau. Une erreur réseau garde l’opération telle quelle pour que la nouvelle tentative réutilise le même `op_id`. Une réponse de conflit fige l’opération et suspend les opérations suivantes ; les versions locale et distante ne sont jamais choisies automatiquement.

Les programmes sont envoyés avant les cycles, l’état du profil, les séances terminées puis la séance active. Un snapshot d’import sépare les lots en conservant les transitions de cycle dans un même appel RPC. Les changements distants s’appliquent sans créer d’entrée d’outbox et avec leurs versions dans une transaction locale. Les suppressions locales d’un import deviennent des tombstones côté serveur.

La synchronisation se lance après les écritures locales, au retour réseau, à l’ouverture/au premier plan et depuis Réglages. Aucun travail en arrière-plan continu n’est supposé, ce qui convient à Safari iOS. En cas d’expiration du jeton, Auth renouvelle la session si le réseau le permet ; une erreur laisse la file locale intacte.

## Première synchronisation

- **Local vide, cloud rempli :** restauration des enregistrements courants et versions, puis rattrapage de l’historique depuis un curseur capturé avant la lecture du snapshot.
- **Local rempli, cloud vide :** bouton de confirmation explicite avant envoi. Les anciennes entrées locales d’outbox non encore envoyées sont remplacées par un snapshot local complet dans une transaction, sans RPC antérieure à cette confirmation.
- **Local et cloud remplis :** aucun choix automatique. « Fusionner » restaure les objets cloud absents et envoie les objets locaux absents ; une même clé avec des contenus différents devient un conflit conservé. « Restaurer depuis le cloud » est une action explicite et exige une outbox vide.

Un conflit bloque le lot et laisse l’outbox ainsi que les données locales disponibles. Dans cette version, l’application affiche le conflit et propose l’export local ; l’interface de résolution champ par champ ou de choix local/cloud reste une évolution ultérieure. Ne supprime pas manuellement les stores `outbox` ou `syncMeta` pour débloquer une synchronisation.

L’import JSON conserve `outbox` et `syncMeta`. S’il existe une opération en attente ou en conflit, l’import est refusé avant de vider les stores sportifs. Après une synchronisation initiale, l’import place ses différences ordonnées dans l’outbox dans la même transaction que le remplacement local.

## Test à deux appareils

Avant cet essai, vérifie que les deux appareils utilisent la même version déployée, la même Project URL/Publishable Key, et le même compte Auth. Les tests automatisés ne se connectent pas au projet hébergé.

1. Sur l’appareil A, connecte-toi, choisis `me`, puis accepte le premier envoi si les données locales doivent devenir la source initiale. Vérifie l’état « Synchronisé » et la date de dernière réussite.
2. Sur l’appareil B, connecte-toi au même compte et choisis `me`. Une base locale vide doit être restaurée depuis le cloud. Vérifie programmes, cycle, progression, historique et séance active.
3. Sur A, modifie un programme ou termine une séance. Attends le statut synchronisé, puis mets B au premier plan. Confirme l’arrivée de la modification, des charges et de la séance dans le calendrier.
4. Sur A, désactive le réseau, modifie une donnée, puis vérifie « En attente ». Réactive le réseau et attends le retour à l’état synchronisé ; recommence après fermeture/réouverture de l’application pour vérifier l’outbox durable.
5. Pour provoquer un conflit, modifie le même programme ou démarre une séance sur les deux appareils hors ligne, puis reconnecte-les successivement. Vérifie qu’un appareil affiche un conflit et que les versions ne sont pas écrasées silencieusement. Une séance active concurrente doit viser `active_session/current` et entrer en conflit.
6. Vérifie séparément le profil `wife` sur les deux appareils. Ses bases et curseurs doivent rester indépendants de `me`.
7. Recommence avec un navigateur/appareil neuf pour vérifier la restauration. Teste enfin `Export JSON V2`, puis tente un import avec une outbox en attente : l’import doit être refusé sans supprimer l’opération.

Une confirmation visuelle dans l’application ne suffit pas à valider la rétention côté serveur : pour audit, utiliser le SQL Editor en lecture seule sur `sync_records` et `sync_record_history`, filtré par `profile_id` et les `record_id` attendus. Ne réexécute pas la migration pendant le test.
