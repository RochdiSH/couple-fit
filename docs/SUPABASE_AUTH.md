# Configuration et connexion Supabase

L’authentification et la synchronisation utilisent `supabase-js` v2.119.2, servi localement depuis `vendor/` et inclus dans le cache PWA. Ce choix évite un CDN à l’exécution et permet de charger l’interface hors ligne après son installation initiale. Le SDK est distribué sous licence MIT ; l’avis est fourni dans `vendor/LICENSE-supabase-js.txt`.

## Renseigner les valeurs publiques

Ouvre `supabase-config.js` et remplace les deux chaînes vides :

```js
export const SUPABASE_URL = 'https://<project-ref>.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...';
```

Ces deux valeurs sont publiques et accessibles dans les paramètres API du projet Supabase. N’y ajoute jamais de mot de passe, `service_role`, `sb_secret` ou autre secret. Le module client refuse les clés ayant l’apparence d’une clé secrète. Après modification, recharge l’application et laisse le service worker installer son nouveau cache.

## Essai dans un navigateur

1. Renseigne l’URL et la Publishable Key dans `supabase-config.js`.
2. Lance `npm test` pour les tests unitaires.
3. Depuis la racine, démarre un serveur local HTTP, par exemple `python3 -m http.server 8000`.
4. Ouvre `http://localhost:8000/` dans un navigateur. Le serveur doit fournir les fichiers statiques sous le même chemin relatif que GitHub Pages.
5. Connecte-toi avec le compte Auth existant. Au premier appareil, la base locale de développement est alors associée à son `auth.uid()`. Choisis Rochdi ou Rania ; la connexion n’importe ni n’envoie de données sportives.
6. Recharge la page pour vérifier la restauration de session. Dans Réglages, déconnecte-toi puis reconnecte-toi. Les erreurs de réseau et d’identifiants sont affichées sans recopier les identifiants.
7. Dans les outils développeur, vérifie l’installation du service worker et le cache `roch-rania-v2-sync`. Après son installation complète, recharge avec le réseau désactivé pour vérifier le chargement de l’interface, des modules et du SDK.

Sur GitHub Pages sous un chemin tel que `/couple-fit/`, les scripts et ressources utilisent des URL relatives (`./...`) ; le test local à la racine valide les fichiers, mais le déploiement Pages doit aussi être vérifié au préfixe `/couple-fit/`.

## Identité et données locales

La session Supabase est persistée par le SDK dans le stockage Web et renouvelée automatiquement lorsque le réseau le permet. Le mot de passe n’est jamais persisté par l’application. L’utilisateur peut choisir Rochdi ou Rania après authentification ; le stockage de ces profils reste local et séparé.

Au premier succès Auth, `auth.uid()` est associé à cet appareil via `localStorage` (`forgefit-auth-owner`). Si un autre compte se connecte ensuite, l’application bloque l’accès sportif, ferme la connexion IndexedDB en mémoire et conserve toutes les données et la liaison existantes. Se déconnecter ne supprime pas cette liaison.

La session persistée permet la reprise hors ligne tant qu’elle reste utilisable localement. Une authentification nouvelle, une session nécessitant un renouvellement sans réseau ou une déconnexion requièrent Internet. Aucun accès sportif n’est offert à une session absente.

La synchronisation sportive et la procédure de test à deux appareils sont détaillées dans [SUPABASE_SYNC.md](SUPABASE_SYNC.md).
