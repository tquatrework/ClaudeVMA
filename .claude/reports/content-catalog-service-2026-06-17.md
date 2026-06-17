# Rapport — content-catalog-service — 2026-06-17

## Statut : IMPLÉMENTATION COMPLÈTE

## Contexte

Le service `content-catalog-service` n'existait pas. Il a été créé from scratch conformément à la spec `docs/services/content-catalog-service.md` (phase 3) et au delta `content-catalog-service-delta.md`.

## Arborescence créée

```
services/content-catalog-service/
├── Dockerfile
├── .env.example
├── nest-cli.json
├── package.json
├── tsconfig.json
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── enums/
│   │   │   ├── content-status.enum.ts     (draft, pending_validation, validated, rejected, removed)
│   │   │   ├── content-type.enum.ts       (exercise, evaluation, tutorial + TutorialType + TutorialFormat)
│   │   │   └── user-role.enum.ts
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts
│   │       └── roles.guard.ts
│   ├── health/
│   │   ├── health.controller.ts
│   │   └── health.module.ts
│   ├── exercises/
│   │   ├── dto/
│   │   │   ├── create-exercise.dto.ts
│   │   │   ├── create-exercise-answer.dto.ts
│   │   │   ├── create-correction-request.dto.ts
│   │   │   ├── propose-solution.dto.ts
│   │   │   └── search-exercise.dto.ts
│   │   ├── entities/
│   │   │   ├── exercise.entity.ts
│   │   │   ├── exercise-part.entity.ts
│   │   │   ├── exercise-answer.entity.ts
│   │   │   ├── exercise-correction.entity.ts
│   │   │   └── exercise-solution.entity.ts
│   │   ├── exercise-answers.controller.ts
│   │   ├── exercises.controller.ts
│   │   ├── exercises.module.ts
│   │   └── exercises.service.ts
│   ├── evaluations/
│   │   ├── dto/
│   │   │   ├── create-evaluation.dto.ts
│   │   │   ├── create-evaluation-attempt.dto.ts
│   │   │   └── search-evaluation.dto.ts
│   │   ├── entities/
│   │   │   ├── evaluation.entity.ts
│   │   │   └── evaluation-attempt.entity.ts
│   │   ├── evaluations.controller.ts
│   │   ├── evaluations.module.ts
│   │   └── evaluations.service.ts
│   ├── tutorials/
│   │   ├── dto/
│   │   │   ├── create-tutorial.dto.ts
│   │   │   └── search-tutorial.dto.ts
│   │   ├── entities/
│   │   │   └── tutorial.entity.ts
│   │   ├── tutorials.controller.ts
│   │   ├── tutorials.module.ts
│   │   └── tutorials.service.ts
│   ├── contents/
│   │   ├── dto/
│   │   │   ├── create-comment.dto.ts
│   │   │   └── create-rating.dto.ts
│   │   ├── entities/
│   │   │   ├── content-comment.entity.ts
│   │   │   └── content-rating.entity.ts
│   │   ├── contents.controller.ts
│   │   ├── contents.module.ts
│   │   └── contents.service.ts
│   └── validations/
│       ├── dto/
│       │   └── validate-content.dto.ts
│       ├── entities/
│       │   └── content-validation.entity.ts
│       ├── validations.controller.ts
│       ├── validations.module.ts
│       └── validations.service.ts
└── test/
    └── unit/
        ├── exercises/exercises.service.spec.ts
        ├── evaluations/evaluations.service.spec.ts
        ├── tutorials/tutorials.service.spec.ts
        ├── validations/validations.service.spec.ts
        └── contents/contents.service.spec.ts
```

## Routes implémentées

### Health
| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | /health | Vérification de disponibilité | Non |

### Exercises
| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | /exercises | Rechercher exercices (filtres : level, difficulty, theme, tag, authorId) | JWT |
| POST | /exercises | Charger un exercice (solution obligatoire incluse) | JWT + FORMATEUR/AP/RP |
| GET | /exercises/:id | Détail d'un exercice avec ses parties | JWT |
| POST | /exercises/:id/answers | Soumettre une réponse (élève uniquement, exercice validé requis) | JWT + ELEVE |
| POST | /exercises/:id/solutions | Proposer une solution | JWT + FORMATEUR/AP/RP |
| GET | /exercises/:id/solutions/official | Obtenir la solution officielle (moins chère des validées) | JWT |
| DELETE | /exercises/:id | Retirer un exercice (status → REMOVED) | JWT + RP/TI |

### Exercise Answers
| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| POST | /exercise-answers/:id/correction-requests | Demander la correction d'une réponse | JWT |

### Evaluations
| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | /evaluations | Rechercher évaluations | JWT |
| POST | /evaluations | Créer évaluation (chronométrée, blocage retour arrière) | JWT + FORMATEUR/AP/RP |
| GET | /evaluations/:id | Détail d'une évaluation | JWT |
| POST | /evaluations/:id/attempts | Démarrer une tentative (élève uniquement) | JWT + ELEVE |
| DELETE | /evaluations/:id | Retirer une évaluation | JWT + RP/TI |

