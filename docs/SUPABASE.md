# Préparer la base Supabase

Cette étape ajoute uniquement le schéma SQL et ses tests. Aucun SQL n'a été exécuté sur le projet Supabase. Le frontend utilisera plus tard la Project URL et la Publishable Key ; cette clé publique ne donne accès qu'aux lignes permises par la RLS. Une clé `service_role` ou une clé secrète ne doit jamais être livrée dans le navigateur.

## Fichiers

- `supabase/migrations/20261121000000_sync_schema.sql` : migration versionnée avec tables, contraintes, index, RLS et RPC transactionnelle.
- `supabase/tests/database/sync_schema_test.sql` : 54 assertions pgTAP sur les politiques, permissions, versions, suppressions, transitions de cycles, opérations idempotentes et atomicité.

## Modèle et garanties

`sync_records` conserve la version courante d'un enregistrement. Sa clé est `(owner_id, profile_id, entity, record_id)`. `owner_id` est exclusivement dérivé de `auth.uid()` dans le RPC, jamais fourni par le navigateur. `profile_id` ne peut valoir que `me` ou `wife`.

`sync_record_history` ajoute une ligne à chaque version appliquée et conserve les tombstones. `sync_operations` mémorise le résultat associé à `(owner_id, op_id)` : le même identifiant et le même contenu renvoient le résultat antérieur ; réutiliser cet identifiant avec un autre contenu est refusé.

Le client ne dispose que du droit de lecture sur les lignes qui lui appartiennent. Les écritures sont faites par `apply_sync_batch(op_id, changes)` : chaque changement donne une clé, une `expected_version`, un payload et un indicateur `deleted`. Une version périmée retourne un résultat `conflict` avec la version distante ; aucune donnée du lot n'est écrite. Le résultat de conflit est enregistré avec l'`op_id` : une répétition après réponse perdue retourne le même résultat, même si le serveur a depuis avancé. Résoudre le conflit doit donc créer une nouvelle opération avec un nouvel `op_id`. Les lots sont limités à un profil pour garder les écritures composites cohérentes et simples.

Les séances actives utilisent la clé fixe `active_session/current` par profil. Deux appareils qui démarrent hors ligne en partant de la version zéro ne peuvent donc pas créer deux séances actives : le premier envoi accepté crée la ligne, l'autre reçoit un conflit et garde son changement local en attente de résolution. Les versions de la séance active continuent ensuite d'utiliser le contrôle CAS.

Un trigger différé compte les cycles `active` non supprimés et rejette le lot s'il en trouve plus d'un. Il valide aussi les références du lot complet : cycle vers programme, séance terminée vers cycle/programme correspondants, état de profil vers l'unique cycle actif et séance active vers ce cycle actif. Cette unicité différée autorise la transition atomique entre deux cycles, contrairement à un index partiel immédiat.

Les suppressions ne retirent pas la ligne : le RPC met `deleted_at` et enregistre cette version dans l'historique. Un programme tombstoné ne peut pas être utilisé par un cycle actif ; un cycle terminé peut toutefois conserver son lien vers ce programme, et une séance terminée peut conserver son lien vers un cycle tombstoné. Un cycle actif ne peut pas être tombstoné. Les clés étrangères vers `auth.users` n'ont pas de cascade : supprimer le compte Auth est refusé tant que des données synchronisées existent, afin de ne pas effacer l'historique par accident. La RLS filtre les tables courantes et historiques par `owner_id = auth.uid()`. Les reçus d'opération ne sont pas lisibles directement depuis le client.

## Exécuter les tests localement

Les tests sont destinés à une base Supabase locale, jamais au projet hébergé :

1. Installer Docker et la [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Initialiser la configuration locale Supabase dans une branche de travail si elle n'existe pas (`supabase init`).
3. Démarrer le stack (`supabase start`), puis reconstruire la base locale depuis les migrations (`supabase db reset`). Cette commande efface la base locale ciblée.
4. Lancer `supabase test db` depuis la racine du dépôt. La migration versionnée est appliquée avant le fichier pgTAP.

Supabase CLI exécute les fichiers de `supabase/tests` avec pgTAP contre le stack local. Ne pas utiliser les options `--linked`, `--db-url` ou un projet distant pour ces tests. [Guide de tests SQL Supabase](https://supabase.com/docs/guides/database/testing), [commande `supabase test db`](https://supabase.com/docs/reference/cli/supabase-test)

## Appliquer ultérieurement sur le projet hébergé

Après validation du schéma et des tests locaux :

1. Ouvrir le projet attendu dans Supabase Dashboard et vérifier son identifiant avant toute opération.
2. Ouvrir **SQL Editor**, créer une nouvelle requête et coller le contenu entier de `supabase/migrations/20261121000000_sync_schema.sql`.
3. Lire les commandes avant exécution, puis exécuter une seule fois et vérifier que les trois tables, policies et RPC sont créées.
4. Ne pas exécuter le fichier de tests sur le projet hébergé : il crée des utilisateurs de test dans `auth.users` et est conçu pour être rollback local.
5. Conserver une sauvegarde JSON de l'application avant le futur premier raccordement du frontend.

L'exécution manuelle dans SQL Editor ne renseigne pas l'historique des migrations CLI. Si le projet est ensuite géré avec `supabase db push`, il faudra d'abord aligner l'historique des migrations ; le flux recommandé est de valider localement, puis d'appliquer la migration avec la CLI. Voir le [guide officiel de déploiement des migrations](https://supabase.com/docs/guides/deployment/database-migrations).

Cette documentation décrit la procédure, elle ne constitue pas une autorisation d'exécuter le SQL. Le RPC `SECURITY DEFINER` est volontairement dans `public` pour être appelable par Supabase JS : il épingle `search_path` à la chaîne vide, dérive le propriétaire de `auth.uid()`, révoque l'exécution à `anon`, `PUBLIC` et `service_role`, et n'accepte aucun `owner_id`. Les tables n'accordent aucune écriture directe à `anon`, `authenticated` ou `service_role`. La fonction de trigger est elle aussi inaccessible directement. Les rôles de propriétaire de base de données restent naturellement privilégiés et ne doivent pas être exposés à l'application. Ces restrictions sont couvertes par pgTAP, mais doivent être exécutées avant le déploiement. [Conseils Supabase sur RLS et fonctions `SECURITY DEFINER`](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Configuration frontend future

La future configuration publique contiendra seulement la Project URL et la Publishable Key. Elles identifient le projet mais n'accordent pas de droits en dehors des politiques RLS. Les identifiants email/mot de passe ne seront pas persistés dans IndexedDB ; la session sera gérée par le client Supabase Auth. Aucun secret ni `service_role` ne doit apparaître dans le dépôt, le bundle, le service worker ou les sauvegardes.
