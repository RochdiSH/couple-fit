// Catalogue V2 extrait de PROGRAMMES_V2_SOURCE.md. IDs stables; les exercices restent propres à chaque profil.
export const BUILTIN_PROGRAMS = Object.freeze({
  "me": [
    {
      "id": "me-foundations-hypertrophy-v1",
      "profileId": "me",
      "name": "Fondations hypertrophie",
      "description": "Objectif : gain musculaire global, priorité pectoraux/dos/épaules. Prévoir Lower A/B loin du football intense si possible.",
      "durationWeeks": 8,
      "revision": 1,
      "status": "available",
      "sessions": [
        {
          "id": "upper-a",
          "name": "Upper A",
          "exercises": [
            {
              "id": "bench-barbell",
              "name": "Développé couché barre",
              "sets": 3,
              "repMin": 6,
              "repMax": 8,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "cable-row",
              "name": "Rowing assis poulie basse",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "incline-db-press",
              "name": "Développé incliné haltères",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "pullup-pronated",
              "name": "Tractions pronation, lest si nécessaire",
              "sets": 3,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 150,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "db-lateral-raise",
              "name": "Élévations latérales haltères",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "rope-triceps-pushdown",
              "name": "Extension triceps corde",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "incline-db-curl",
              "name": "Curl incliné haltères",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            }
          ]
        },
        {
          "id": "lower-a",
          "name": "Lower A",
          "exercises": [
            {
              "id": "squat",
              "name": "Squat barre (ou hack squat)",
              "sets": 3,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "rdl",
              "name": "Soulevé de terre roumain",
              "sets": 3,
              "repMin": 8,
              "repMax": 10,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "leg-press",
              "name": "Presse à cuisses",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "seated-leg-curl",
              "name": "Leg curl assis",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 90,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "standing-calf",
              "name": "Mollets debout",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "cable-crunch",
              "name": "Crunch à la poulie",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 60,
              "rir": 2
            }
          ]
        },
        {
          "id": "upper-b",
          "name": "Upper B",
          "exercises": [
            {
              "id": "shoulder-press-db",
              "name": "Développé épaules haltères assis",
              "sets": 3,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "pullup-neutral",
              "name": "Tractions prise neutre (ou pronation)",
              "sets": 3,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "chest-press-machine",
              "name": "Chest press machine",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "chest-supported-row",
              "name": "Rowing poitrine appuyée",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "reverse-pec-deck",
              "name": "Oiseau machine / reverse pec deck",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "overhead-triceps-cable",
              "name": "Extension triceps au-dessus de la tête poulie",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "hammer-curl",
              "name": "Curl marteau haltères",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            }
          ]
        },
        {
          "id": "lower-b",
          "name": "Lower B",
          "exercises": [
            {
              "id": "front-squat",
              "name": "Front squat (ou goblet squat lourd)",
              "sets": 3,
              "repMin": 8,
              "repMax": 10,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "hip-thrust",
              "name": "Hip thrust barre/machine",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "bulgarian-split-squat",
              "name": "Fentes bulgares",
              "sets": 2,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "repQualifier": "par jambe"
            },
            {
              "id": "lying-leg-curl",
              "name": "Leg curl allongé",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 90,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "seated-calf",
              "name": "Mollets assis",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "plank",
              "name": "Gainage planche",
              "sets": 2,
              "repMin": 30,
              "repMax": 60,
              "restSeconds": 60,
              "rir": 2,
              "repUnit": "seconds"
            }
          ]
        }
      ]
    },
    {
      "id": "me-hypertrophy-progression-v1",
      "profileId": "me",
      "name": "Progression hypertrophie",
      "description": "Même structure; progresser sur les mouvements clés et varier quelques angles.",
      "durationWeeks": 8,
      "revision": 1,
      "status": "available",
      "sessions": [
        {
          "id": "upper-a",
          "name": "Upper A",
          "exercises": [
            {
              "id": "bench-barbell",
              "name": "Développé couché barre",
              "sets": 3,
              "repMin": 5,
              "repMax": 8,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "cable-row",
              "name": "Rowing assis poulie basse",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "incline-db-press",
              "name": "Développé incliné haltères",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "pullup-pronated",
              "name": "Tractions pronation, lest si possible",
              "sets": 3,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 150,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "cable-lateral-raise",
              "name": "Élévations latérales poulie",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "rope-triceps-pushdown",
              "name": "Extension triceps corde",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "incline-db-curl",
              "name": "Curl incliné haltères",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            }
          ]
        },
        {
          "id": "lower-a",
          "name": "Lower A",
          "exercises": [
            {
              "id": "squat",
              "name": "Squat barre",
              "sets": 3,
              "repMin": 6,
              "repMax": 8,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "rdl",
              "name": "Soulevé de terre roumain",
              "sets": 3,
              "repMin": 8,
              "repMax": 10,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "leg-press",
              "name": "Presse à cuisses",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "seated-leg-curl",
              "name": "Leg curl assis",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 90,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "standing-calf",
              "name": "Mollets debout",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "cable-crunch",
              "name": "Crunch poulie",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 60,
              "rir": 2
            }
          ]
        },
        {
          "id": "upper-b",
          "name": "Upper B",
          "exercises": [
            {
              "id": "shoulder-press-db",
              "name": "Développé épaules haltères",
              "sets": 3,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "pullup-neutral",
              "name": "Tractions prise neutre",
              "sets": 3,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "chest-press-machine",
              "name": "Chest press machine",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "chest-supported-row",
              "name": "Rowing poitrine appuyée",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "reverse-pec-deck",
              "name": "Oiseau machine",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "overhead-triceps-cable",
              "name": "Extension triceps au-dessus de la tête",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "hammer-curl",
              "name": "Curl marteau",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            }
          ]
        },
        {
          "id": "lower-b",
          "name": "Lower B",
          "exercises": [
            {
              "id": "hack-squat",
              "name": "Hack squat machine",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "hip-thrust",
              "name": "Hip thrust",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "bulgarian-split-squat",
              "name": "Fentes bulgares",
              "sets": 2,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "repQualifier": "par jambe"
            },
            {
              "id": "lying-leg-curl",
              "name": "Leg curl allongé",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 90,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "seated-calf",
              "name": "Mollets assis",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "plank",
              "name": "Planche",
              "sets": 2,
              "repMin": 30,
              "repMax": 60,
              "restSeconds": 60,
              "rir": 2,
              "repUnit": "seconds"
            }
          ]
        }
      ]
    },
    {
      "id": "me-upper-specialization-v1",
      "profileId": "me",
      "name": "Consolidation et spécialisation haut du corps",
      "description": "Consolidation et spécialisation du haut du corps.",
      "durationWeeks": 8,
      "revision": 1,
      "status": "available",
      "sessions": [
        {
          "id": "upper-a",
          "name": "Upper A",
          "exercises": [
            {
              "id": "bench-barbell",
              "name": "Développé couché barre",
              "sets": 3,
              "repMin": 6,
              "repMax": 8,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "pullup-pronated",
              "name": "Tractions pronation lestées selon niveau",
              "sets": 3,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "incline-db-press",
              "name": "Développé incliné haltères",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "cable-row",
              "name": "Rowing assis poulie basse",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "cable-lateral-raise",
              "name": "Élévations latérales poulie",
              "sets": 4,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "rope-triceps-pushdown",
              "name": "Extension triceps corde",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "incline-db-curl",
              "name": "Curl incliné",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            }
          ]
        },
        {
          "id": "lower-a",
          "name": "Lower A",
          "exercises": [
            {
              "id": "squat",
              "name": "Squat barre",
              "sets": 3,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "rdl",
              "name": "Soulevé de terre roumain",
              "sets": 3,
              "repMin": 8,
              "repMax": 10,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "leg-press",
              "name": "Presse à cuisses",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "seated-leg-curl",
              "name": "Leg curl assis",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 90,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "standing-calf",
              "name": "Mollets debout",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "cable-crunch",
              "name": "Crunch poulie",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 60,
              "rir": 2
            }
          ]
        },
        {
          "id": "upper-b",
          "name": "Upper B",
          "exercises": [
            {
              "id": "shoulder-press-db",
              "name": "Développé épaules haltères",
              "sets": 3,
              "repMin": 8,
              "repMax": 10,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "chest-supported-row",
              "name": "Rowing poitrine appuyée",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "chest-press-machine",
              "name": "Chest press machine",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "pullup-neutral",
              "name": "Tractions prise neutre",
              "sets": 3,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "reverse-pec-deck",
              "name": "Oiseau machine",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "overhead-triceps-cable",
              "name": "Extension triceps au-dessus de la tête",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "hammer-curl",
              "name": "Curl marteau",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            }
          ]
        },
        {
          "id": "lower-b",
          "name": "Lower B",
          "exercises": [
            {
              "id": "hack-squat",
              "name": "Hack squat",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "hip-thrust",
              "name": "Hip thrust",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "bulgarian-split-squat",
              "name": "Fentes bulgares",
              "sets": 2,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "repQualifier": "par jambe"
            },
            {
              "id": "lying-leg-curl",
              "name": "Leg curl allongé",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 90,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "seated-calf",
              "name": "Mollets assis",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "plank",
              "name": "Planche",
              "sets": 2,
              "repMin": 30,
              "repMax": 60,
              "restSeconds": 60,
              "rir": 2,
              "repUnit": "seconds"
            }
          ]
        }
      ]
    }
  ],
  "wife": [
    {
      "id": "wife-foundations-hypertrophy-v1",
      "profileId": "wife",
      "name": "Fondations bas du corps",
      "description": "Proposition de départ à adapter au niveau, à l’expérience, aux contraintes articulaires et au matériel confirmé.",
      "durationWeeks": 8,
      "revision": 1,
      "status": "available",
      "sessions": [
        {
          "id": "upper-a",
          "name": "Upper A",
          "exercises": [
            {
              "id": "chest-press-machine",
              "name": "Chest press machine",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "rirMax": 3
            },
            {
              "id": "cable-row",
              "name": "Rowing poulie basse",
              "sets": 3,
              "repMin": 10,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "rirMax": 3
            },
            {
              "id": "shoulder-press-db",
              "name": "Développé épaules haltères",
              "sets": 2,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "rirMax": 3
            },
            {
              "id": "assisted-pullup",
              "name": "Tractions avec assistance par élastique si disponible (sinon variante à valider)",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "rirMax": 3
            },
            {
              "id": "db-lateral-raise",
              "name": "Élévations latérales haltères",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 2
            },
            {
              "id": "rope-triceps-pushdown",
              "name": "Extension triceps corde",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 2
            },
            {
              "id": "hammer-curl",
              "name": "Curl marteau",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 2
            }
          ]
        },
        {
          "id": "lower-a",
          "name": "Lower A",
          "exercises": [
            {
              "id": "hip-thrust",
              "name": "Hip thrust barre ou machine",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "rirMax": 3
            },
            {
              "id": "leg-press",
              "name": "Presse à cuisses",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 120,
              "rir": 2,
              "rirMax": 3
            },
            {
              "id": "rdl",
              "name": "Soulevé de terre roumain haltères",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "rirMax": 3
            },
            {
              "id": "seated-leg-curl",
              "name": "Leg curl assis",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 90,
              "rir": 2
            },
            {
              "id": "hip-abduction",
              "name": "Abduction de hanche machine",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 2
            },
            {
              "id": "standing-calf",
              "name": "Mollets debout",
              "sets": 2,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 2
            }
          ]
        },
        {
          "id": "upper-b",
          "name": "Upper B",
          "exercises": [
            {
              "id": "incline-db-press",
              "name": "Développé incliné haltères",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "rirMax": 3
            },
            {
              "id": "chest-supported-row",
              "name": "Rowing poitrine appuyée",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "rirMax": 3
            },
            {
              "id": "assisted-pullup",
              "name": "Tractions avec assistance adaptée (matériel à confirmer)",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "rirMax": 3
            },
            {
              "id": "reverse-pec-deck",
              "name": "Oiseau machine",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 2
            },
            {
              "id": "cable-lateral-raise",
              "name": "Élévations latérales poulie",
              "sets": 2,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 2
            },
            {
              "id": "overhead-triceps-cable",
              "name": "Extension triceps au-dessus de la tête",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 2
            },
            {
              "id": "incline-db-curl",
              "name": "Curl incliné",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 2
            }
          ]
        },
        {
          "id": "lower-b",
          "name": "Lower B",
          "exercises": [
            {
              "id": "goblet-squat",
              "name": "Goblet squat (ou hack squat)",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "rirMax": 3
            },
            {
              "id": "bulgarian-split-squat",
              "name": "Fentes bulgares",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "rirMax": 3,
              "repQualifier": "par jambe"
            },
            {
              "id": "hip-thrust",
              "name": "Hip thrust barre/machine",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "lying-leg-curl",
              "name": "Leg curl allongé",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 90,
              "rir": 2
            },
            {
              "id": "hip-abduction",
              "name": "Abduction machine",
              "sets": 2,
              "repMin": 15,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 2
            },
            {
              "id": "cable-crunch",
              "name": "Crunch poulie",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 60,
              "rir": 2
            }
          ]
        }
      ]
    },
    {
      "id": "wife-hypertrophy-progression-v1",
      "profileId": "wife",
      "name": "Progression fessiers/jambes",
      "description": "Proposition de départ à adapter au niveau, à l’expérience, aux contraintes articulaires et au matériel confirmé.",
      "durationWeeks": 8,
      "revision": 1,
      "status": "available",
      "sessions": [
        {
          "id": "upper-a",
          "name": "Upper A",
          "exercises": [
            {
              "id": "chest-press-machine",
              "name": "Chest press machine",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "cable-row",
              "name": "Rowing poulie basse",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "shoulder-press-db",
              "name": "Développé épaules haltères",
              "sets": 2,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "assisted-pullup",
              "name": "Tractions avec assistance adaptée (matériel à confirmer)",
              "sets": 3,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "db-lateral-raise",
              "name": "Élévations latérales",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "rope-triceps-pushdown",
              "name": "Extension triceps corde",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 2
            },
            {
              "id": "hammer-curl",
              "name": "Curl marteau",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 2
            }
          ]
        },
        {
          "id": "lower-a",
          "name": "Lower A",
          "exercises": [
            {
              "id": "hip-thrust",
              "name": "Hip thrust",
              "sets": 4,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "leg-press",
              "name": "Presse à cuisses",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "rdl",
              "name": "Soulevé de terre roumain",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "seated-leg-curl",
              "name": "Leg curl assis",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 90,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "hip-abduction",
              "name": "Abduction machine",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "standing-calf",
              "name": "Mollets debout",
              "sets": 2,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 2
            }
          ]
        },
        {
          "id": "upper-b",
          "name": "Upper B",
          "exercises": [
            {
              "id": "incline-db-press",
              "name": "Développé incliné haltères",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "chest-supported-row",
              "name": "Rowing poitrine appuyée",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "assisted-pullup",
              "name": "Tractions avec assistance adaptée (matériel à confirmer)",
              "sets": 3,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "reverse-pec-deck",
              "name": "Oiseau machine",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "cable-lateral-raise",
              "name": "Élévations latérales poulie",
              "sets": 2,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "overhead-triceps-cable",
              "name": "Extension triceps au-dessus de la tête",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 2
            },
            {
              "id": "incline-db-curl",
              "name": "Curl incliné",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 2
            }
          ]
        },
        {
          "id": "lower-b",
          "name": "Lower B",
          "exercises": [
            {
              "id": "hack-squat",
              "name": "Hack squat",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "bulgarian-split-squat",
              "name": "Fentes bulgares",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "repQualifier": "par jambe"
            },
            {
              "id": "hip-thrust",
              "name": "Hip thrust",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "lying-leg-curl",
              "name": "Leg curl allongé",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 90,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "hip-abduction",
              "name": "Abduction machine",
              "sets": 2,
              "repMin": 15,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "cable-crunch",
              "name": "Crunch poulie",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 60,
              "rir": 2
            }
          ]
        }
      ]
    },
    {
      "id": "wife-upper-specialization-v1",
      "profileId": "wife",
      "name": "Consolidation bas du corps",
      "description": "Proposition de départ à adapter au niveau, à l’expérience, aux contraintes articulaires et au matériel confirmé.",
      "durationWeeks": 8,
      "revision": 1,
      "status": "available",
      "sessions": [
        {
          "id": "upper-a",
          "name": "Upper A",
          "exercises": [
            {
              "id": "chest-press-machine",
              "name": "Chest press machine",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "cable-row",
              "name": "Rowing poulie basse",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "shoulder-press-db",
              "name": "Développé épaules haltères",
              "sets": 2,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "assisted-pullup",
              "name": "Tractions avec assistance adaptée (matériel à confirmer)",
              "sets": 3,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "db-lateral-raise",
              "name": "Élévations latérales",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "rope-triceps-pushdown",
              "name": "Extension triceps corde",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 2
            },
            {
              "id": "hammer-curl",
              "name": "Curl marteau",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 2
            }
          ]
        },
        {
          "id": "lower-a",
          "name": "Lower A",
          "exercises": [
            {
              "id": "hip-thrust",
              "name": "Hip thrust",
              "sets": 4,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "leg-press",
              "name": "Presse à cuisses",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "rdl",
              "name": "Soulevé de terre roumain",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "seated-leg-curl",
              "name": "Leg curl assis",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 90,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "hip-abduction",
              "name": "Abduction machine",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "standing-calf",
              "name": "Mollets debout",
              "sets": 2,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 2
            }
          ]
        },
        {
          "id": "upper-b",
          "name": "Upper B",
          "exercises": [
            {
              "id": "incline-db-press",
              "name": "Développé incliné haltères",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "chest-supported-row",
              "name": "Rowing poitrine appuyée",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "assisted-pullup",
              "name": "Tractions avec assistance adaptée (matériel à confirmer)",
              "sets": 3,
              "repMin": 6,
              "repMax": 10,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "reverse-pec-deck",
              "name": "Oiseau machine",
              "sets": 3,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "cable-lateral-raise",
              "name": "Élévations latérales poulie",
              "sets": 2,
              "repMin": 12,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "overhead-triceps-cable",
              "name": "Extension triceps au-dessus de la tête",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 2
            },
            {
              "id": "incline-db-curl",
              "name": "Curl incliné",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 75,
              "rir": 2
            }
          ]
        },
        {
          "id": "lower-b",
          "name": "Lower B",
          "exercises": [
            {
              "id": "hack-squat",
              "name": "Hack squat",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 150,
              "rir": 2
            },
            {
              "id": "bulgarian-split-squat",
              "name": "Fentes bulgares",
              "sets": 3,
              "repMin": 8,
              "repMax": 12,
              "restSeconds": 120,
              "rir": 2,
              "repQualifier": "par jambe"
            },
            {
              "id": "hip-thrust",
              "name": "Hip thrust",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 120,
              "rir": 2
            },
            {
              "id": "lying-leg-curl",
              "name": "Leg curl allongé",
              "sets": 3,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 90,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "hip-abduction",
              "name": "Abduction machine",
              "sets": 2,
              "repMin": 15,
              "repMax": 20,
              "restSeconds": 75,
              "rir": 1,
              "rirMax": 2
            },
            {
              "id": "cable-crunch",
              "name": "Crunch poulie",
              "sets": 2,
              "repMin": 10,
              "repMax": 15,
              "restSeconds": 60,
              "rir": 2
            }
          ]
        }
      ]
    }
  ]
});
