# Rapport — learning-activity-service — 2026-08-28

## Objet

Fonctionnalité Quizz, périmètre `learning-activity-service` uniquement : cycle de vie complet
de la tentative d'un utilisateur (démarrage/inscription, passage, historique noté), sur le
contrat interne déjà fixé avec `content-catalog-service` (arbitrage `docs/architecture.md` du
2026-08-28, « Fonctionnalite Quizz »). La création/définition du Quizz (questions, solution,
barème, tags, validation AP/RP) est développée en parallèle par un autre agent dans
`content-catalog-service` et n'a pas été touchée ici.

## Branche et PR

- Branche : `feat/quiz-attempts`, créée depuis `master` à jour (`e26187c`).
- PR : https://github.com/tquatrework/ClaudeVMA/pull/151 — non mergée, en attente de validation.
- Poussée sur `origin` avant toute autre étape.

## Ce qui a été lu avant d'écrire (conventions réelles du service)

- `src/app.module.ts`, `src/main.ts` : NestJS 10 + TypeORM + PostgreSQL, `synchronize` activé
  hors `NODE_ENV=production` (pas de dossier de migrations dans ce service — convention
  existante conservée telle quelle, aucune infra nouvelle introduite).
- `src/common/guards/jwt-auth.guard.ts`, `roles.guard.ts`, `decorators/*` : JWT vérifié
  manuellement via `@nestjs/jwt`, `RolesGuard` n'agit que si `@Roles()` est posé ; le module
  `open-activities` fait ses propres contrôles de rôle **dans le service**, pas via le
  décorateur — j'ai suivi ce style pour `quiz-attempts` plutôt que d'introduire un nouveau
  pattern.
- `src/open-activities/*` (entité, DTO, service, contrôleur, module) : structure de référence
  pour nommage, Swagger (`@ApiOperation`/`@ApiResponse`/`@ApiHeader` systématiques), gestion des
  erreurs (`ForbiddenException`/`NotFoundException`/`BadRequestException` explicites, jamais
  d'absorption silencieuse), et style de tests (repository mocké à la main, pas de librairie de
  mock supplémentaire).
- `test/unit/open-activities/*.spec.ts` : style de test à suivre (mock repo, cas nominaux et
  cas d'erreur, IDs lisibles en constantes).
- `docker-compose.yml` : convention `<SERVICE>_SERVICE_URL: http://<service>:<port>` déjà
  utilisée par d'autres services pour les appels interservices (`PROFILE_SERVICE_URL`,
  `IDENTITY_ACCESS_SERVICE_URL`, etc.) ; `INTERNAL_SECRET` déjà présent dans l'environnement de
  `learning-activity-service`.
- `docs/routes.md` : couvre aujourd'hui uniquement les services de phase 1 (aucune section pour
  `learning-activity-service`, `content-catalog-service` ou `community-path-service`) — la
  documentation des routes de ce chantier passe donc par Swagger (module déjà en place dans ce
  service), conformément à la consigne reçue.

## Implémenté

### Modèle de données

Une seule entité `QuizAttempt` (`src/quiz-attempts/entities/quiz-attempt.entity.ts`) porte les
trois étapes demandées, sans découpage supplémentaire :

```
id, quizId, userId, userRole,
status (in_progress | completed),
score, maxScore, details (jsonb : [{questionId, isCorrect, pointsEarned, pointsPossible}]),
startedAt, completedAt, updatedAt
```

`details` ne contient jamais la solution — uniquement le verdict correct/incorrect et les
points par question, exactement la forme renvoyée par la route interne de notation.

### Routes exposées

| Méthode | Chemin | Rôle | Comportement |
|---|---|---|---|
| POST | `/quiz-attempts` | élève, formateur, RP, AP | Démarre une tentative `in_progress` pour `quizId` et l'utilisateur authentifié |
| POST | `/quiz-attempts/:id/submit` | élève, formateur, RP, AP | Reçoit les réponses, appelle la notation interne, persiste `score`/`maxScore`/`details`, passe la tentative à `completed` |
| GET | `/quiz-attempts/history` | tout appelant authentifié | Tentatives `completed` de l'utilisateur, triées par `completedAt` décroissant |

Toutes trois protégées par `JwtAuthGuard` + `RolesGuard` (JWT obligatoire), `x-correlation-id`
accepté et propagé à l'appel interne. Swagger documente chaque route (`summary`, `description`,
tous les codes de réponse pertinents y compris 502/503).

### Règles de droit et d'erreur

- **Rôle non autorisé** → `403 ForbiddenException`, vérifié avant toute lecture en base pour
  `submit` (pas de fuite d'information sur l'existence d'une tentative à un rôle qui n'a de toute
  façon jamais ce droit).
