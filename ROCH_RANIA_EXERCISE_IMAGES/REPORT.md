# Rapport — images des exercices ROCH&RANIA FIT

Analyse et préparation effectuées le 21 novembre 2026 à partir de `PROGRAMMES_V2_SOURCE.md` et du catalogue JSON Free Exercise DB (876 entrées au moment du téléchargement). Aucun fichier de l’application n’a été modifié.

## Résumé

- Exercices uniques extraits : **28 pour Rochdi (`me`)** et **24 pour Rania (`wife`)**.
- Correspondances exercice/dataset retenues : **27/28 pour Rochdi** et **21/24 pour Rania**, soit **48 correspondances profil-exercice**.
- Images copiées dans les dossiers de livraison : **58 JPG originaux**, en paires `-0.jpg` / `-1.jpg`, total 3.93 MiB.
- **19 références Rania réutilisent sans duplication** les mêmes fichiers stockés dans `me/`.
- Apparence des modèles : les images candidates examinées montrent des modèles masculins; elles conviennent visuellement au brief Rochdi, mais **ne correspondent pas au brief visuel Rania**. Aucun visuel féminin n’a été inventé.
- Correspondances nécessitant une validation manuelle du mouvement/équipement : **1 exercice Rochdi**, **3 exercices Rania**. Pour Rania, les 21 correspondances téléchargées nécessitent en plus une décision explicite sur l’acceptation d’illustrations avec modèle masculin.

## Licence et provenance

