# Rapport — learning-activity-service — 2026-08-29

## Objectif

Construire l'équivalent du cycle de vie `quiz-attempts` pour les **Exercices**, côté
`learning-activity-service`, en parallèle d'une refonte de `content-catalog-service` sur le même
contrat (PR #181, arbitrage `docs/architecture.md` > « Refonte des Exercices », branche
`docs/exercises-rebuild-arbitrage`, pas encore mergée au moment de ce chantier).

Contrairement au Quizz, un Exercice n'a **aucune notation, aucune correction automatique** : c'est
de l'auto-contrôle — l'élève répond (ou non) à certaines questions, et révèle (ou non) certaines
solutions, à son rythme.

## Branche et PR

- Branche : `feat/exercises-rebuild-learning-activity` (depuis `master`, à jour).
- PR ouverte : https://github.com/tquatrework/ClaudeVMA/pull/183 — **non mergée**, en attente de
  validation utilisateur, comme l'exige le workflow du projet.
- Commit unique poussé : `d69144c` — 17 fichiers, 1757 insertions.

## Ce qui a été construit

### Entités

- `ExerciseAttempt` (`src/exercise-attempts/entities/exercise-attempt.entity.ts`) : `id`,
  `exerciseId`, `userId`, `userRole`, `startedAt`, `updatedAt`. Ne duplique jamais la définition de
  l'exercice (titre, énoncés, tags).
- `ExerciseAttemptPart` (`src/exercise-attempts/entities/exercise-attempt-part.entity.ts`) : une
  ligne par bloc **question** de l'exercice (`partId` défini par `content-catalog-service`), créée
  au démarrage de la tentative. Porte `answerContent`/`answeredAt` (réponse facultative) et
  `solutionRevealed`/`revealedAt`/`revealedContent` (indicateur + contenu mis en cache une fois
  révélé, pour ne jamais redemander la même solution à `content-catalog-service`). Index unique
  `(attemptId, partId)`. Interface `ExerciseContentItem` (`type: 'text'|'formula'|'image'`,
  `value: string`), même mécanisme que le Memo.
- C'est ce qui remplace conceptuellement l'ancien `ExerciseAnswer` de `content-catalog-service`
  (reconstruction, pas migration de données — conforme à l'arbitrage).

### DTOs

- `StartExerciseAttemptDto` : `{ exerciseId }`.
- `SubmitExerciseAnswerDto` : `{ partId, content: ExerciseContentItemDto[] }` (au moins 1 item,
  validation imbriquée).
- `RevealExerciseSolutionDto` : `{ partId }`.
- `ExerciseContentItemDto` + enum `ExerciseContentItemType` (`text`/`formula`/`image`).

### Clients HTTP vers `content-catalog-service`

- `ExerciseStructureClientService` — appelle la route **publique authentifiée**
  `GET /exercises/:id`, en forwardant l'en-tête `Authorization` reçu par le contrôleur (pas de
  `X-Internal-Secret` ici, contrairement au Quizz : cette route n'est pas interne). Valide
  strictement la forme reçue (`{ id, parts: [{ id, category }] }`) avant de faire confiance ; toute
  divergence lève une `502 BadGatewayException` explicite, jamais une absorption silencieuse.
  Gère `404` (exercice inconnu), `401`/`403` (accès refusé → `ForbiddenException`), échec réseau
  (`503`).
- `ExerciseSolutionClientService` — appelle la route **interne**
  `POST /internal/exercises/:exerciseId/parts/:partId/solution` avec `X-Internal-Secret`, même
  modèle que `QuizGradingClientService`. Valide strictement `{ content: [{type, value}] }`.

### Service métier (`exercise-attempts.service.ts`)

- `start()` : contrôle de rôle (élève/formateur/RP/AP — mêmes 4 rôles que le Quizz), lit la
  structure via `ExerciseStructureClientService`, ne garde que les blocs `category: 'question'`,
  crée `ExerciseAttempt` + une `ExerciseAttemptPart` par bloc question. Un exercice sans bloc
  question démarre `done` d'emblée (vérité vacueuse, cas limite non couvert explicitement par la
  spécification transmise, documenté et testé).