- **Tentative introuvable ou appartenant à un tiers** → `404 NotFoundException`, message
  identique dans les deux cas : convention de masquage déjà appliquée ailleurs dans le projet
  (on ne révèle pas l'existence de ce qu'on n'a pas le droit de voir).
- **Re-soumission d'une tentative déjà `completed`** → `400 BadRequestException` explicite,
  aucun recalcul ni écrasement silencieux du score existant.
- **Réponse de notation malformée** (champs manquants, mauvais type, JSON illisible) →
  `502 BadGatewayException` explicite. Aucune valeur par défaut n'est substituée : soit la
  réponse est valide dans son intégralité, soit l'appel échoue bruyamment.
- **`content-catalog-service` injoignable** (erreur réseau) → `503 ServiceUnavailableException`.
- **`quizId` inconnu côté `content-catalog-service`** (404 amont) → traduit en `404` côté
  `learning-activity-service`.
- **`CONTENT_CATALOG_SERVICE_URL` non configurée** → `503` explicite au lieu d'un plantage ou
  d'un appel vers `undefined`.

### Client de notation interne

`QuizGradingClientService` (`src/quiz-attempts/quiz-grading-client.service.ts`) : appelle
`POST {CONTENT_CATALOG_SERVICE_URL}/internal/quizzes/:quizId/grade` avec `X-Internal-Secret`
(variable `INTERNAL_SECRET`, déjà présente dans l'environnement du service) et propage
`x-correlation-id` si fourni. Utilise l'API `fetch` native de Node 20 — aucune dépendance HTTP
supplémentaire ajoutée (`@nestjs/axios`/`axios` absents de ce service et non introduits).
Valide strictement la forme de la réponse avant de faire confiance à ses valeurs.

### Infrastructure

`docker-compose.yml` : ajout de `CONTENT_CATALOG_SERVICE_URL: http://content-catalog-service:3013`
à l'environnement de `learning-activity-service`, et d'une dépendance de démarrage
(`content-catalog-service: condition: service_started` — `content-catalog-service` n'expose pas
de healthcheck, donc pas de `condition: service_healthy` possible ici, à la différence de
`postgres`).

## Tests

- `test/unit/quiz-attempts/quiz-attempts.service.spec.ts` : démarrage par rôle autorisé (élève +
  chaque rôle admin/formateur) et refusé (parent financeur) ; soumission nominale ; refus de
  re-soumission ; tentative introuvable ; tentative d'un tiers (pas de fuite) ; rôle non autorisé
  avant recherche en base ; propagation d'une erreur de notation sans persistance partielle ;
  historique filtré par utilisateur + statut.
- `test/unit/quiz-attempts/quiz-grading-client.spec.ts` : appel nominal (en-têtes vérifiés),
  configuration manquante, service injoignable, 404 amont, échec HTTP générique, JSON illisible,
  réponse malformée (champs manquants et champ de mauvais type).
- Résultat : `npx jest` → 4 suites, **62 tests passés** (42 préexistants + 20 nouveaux), 0 échec.
- `npx nest build` → compile sans erreur.

Conformément à la définition de « terminé » du projet : ces résultats sont des tests
unitaires/une compilation, **pas une preuve contre la pile réelle**. Voir point de vigilance
ci-dessous.

## Point de vigilance signalé dans la PR

`content-catalog-service` est développé en parallèle sur le même contrat et peut ne pas encore
exposer réellement `POST /internal/quizzes/:quizId/grade` au moment de cette PR. Le code est
écrit contre le contrat documenté et testé via un mock du client de notation — **aucune preuve
de bout en bout n'est possible tant que les deux services ne sont pas déployés ensemble**. Ce
sera à vérifier explicitement (réponse HTTP réelle citée) une fois les deux PR mergées et
déployées.

## Contradictions ou manques dans la spécification

Aucun. Le contrat interne transmis (body `{answers: [{questionId, selectedOptionIds?, text?}]}`,
réponse `{score, maxScore, details: [{questionId, isCorrect, pointsEarned, pointsPossible}]}`)
correspond exactement à ce qui a été implémenté, sans ambiguïté à lever.

## Documentation mise à jour

- `docs/services/learning-activity-service.md` : nouvelle section `implementationSession`
  datée 2026-08-28, décrivant l'arborescence créée, le rôle de chaque fichier, les décisions
  techniques prises et les points en suspens (preuve e2e conjointe à faire).
- Routes documentées via Swagger (module déjà en place dans ce service) plutôt que
  `docs/routes.md`, qui ne couvre aujourd'hui que les services de phase 1.

## Branches non fusionnées signalées (règle du projet, rappel systématique)

Sans lien avec ce chantier, à ne pas oublier :
- Locales : `feat/front-reprise-candidature-formateur`, `feat/reprise-candidature-formateur`,
  `worktree-agent-ad884b1dea2051024`, `worktree-agent-afdb918b5be5f477e`
- Distantes : `origin/docs/quizz-arbitrage`, `origin/feat/front-reprise-candidature-formateur`,
  `origin/feat/reprise-candidature-formateur`
(`feat/quiz-attempts` / `origin/feat/quiz-attempts` sont celles de ce chantier, PR #151 ouverte.)