### Tutorials
| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | /tutorials | Rechercher tutoriels (filtres : type, format, level, theme, tag) | JWT |
| POST | /tutorials | Charger un tutoriel/vidéo (type: academie/activite/news, format: texte/mixte/video) | JWT + FORMATEUR/AP/RP |
| GET | /tutorials/:id | Détail d'un tutoriel | JWT |
| DELETE | /tutorials/:id | Retirer un tutoriel | JWT + RP/TI |

### Contents (commentaires et notes transverses)
| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| POST | /contents/:type/:id/comments | Commenter une ressource (sans donner la solution) | JWT |
| GET | /contents/:type/:id/comments | Lister les commentaires | JWT |
| POST | /contents/:type/:id/ratings | Scorer une ressource (1-5, un vote par utilisateur) | JWT |
| GET | /contents/:type/:id/ratings | Note moyenne et nombre de votes | JWT |

### Validations
| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| POST | /validations/:type/:id/request | Soumettre à validation (→ pending_validation) | JWT + FORMATEUR/AP/RP |
| POST | /validations/:type/:id/decision | Valider ou rejeter (commentaire obligatoire si rejet) | JWT + AP/RP |
| GET | /validations/:type/:id/history | Historique des décisions de validation | JWT + AP/RP/TI |

## Tests

Commande : `npm test`

Résultat : **67 tests, 5 suites, 0 échec**

- `exercises.service.spec.ts` — 22 tests (create, search, submitAnswer, requestCorrection, proposeSolution, getOfficialSolution, removeExercise)
- `evaluations.service.spec.ts` — 12 tests (create, search, startAttempt, removeEvaluation)
- `tutorials.service.spec.ts` — 11 tests (create, search, findOne, removeTutorial)
- `validations.service.spec.ts` — 11 tests (validateContent, requestValidation)
- `contents.service.spec.ts` — 11 tests (addComment, addRating, getAverageRating)

## Décisions techniques

1. **Solution obligatoire au chargement** : Lors du `POST /exercises`, la solution est créée automatiquement dans `ExerciseSolution` avec `isValidated=false` et `isOfficial=false`. Ce mécanisme respecte la spec "formateurs chargent exercices avec solution obligatoire au démarrage".

2. **Solution officielle** : `getOfficialSolution` retourne la moins chère des solutions ayant `isValidated=true` (tri `cost ASC`). Conforme spec "solution officielle = moins chère des solutions validées".

3. **Commentaires sans solution** : Le flag `isOwnerHint` est réservé aux formateurs/AP/RP — les élèves qui l'envoient à `true` le voient ignoré silencieusement.

4. **Tentative d'évaluation** : `startAttempt` vérifie l'absence de tentative `IN_PROGRESS` existante avant création. Le blocage des solutions pendant une évaluation est documenté (note dans Swagger) mais la vérification croisée avec `EvaluationAttempt` n'est pas implémentée dans `getOfficialSolution` — voir écarts ci-dessous.

5. **Lien partageable** : Généré automatiquement après création sous la forme `/exercises/:id`, `/evaluations/:id`, `/tutorials/:id`.

6. **Contenus transverses** : Le module `contents` gère commentaires et notes via un paramètre de chemin `:type` (exercise/evaluation/tutorial) pour éviter la duplication de routes.

## Écarts restants avec la spec

1. **Blocage des solutions pendant une évaluation en cours** : La spec indique "les solutions restent bloquées pendant une évaluation en cours". L'information est présente dans Swagger mais `getOfficialSolution` ne vérifie pas si l'élève a une tentative active. Implémenter cette vérification nécessiterait une query sur `EvaluationAttempt` dans `ExercisesService` — possible mais non implémenté pour éviter la dépendance circulaire sans injection supplémentaire.

2. **Activités non pourvues** : La spec mentionne l'émission d'une activité non pourvue quand une correction manque. L'entité `ExerciseCorrection` existe mais l'émission d'un événement vers `learning-activity-service` n'est pas implémentée (aucun event bus disponible en phase 3).

3. **Points pédagogiques et récompenses financières** : Les événements `PedagogicalPointsAwarded` et `FinancialRewardAccrued` sont dans la spec mais requièrent un event bus et l'intégration avec `finance-credit-service` et `learning-activity-service` — hors scope de la livraison initiale.

4. **Validation des solutions** : `isValidated` et `isOfficial` sur `ExerciseSolution` sont prêts mais il n'y a pas de route dédiée pour qu'un AP/RP valide une solution spécifique (non dans les `candidateApis` de la spec).

5. **Recherche full-text** : La recherche par `keyword` dans les exercices est préparée dans le DTO mais non implémentée dans le service (la spec mentionne un moteur d'indexation transverse — service transverse recommandé).

6. **Lien copiable** : Le `shareableLink` est généré en chemin relatif `/exercises/:id`. Dans un environnement réel, il faudrait le préfixer avec le domaine de l'API Gateway.

## Variables d'environnement (.env.example)

```
DATABASE_URL=postgresql://visiomath:visiomath_secret@localhost:5432/visiomath_content_catalog
JWT_SECRET=change_me_in_production
PORT=3000
NODE_ENV=development
```