- `submitAnswer()` : idempotent — remplace la réponse existante pour le `partId` donné. `404` si le
  bloc n'existe pas pour cette tentative, `404` si la tentative n'existe pas ou appartient à un
  tiers (pas de fuite d'existence, convention déjà appliquée partout ailleurs dans le projet).
- `reveal()` : idempotent — si `solutionRevealed` est déjà vrai, renvoie le contenu mis en cache
  **sans** rappeler `content-catalog-service`. Sinon, appelle `ExerciseSolutionClientService`,
  persiste `solutionRevealed = true`, `revealedAt`, `revealedContent`. Un échec amont (503/404/502)
  est propagé sans marquer la solution comme révélée (pas de résultat partiel persistant).
- `findOne()` : calcule le statut (`done` si toutes les questions sont répondues **ou** toutes
  révélées, sinon `in_progress`), jamais persisté — recalculé à chaque lecture depuis les
  `ExerciseAttemptPart`.
- `history()` : **toutes** les tentatives de l'utilisateur (passées et en cours), avec leur statut
  — différence assumée avec `quiz-attempts.history()` qui ne renvoie que les tentatives terminées
  (un Quizz a une notion de clôture, pas un Exercice).

### Contrôleur (`exercise-attempts.controller.ts`)

`POST /exercise-attempts`, `POST /exercise-attempts/:id/answers`, `POST /exercise-attempts/:id/reveal`,
`GET /exercise-attempts/history`, `GET /exercise-attempts/:id` — Swagger complet
(`@ApiOperation`/`@ApiResponse` par code), route `history` déclarée avant `:id` pour éviter toute
capture ambiguë.

### Module et app.module.ts

`ExerciseAttemptsModule` enregistré ; `ExerciseAttempt` et `ExerciseAttemptPart` ajoutées aux
entités TypeORM de `AppModule`. Aucune migration nécessaire : `synchronize` (hors production) crée
les nouvelles tables comme pour `QuizAttempt`. `CONTENT_CATALOG_SERVICE_URL` et `INTERNAL_SECRET`
sont déjà déclarées dans `docker-compose.yml` pour ce service depuis le chantier Quizz — aucune
modification d'infrastructure nécessaire.

## Tests

- 3 nouvelles suites, 25 nouveaux tests (109 au total pour le service, tous verts) :
  - `exercise-attempts.service.spec.ts` : démarrage rôle autorisé (élève + les 3 autres rôles via
    `it.each`) / refusé (parent financeur, avant tout appel réseau), seed uniquement des blocs
    question, exercice sans question → `done` d'emblée, propagation d'un échec de
    `content-catalog-service` au démarrage ; soumission nominale + idempotente (remplace),
    réponse à un bloc inexistant (404), tentative introuvable/d'un tiers (404) ; révélation
    nominale + idempotente (pas de second appel réseau), bloc/tentative introuvables, échec amont
    propagé sans marquer révélé ; calcul de statut (`done` par révélation totale, `done` par
    réponse totale, `in_progress` sinon) ; historique mixte (tentatives en cours et terminées).
  - `exercise-structure-client.spec.ts` : appel nominal (Authorization + x-correlation-id
    forwardés), absence d'Authorization si non fourni, configuration manquante, service
    injoignable, 404 amont, 401/403 amont (→ 403), échec HTTP générique, JSON illisible, réponse
    malformée (parts manquant, catégorie invalide).
  - `exercise-solution-client.spec.ts` : appel nominal (X-Internal-Secret + x-correlation-id),
    configuration manquante, service injoignable, 404 amont, échec HTTP générique, JSON illisible,
    réponse malformée (content manquant, type d'item invalide).
- `npm test` : 109/109 passés.
- `npx nest build` : compile sans erreur.
- **Pas de preuve de bout en bout contre la pile réelle** : `content-catalog-service` n'expose pas
  encore `GET /exercises/:id` (nouveau format) ni la route interne de solution au moment de ce
  chantier (PR #181 en cours de développement en parallèle, sans coordination synchrone possible).
  Conforme à la consigne — c'est un point à couvrir une fois les deux PR alignées.

## Décisions techniques notables

- **Deux tables plutôt qu'une seule** (contrairement à `QuizAttempt`, qui tient tout dans un seul
  jsonb `details`) : une tentative d'Exercice a un état par bloc question qui évolue
  indépendamment (réponse et révélation possibles simultanément, sans notation) — une table de
  détail par question colle mieux au modèle qu'un blob unique.
- **Statut jamais persisté**, toujours recalculé — évite toute désynchronisation entre un champ
  `status` stocké et l'état réel des `ExerciseAttemptPart`.
- **Révélation idempotente** (pas de second appel réseau si déjà révélé) : choix pris pour
  cohérence avec le point 8 de l'arbitrage (« jamais redemander une fois révélé ») ; la
  spécification transmise ne précisait pas explicitement ce cas, signalé ci-dessous.
- **Forward de `Authorization` plutôt que `X-Internal-Secret`** pour le client de structure,
  puisque `GET /exercises/:id` est documentée comme route publique authentifiée et non interne —
  différence assumée avec le client de solution (interne).

## Points de vigilance / hypothèses à vérifier contre `content-catalog-service`

1. **Forme exacte de `GET /exercises/:id`** — supposée `{ id, parts: [{id, category}, ...] }`
   (d'autres champs éventuels sont ignorés par ce client, pas un problème). À confirmer une fois la
   PR #181 ouverte côté `content-catalog-service`.
2. **Forme exacte de `POST /internal/exercises/:exerciseId/parts/:partId/solution`** — supposée
   `{ content: [{type, value}, ...] }`, sans body en entrée (aucun paramètre nécessaire hors
   `exerciseId`/`partId` dans l'URL). À confirmer.
3. **Authentification de `GET /exercises/:id`** — ce service suppose que le JWT forwardé (même
   `JWT_SECRET` que celui vérifié par ce service) suffit à authentifier l'appel auprès de
   `content-catalog-service`, comme toute route publique authentifiée du projet. Non vérifiable
   sans lire le code de `content-catalog-service` (hors périmètre autorisé pour cet agent) — à
   confirmer une fois la PR ouverte.
4. Les deux clients valident strictement la forme de toute réponse reçue et lèvent une `502`
   explicite en cas d'écart : aucun risque d'absorption silencieuse même si l'une des hypothèses
   ci-dessus s'avère fausse, mais un déploiement conjoint sera nécessaire pour une vérification
   réelle bout en bout.

## Hors périmètre (conforme à l'arbitrage)

- Aucun timer (explicitement différé par l'utilisateur, point 7 de l'arbitrage).
- Aucun passage par l'orchestrateur (le service possède tout le cycle de vie, appels à
  `content-catalog-service` uniquement pour lire des faits).
- Partage des réponses ("potentiellement partageables") non implémenté, remis à plus tard sur les
  Évaluations plutôt que sur l'Exercice (point 4 de l'arbitrage).

## Documentation mise à jour

`docs/services/learning-activity-service.md` — nouvelle session `implementationSession` datée
2026-08-29, arborescence complète, décisions techniques et points en suspens.
