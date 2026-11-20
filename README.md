# ForgeFit V3 — Choix utilisateur à la première ouverture

Au premier lancement, choisir **Rochdi** ou **Rania**. Le choix est conservé dans le stockage local du téléphone et les ouvertures suivantes affichent directement le programme correspondant. Chaque profil utilise sa propre base IndexedDB. Dans Réglages, **Changer d’utilisateur** réaffiche le choix sans effacer les données.

Si vous installez la même PWA sur deux iPhone, le choix est indépendant sur chaque téléphone et il n’y a pas de synchronisation cloud. Les sauvegardes JSON sont propres à chaque profil.

# ForgeFit V2 — Deux profils

Application PWA hors ligne, deux profils séparés sur le même iPhone : **Mon programme** et **Programme femme**.

## Installation
Déployer les fichiers de `forgefit/` à la racine d’un hébergement HTTPS statique (par exemple GitHub Pages). Ouvrir dans Safari sur iPhone, Partager → Sur l’écran d’accueil. Les fichiers et illustrations sont mis en cache après la première ouverture en ligne.

## Données
Deux bases IndexedDB indépendantes sur le même navigateur/origine : `forgefit-db` et `forgefit-wife-db`. Changer de profil sur l’accueil. Export JSON par profil dans Réglages, à faire régulièrement. Le programme existant du profil principal est conservé lors d’une mise à jour V1 → V2. Pour remplacer une ancienne routine Lower B personnalisée, utiliser « Restaurer le programme initial » depuis Réglages du profil principal ; ceci réinitialise les quatre routines, mais conserve l’historique.

## Programmes
- Profil principal : Upper A / Lower A / Upper B / Lower B, quatre séances productives, football le week-end : déplacer Lower B selon le match et la récupération.
- Profil femme : Lower A fessiers / Upper A / Lower B fessiers / Upper B, avec travail complet du corps. Le niveau, la tolérance à l’effort et les disponibilités de la personne doivent être confirmés avant d’appliquer les charges et volumes.
- RIR 2 typique ; charges initiales volontairement vides ; double progression : atteindre le haut de la fourchette sur toutes les séries au RIR visé puis augmenter la charge au plus petit incrément disponible.
- Illustrations photographiques **indicatives** intégrées hors ligne, non démonstrations techniques exhaustives : plusieurs exercices partagent une image représentative de leur famille de mouvement.

## Limites
Pas de Garmin Connect IQ, pas de synchronisation cloud ni entre deux téléphones. Le stockage local peut disparaître en cas d’effacement des données Safari ou de suppression de la PWA. Minuteur en arrière-plan iOS non garanti. Ne pas utiliser les images comme unique source d’apprentissage de la technique.

## Références scientifiques
- Krause Neto et al. (2025), *The impact of resistance training on gluteus maximus hypertrophy*: https://pmc.ncbi.nlm.nih.gov/articles/PMC12018462/
- Pelland et al. (2026), volume et fréquence : https://pubmed.ncbi.nlm.nih.gov/41343037/
- Plotkin et al. (2023), hip thrust vs squat : https://pubmed.ncbi.nlm.nih.gov/37461495/


## V4 — Motivation
- Accueil Rania : « Rania va tout casser ! C’est une bête 🔥 ».
- Après chaque série cochée, un encouragement apparaît (phrases différentes pour Rochdi et Rania).
- Réglages : lecture vocale facultative, désactivée par défaut. Sur iOS, la synthèse vocale dépend du navigateur et de ses restrictions.
- Les messages encouragent l'effort sans pousser à ignorer la douleur ou la technique.