- Catalogue et images téléchargés depuis [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), chemins d’images `exercises/{datasetId}/{0|1}.jpg`.
- Le dépôt présente le catalogue comme domaine public et son [`LICENSE.md` annonce l’Unlicense](https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md). Le README indique que les images sont distribuées dans le dépôt et fournit les chemins Raw GitHub.
- **Réserve importante :** le fil public [« images has copyright? »](https://github.com/yuhonas/free-exercise-db/issues/13) contient une question ouverte sur la provenance/licence des photos et le mainteneur évoque la possibilité de les remplacer par des placeholders. La licence déclarée par le dépôt n’apporte donc pas, à elle seule, une preuve indépendante des droits des photographies d’origine. L’inventaire marque ce statut comme à valider avant publication/distribution de l’application.
- Les JPG livrés sont les octets d’origine : pas de recadrage, redimensionnement, conversion, retouche ni ajout de variantes de genre. Chaque chemin source Raw, taille et SHA-256 figure dans `exercise-images.json`.
- Instantané du catalogue : SHA-256 `5bb747e3fc658f095a60dcbf6d53c96627acdcc6ffb6fffde86f7e26995d40bf`; source `main` téléchargée le 21-11-2026 (pas de commit immuable épinglé).

## Correspondances retenues

### Rochdi (`me`)

| ID Markdown | Exercice | Correspondance Free Exercise DB | Fichiers ou état | Note |
|---|---|---|---|---|
| `bench-barbell` | Développé couché barre | `Barbell_Bench_Press_-_Medium_Grip` — Barbell Bench Press - Medium Grip (barbell) | `me/bench-barbell-0.jpg`, `me/bench-barbell-1.jpg` | Grip moyen non précisé dans la source; mouvement et barre concordent. |
| `cable-row` | Rowing assis poulie basse | `Seated_Cable_Rows` — Seated Cable Rows (cable) | `me/cable-row-0.jpg`, `me/cable-row-1.jpg` | Tirage assis à poulie basse; le dataset illustre une poignée V neutre. |
| `incline-db-press` | Développé incliné haltères | `Incline_Dumbbell_Press` — Incline Dumbbell Press (dumbbell) | `me/incline-db-press-0.jpg`, `me/incline-db-press-1.jpg` | Correspondance directe. |
| `pullup-pronated` | Tractions pronation, lest si nécessaire | `Pullups` — Pullups (body only) | `me/pullup-pronated-0.jpg`, `me/pullup-pronated-1.jpg` | Consignes du dataset : prise en pronation. |
| `db-lateral-raise` | Élévations latérales haltères | `Side_Lateral_Raise` — Side Lateral Raise (dumbbell) | `me/db-lateral-raise-0.jpg`, `me/db-lateral-raise-1.jpg` | Correspondance directe; haltères debout. |
| `rope-triceps-pushdown` | Extension triceps corde | `Triceps_Pushdown_-_Rope_Attachment` — Triceps Pushdown - Rope Attachment (cable) | `me/rope-triceps-pushdown-0.jpg`, `me/rope-triceps-pushdown-1.jpg` | Correspondance directe; corde à la poulie. |
| `incline-db-curl` | Curl incliné haltères | `Incline_Dumbbell_Curl` — Incline Dumbbell Curl (dumbbell) | `me/incline-db-curl-0.jpg`, `me/incline-db-curl-1.jpg` | Correspondance directe. |
| `squat` | Squat barre (ou hack squat) | `Barbell_Squat` — Barbell Squat (barbell) | `me/squat-0.jpg`, `me/squat-1.jpg` | Correspond à la variante barre, prescrite dans les programmes 2 et 3; le programme 1 autorise aussi le hack squat. |
| `rdl` | Soulevé de terre roumain | `Romanian_Deadlift` — Romanian Deadlift (barbell) | `me/rdl-0.jpg`, `me/rdl-1.jpg` | Correspondance directe pour la variante barre de Rochdi. |
| `leg-press` | Presse à cuisses | `Leg_Press` — Leg Press (machine) | `me/leg-press-0.jpg`, `me/leg-press-1.jpg` | Correspondance directe; machine presse. |
| `seated-leg-curl` | Leg curl assis | `Seated_Leg_Curl` — Seated Leg Curl (machine) | `me/seated-leg-curl-0.jpg`, `me/seated-leg-curl-1.jpg` | Correspondance directe; machine assise. |
| `standing-calf` | Mollets debout | `Standing_Calf_Raises` — Standing Calf Raises (machine) | `me/standing-calf-0.jpg`, `me/standing-calf-1.jpg` | Mouvement debout correspondant; la photo impose une machine, matériel à confirmer dans la salle. |
| `cable-crunch` | Crunch à la poulie | `Cable_Crunch` — Cable Crunch (cable) | `me/cable-crunch-0.jpg`, `me/cable-crunch-1.jpg` | Correspondance directe; la photo utilise une corde. |
| `shoulder-press-db` | Développé épaules haltères assis | `Dumbbell_Shoulder_Press` — Dumbbell Shoulder Press (dumbbell) | `me/shoulder-press-db-0.jpg`, `me/shoulder-press-db-1.jpg` | Correspondance directe; dataset assis avec dossier. |
| `pullup-neutral` | Tractions prise neutre (ou pronation) | `Pullups` — Pullups (body only) | `me/pullup-neutral-0.jpg`, `me/pullup-neutral-1.jpg` | La source autorise explicitement la variante en pronation; même image que cette variante autorisée. |
| `chest-press-machine` | Chest press machine | `Machine_Bench_Press` — Machine Bench Press (machine) | `me/chest-press-machine-0.jpg`, `me/chest-press-machine-1.jpg` | Correspondance directe; instructions du dataset nomment une chest press machine. |
| `chest-supported-row` | Rowing poitrine appuyée | `Dumbbell_Incline_Row` — Dumbbell Incline Row (dumbbell) | `me/chest-supported-row-0.jpg`, `me/chest-supported-row-1.jpg` | Poitrine appuyée sur banc incliné, haltères. |
| `reverse-pec-deck` | Oiseau machine / reverse pec deck | `Reverse_Machine_Flyes` — Reverse Machine Flyes (machine) | `me/reverse-pec-deck-0.jpg`, `me/reverse-pec-deck-1.jpg` | Correspondance directe. |
| `overhead-triceps-cable` | Extension triceps au-dessus de la tête poulie | `Cable_Rope_Overhead_Triceps_Extension` — Cable Rope Overhead Triceps Extension (cable) | `me/overhead-triceps-cable-0.jpg`, `me/overhead-triceps-cable-1.jpg` | Extension au-dessus de la tête à la poulie; dataset avec corde. |
| `hammer-curl` | Curl marteau haltères | `Hammer_Curls` — Hammer Curls (dumbbell) | `me/hammer-curl-0.jpg`, `me/hammer-curl-1.jpg` | Correspondance directe; haltères. |
| `front-squat` | Front squat (ou goblet squat lourd) | `Front_Barbell_Squat` — Front Barbell Squat (barbell) | `me/front-squat-0.jpg`, `me/front-squat-1.jpg` | Correspondance directe. |
| `hip-thrust` | Hip thrust barre/machine | `Barbell_Hip_Thrust` — Barbell Hip Thrust (barbell) | `me/hip-thrust-0.jpg`, `me/hip-thrust-1.jpg` | Correspond à la variante barre autorisée. |
| `bulgarian-split-squat` | Fentes bulgares | `Split_Squat_with_Dumbbells` — Split Squat with Dumbbells (dumbbell) | `me/bulgarian-split-squat-0.jpg`, `me/bulgarian-split-squat-1.jpg` | Pied arrière surélevé : la description du dataset correspond au split squat bulgare; haltères montrés. |
| `lying-leg-curl` | Leg curl allongé | `Lying_Leg_Curls` — Lying Leg Curls (machine) | `me/lying-leg-curl-0.jpg`, `me/lying-leg-curl-1.jpg` | Correspondance directe; machine allongée. |
| `seated-calf` | Mollets assis | `Seated_Calf_Raise` — Seated Calf Raise (machine) | `me/seated-calf-0.jpg`, `me/seated-calf-1.jpg` | Correspondance directe; machine assise. |
| `plank` | Gainage planche | `Plank` — Plank (body only) | `me/plank-0.jpg`, `me/plank-1.jpg` | Correspondance directe. |
| `cable-lateral-raise` | Élévations latérales poulie | Aucune correspondance exacte retenue | Validation manuelle | Le seul candidat trouvé est assis; la source ne précise pas cette variante corporelle. Aucun JPG téléchargé pour éviter de substituer une variante. |
| `hack-squat` | Hack squat machine | `Hack_Squat` — Hack Squat (machine) | `me/hack-squat-0.jpg`, `me/hack-squat-1.jpg` | Correspondance directe; machine. |

### Rania (`wife`)

| ID Markdown | Exercice | Correspondance Free Exercise DB | Fichiers ou état | Note |
|---|---|---|---|---|
| `chest-press-machine` | Chest press machine | `Machine_Bench_Press` — Machine Bench Press (machine) | `me/chest-press-machine-0.jpg`, `me/chest-press-machine-1.jpg` | Correspondance directe; machine. |
| `cable-row` | Rowing poulie basse | `Seated_Cable_Rows` — Seated Cable Rows (cable) | `me/cable-row-0.jpg`, `me/cable-row-1.jpg` | Correspondance directe; tirage assis à poulie basse. |
| `shoulder-press-db` | Développé épaules haltères | `Dumbbell_Shoulder_Press` — Dumbbell Shoulder Press (dumbbell) | `me/shoulder-press-db-0.jpg`, `me/shoulder-press-db-1.jpg` | Correspondance directe; dataset assis avec dossier, position non spécifiée dans le tableau Rania. |
| `assisted-pullup` | Tractions avec assistance par élastique si disponible (sinon variante à valider) | `Band_Assisted_Pull-Up` — Band Assisted Pull-Up (other) | `wife/assisted-pullup-0.jpg`, `wife/assisted-pullup-1.jpg` | Correspond à la variante conditionnelle assistée par bande; disponibilité/sécurité de la bande à valider. |
| `db-lateral-raise` | Élévations latérales haltères | `Side_Lateral_Raise` — Side Lateral Raise (dumbbell) | `me/db-lateral-raise-0.jpg`, `me/db-lateral-raise-1.jpg` | Correspondance directe; haltères. |
| `rope-triceps-pushdown` | Extension triceps corde | `Triceps_Pushdown_-_Rope_Attachment` — Triceps Pushdown - Rope Attachment (cable) | `me/rope-triceps-pushdown-0.jpg`, `me/rope-triceps-pushdown-1.jpg` | Correspondance directe; corde. |
| `hammer-curl` | Curl marteau | `Hammer_Curls` — Hammer Curls (dumbbell) | `me/hammer-curl-0.jpg`, `me/hammer-curl-1.jpg` | Correspondance directe; haltères. |
| `hip-thrust` | Hip thrust barre ou machine | `Barbell_Hip_Thrust` — Barbell Hip Thrust (barbell) | `me/hip-thrust-0.jpg`, `me/hip-thrust-1.jpg` | Correspond à la variante barre autorisée. |
| `leg-press` | Presse à cuisses | `Leg_Press` — Leg Press (machine) | `me/leg-press-0.jpg`, `me/leg-press-1.jpg` | Correspondance directe; machine. |
| `rdl` | Soulevé de terre roumain haltères | Aucune correspondance exacte retenue | Validation manuelle | La source demande un soulevé de terre roumain avec haltères; le dataset offre Romanian Deadlift avec barre et Stiff-Legged Dumbbell Deadlift (mouvement différent). Aucun des deux n’est une correspondance exacte. |
| `seated-leg-curl` | Leg curl assis | `Seated_Leg_Curl` — Seated Leg Curl (machine) | `me/seated-leg-curl-0.jpg`, `me/seated-leg-curl-1.jpg` | Correspondance directe; machine assise. |
| `hip-abduction` | Abduction de hanche machine | Aucune correspondance exacte retenue | Validation manuelle | Aucun exercice/photo de hip abduction machine correspondant dans le catalogue JSON consulté. |
| `standing-calf` | Mollets debout | `Standing_Calf_Raises` — Standing Calf Raises (machine) | `me/standing-calf-0.jpg`, `me/standing-calf-1.jpg` | Mouvement debout correspondant; la photo impose une machine, matériel à confirmer dans la salle. |
| `incline-db-press` | Développé incliné haltères | `Incline_Dumbbell_Press` — Incline Dumbbell Press (dumbbell) | `me/incline-db-press-0.jpg`, `me/incline-db-press-1.jpg` | Correspondance directe. |
| `chest-supported-row` | Rowing poitrine appuyée | `Dumbbell_Incline_Row` — Dumbbell Incline Row (dumbbell) | `me/chest-supported-row-0.jpg`, `me/chest-supported-row-1.jpg` | Poitrine appuyée sur banc incliné, haltères. |
| `reverse-pec-deck` | Oiseau machine | `Reverse_Machine_Flyes` — Reverse Machine Flyes (machine) | `me/reverse-pec-deck-0.jpg`, `me/reverse-pec-deck-1.jpg` | Correspondance directe; machine. |
| `cable-lateral-raise` | Élévations latérales poulie | Aucune correspondance exacte retenue | Validation manuelle | Le seul candidat trouvé est assis; la source ne précise pas cette variante corporelle. Aucun JPG téléchargé pour éviter de substituer une variante. |
| `overhead-triceps-cable` | Extension triceps au-dessus de la tête | `Cable_Rope_Overhead_Triceps_Extension` — Cable Rope Overhead Triceps Extension (cable) | `me/overhead-triceps-cable-0.jpg`, `me/overhead-triceps-cable-1.jpg` | Extension au-dessus de la tête à la poulie; dataset avec corde. |
| `incline-db-curl` | Curl incliné | `Incline_Dumbbell_Curl` — Incline Dumbbell Curl (dumbbell) | `me/incline-db-curl-0.jpg`, `me/incline-db-curl-1.jpg` | Correspondance directe. |
| `goblet-squat` | Goblet squat (ou hack squat) | `Goblet_Squat` — Goblet Squat (kettlebells) | `wife/goblet-squat-0.jpg`, `wife/goblet-squat-1.jpg` | Mouvement goblet correspondant; dataset utilise un kettlebell, équipement non confirmé. |
| `bulgarian-split-squat` | Fentes bulgares | `Split_Squat_with_Dumbbells` — Split Squat with Dumbbells (dumbbell) | `me/bulgarian-split-squat-0.jpg`, `me/bulgarian-split-squat-1.jpg` | Pied arrière surélevé : correspondance du mouvement; haltères montrés. |
| `lying-leg-curl` | Leg curl allongé | `Lying_Leg_Curls` — Lying Leg Curls (machine) | `me/lying-leg-curl-0.jpg`, `me/lying-leg-curl-1.jpg` | Correspondance directe; machine allongée. |
| `cable-crunch` | Crunch poulie | `Cable_Crunch` — Cable Crunch (cable) | `me/cable-crunch-0.jpg`, `me/cable-crunch-1.jpg` | Correspondance directe; la photo utilise une corde. |
| `hack-squat` | Hack squat | `Hack_Squat` — Hack Squat (machine) | `me/hack-squat-0.jpg`, `me/hack-squat-1.jpg` | Correspondance directe; machine. |

## Exercices à revoir avant intégration

| Profil | ID | Motif |
|---|---|---|
| me | `cable-lateral-raise` | Le seul candidat trouvé est assis; la source ne précise pas cette variante corporelle. Aucun JPG téléchargé pour éviter de substituer une variante. |
| wife | `rdl` | La source demande un soulevé de terre roumain avec haltères; le dataset offre Romanian Deadlift avec barre et Stiff-Legged Dumbbell Deadlift (mouvement différent). Aucun des deux n’est une correspondance exacte. |
| wife | `hip-abduction` | Aucun exercice/photo de hip abduction machine correspondant dans le catalogue JSON consulté. |
| wife | `cable-lateral-raise` | Le seul candidat trouvé est assis; la source ne précise pas cette variante corporelle. Aucun JPG téléchargé pour éviter de substituer une variante. |

### Points de variante à garder visibles

- `bench-barbell` : photo du développé couché à prise moyenne; largeur de prise non spécifiée dans le programme.
- `squat` : photo de squat barre; le Programme 1 autorise aussi le hack squat. Le programme 1 garde donc cette variante non illustrée par le fichier `squat`.
- `standing-calf` / `standing-calf` Rania : photo sur machine, alors que la source ne précise pas le matériel; inventaire de salle à confirmer.
- `overhead-triceps-cable` : photo avec corde, attachement non imposé dans la source.
- `goblet-squat` Rania : photo avec kettlebell; la source ne précise pas ce matériel, à confirmer.
- `assisted-pullup` Rania : photo avec bande élastique conformément à la variante conditionnelle; présence et usage sécurisé de la bande à confirmer.
- `bulgarian-split-squat` : le dataset utilise des haltères et un pied arrière surélevé; l’image correspond au mouvement, l’équipement montré est une variante.

## Fichiers livrés

- `me/` : JPG nommés avec les IDs du Markdown Rochdi; deux fichiers par ID téléchargé.
- `wife/` : JPG dédiés uniquement aux IDs Rania non partagés (`assisted-pullup`, `goblet-squat`). Les correspondances partagées pointent vers `me/` dans l’inventaire sans créer de doubles.
- `exercise-images.json` : inventaire complet des 52 exercices uniques par profil, 48 correspondances, liens source, références locales, réutilisations, notes de correspondance, apparence des modèles, éléments à revoir et SHA-256.

L’inventaire distingue une correspondance de mouvement de l’adéquation du modèle au profil; une référence présente dans `wife` n’implique donc pas une image féminine.
