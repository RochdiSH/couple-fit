# ROCH&RANIA FIT

PWA locale de musculation, construite en HTML, CSS et JavaScript natifs. Les données sont stockées dans IndexedDB, séparément pour Rochdi et Rania. L'application fonctionne hors ligne après son premier chargement en ligne.

## Développement

Les tests automatisés utilisent le runner intégré à Node.js, sans dépendances externes :

```sh
npm test
```

Servir les fichiers depuis une origine HTTPS (ou `localhost`) pour utiliser le service worker et IndexedDB.

## Modèle V2

- `data.js` définit la validation des programmes, cycles, séances et sauvegardes, le dépôt IndexedDB et les règles d'activation.
- L'écran « Mes programmes » permet d'importer un fichier JSON d'un seul programme ou de le modifier dans l'éditeur JSON. L'import d'un programme écrit uniquement cette entrée et conserve les cycles et l'historique ; réimporter le même identifiant met à jour sa révision.
- Chaque profil possède une bibliothèque indépendante. Un programme a un identifiant stable, une révision, une durée indicative et les quatre séances `upper-a`, `lower-a`, `upper-b`, `lower-b`.
- Un cycle conserve un snapshot du programme utilisé. Sa semaine indicative est calculée depuis la date de début. Terminer ou activer un cycle ne se fait jamais automatiquement et ces actions sont refusées pendant une séance active.
- Les séances terminées référencent leur profil, programme, cycle et séance. Les exercices transportent un identifiant stable pour suivre les performances entre programmes.
- L'onglet Calendrier construit ses jours terminés à partir de `sessions.finished` et du profil actif ; aucun store de calendrier n'est utilisé. Les clés de jour sont calculées en heure locale.
- IndexedDB V3 conserve les stores existants, ajoute `outbox` et `syncMeta`, et ne supprime aucun store lors d'une mise à niveau. Chaque profil garde sa base locale (`forgefit-db` et `forgefit-wife-db`).
- L'export JSON V2 contient programmes, cycles, historique, état du profil, séance active et minuteur. L'import V2 remplace les données du profil après confirmation. Les exports V1 ne sont pas pris en charge.

Les programmes d'entraînement seront fournis ultérieurement en données structurées ; aucun contenu sportif n'est préchargé dans cette version. La synchronisation Supabase par enregistrement conserve IndexedDB comme source locale hors ligne.

## PWA

Le service worker met en cache l'interface et ses modules JavaScript. Incrémenter le nom du cache lors des modifications de ressources afin que les appareils installés récupèrent la nouvelle version.

## Connexion et synchronisation Supabase

La configuration Auth est décrite dans [docs/SUPABASE_AUTH.md](docs/SUPABASE_AUTH.md). Le contrat client, l'outbox, les choix de première synchronisation et les essais à deux appareils sont décrits dans [docs/SUPABASE_SYNC.md](docs/SUPABASE_SYNC.md).
