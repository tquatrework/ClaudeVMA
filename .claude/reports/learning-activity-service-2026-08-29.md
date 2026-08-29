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

---

## Addendum — alignement sur le contrat confirmé par `content-catalog-service` (PR #184)

Le coordinateur a transmis le contrat exact confirmé par la PR #184 de `content-catalog-service`.
Comparaison avec l'implémentation initiale (ci-dessus) et corrections apportées sur la même
branche, avant tout merge :

### Écarts trouvés et corrigés

1. **Nom de champ `value` → `content`.** L'implémentation initiale utilisait `{type, value}` pour
   les items de contenu (réponse soumise et solution mise en cache). Le contrat réel de
   `content-catalog-service` utilise `content`, pas `value`, aussi bien pour les items de
   `GET /exercises/:id` que pour ceux de la route interne de solution. **Corrigé** :
   `ExerciseContentItemDto.value` → `ExerciseContentItemDto.content` ; l'ancienne interface unique
   `ExerciseContentItem` de l'entité est scindée en deux — `ExerciseAnswerItem` (`{type, content}`,
   propre à ce service pour la réponse de l'élève) et `ExerciseSolutionItem` (`{id, type, order,
   content, imageMimeType?, imageSizeBytes?}`, forme exacte reçue de content-catalog-service,
   stockée telle quelle dans `revealedContent`). C'était le bug le plus sérieux : la validation
   stricte côté `ExerciseSolutionClientService.isValidSolutionResult` aurait rejeté **toute**
   vraie réponse de `content-catalog-service` en 502, faute du bon nom de champ.
2. **Pas de champ `imageId` séparé pour les items image ; nouvelle route interne d'octets.** Non
   géré du tout dans la première passe (aucun mécanisme de récupération d'image de solution
   n'existait). **Ajouté** :
   - `ExerciseSolutionClientService.getImageBytes(itemId, correlationId)` — appelle
     `GET /internal/exercises/images/:itemId` (`X-Internal-Secret`), lit les octets bruts
     (`response.arrayBuffer()`, jamais de parsing JSON) et le `Content-Type` de la réponse.
   - `ExerciseAttemptsService.getRevealedImage(attemptId, itemId, userId, userRole, correlationId)`
     — vérifie que `itemId` appartient à un item `type: 'image'` d'une solution **déjà révélée**
     sur **cette** tentative (recherche dans les `revealedContent` de toutes les
     `ExerciseAttemptPart` de la tentative) avant d'appeler `getImageBytes` : aucun id orphelin
     n'est accepté à l'aveugle, même si `content-catalog-service` le servirait techniquement — pas
     de fuite d'une solution non révélée par ce biais.
   - Nouvelle route publique `GET /exercise-attempts/:id/images/:itemId` sur le contrôleur, en
     proxy authentifié : `@Res({ passthrough: true })` sur le modèle déjà établi par
     `ActivitiesController` (export CSV de `open-activities`), `Content-Type` forwardé, corps =
     `Buffer` brut, jamais de base64 dans du JSON — cohérent avec le choix de
     `content-catalog-service` sur sa propre route interne.
3. **Gestion d'erreur "un seul 404, jamais de 400 dédié" — déjà conforme, aucune correction
   nécessaire.** Vérification faite : le design initial garantissait déjà ce comportement sans le
   savoir explicitement.
   - `ExerciseAttemptsService.findPartOrFail()` ne trouve **jamais** un `partId` de catégorie
     `statement` dans `ExerciseAttemptPart`, puisque seuls les blocs `question` y sont seedés au
     démarrage (`start()` filtre `category === 'question'`) — un appel de révélation sur un bloc
     `statement` échoue donc déjà en 404 **avant même d'atteindre** `content-catalog-service`.
   - `ExerciseSolutionClientService.reveal()` n'a jamais traité de 400 comme un cas distinct :
     seul `404` est spécifiquement intercepté (`NotFoundException`), tout le reste `≥400` non-404
     tombe déjà dans le cas générique `502` (`BadGatewayException`). Un test explicite a été
     ajouté (`400 → 502, jamais un cas spécial`) pour figer ce comportement et prévenir toute
     régression future qui introduirait par erreur une distinction 400.

### Ce qui n'a pas changé

- `ExercisePartSummary` (structure) : `id`/`category` suffisaient déjà et restent la seule base de
  la validation ; les champs réels supplémentaires (`partNumber`, `items`, `hasSolution`) sont
  maintenant documentés dans l'interface TypeScript comme optionnels et non consommés, sans
  imposer de validation inutile dessus.
- Aucune modification du flux `start()`/`submitAnswer()`/`findOne()`/`history()` au-delà du
  renommage de champ — la logique métier (seed des blocs question, idempotence de la réponse,
  calcul de statut, historique mixte) était déjà correcte.

### Tests

18 nouveaux tests (109 → **127**, tous verts) : validation stricte du nouveau format d'item
(id/order/content requis, `value` explicitement rejeté), item image avec
`imageMimeType`/`imageSizeBytes`, `getImageBytes` (nominal, repli `Content-Type`, configuration
manquante, service injoignable, 404, 502), `getRevealedImage` (nominal, id orphelin refusé, id
appartenant à un autre bloc refusé, tentative d'un tiers refusée, rôle refusé, échec amont
propagé), et le test figeant le comportement 400→502 côté client de solution. `npx nest build`
recompile sans erreur.

### Toujours en attente

Aucune preuve de bout en bout contre la pile réelle : `content-catalog-service` n'a pas encore
déployé sa PR #184 au moment de cette correction. Le contrat est maintenant figé par des tests
qui reproduisent exactement la forme confirmée par le message de coordination, mais un
déploiement conjoint reste nécessaire pour une vérification réelle — en particulier
`GET /internal/exercises/images/:itemId`, jamais exercée en conditions réelles ici.
