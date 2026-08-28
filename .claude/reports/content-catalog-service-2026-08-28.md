# Rapport — content-catalog-service — 2026-08-28

## Objectif

Implémenter la **création et la définition** du Quizz dans `content-catalog-service`, conformément
à l'arbitrage de répartition avec `learning-activity-service` posé le même jour dans
`docs/architecture.md` ("Fonctionnalite Quizz, et repartition generale..."). Le passage/l'historique
du Quizz sont hors périmètre (portés par `learning-activity-service`, développé en parallèle par un
autre agent).

Branche : `feat/quiz-definition`
PR : https://github.com/tquatrework/ClaudeVMA/pull/152 (ouverte, non mergée)

## Ce qui a été livré

### Modèle de données

- `Quiz` (`src/quizzes/entities/quiz.entity.ts`) : titre, description, `tags` (colonne postgres
  `text[]` **native**, volontairement différente du `simple-array` utilisé ailleurs dans le
  service, pour permettre une recherche par tag exacte via `ANY(tags)`), `authorId`/`authorRole`,
  `status` (réutilise `ContentStatus`), barème global (`defaultPoints`, défaut 1), pénalité globale
  (`penaltyEnabled`/`penaltyPoints`), `shareableLink`.
- `QuizQuestion` (`src/quizzes/entities/quiz-question.entity.ts`), FK CASCADE vers `Quiz` :
  `category` (single_choice / multiple_choice / short_text), `prompt`, `options` (forme publique
  `{id, text}` uniquement), **`correctOptionIds`** et **`keywords`** — la solution, jamais exposée
  par une route publique —, modes de notation (`multipleChoiceScoringMode`,
  `shortTextScoringMode`), barème/pénalité **individuels** (`pointsOverride`,
  `penaltyEnabledOverride`, `penaltyPointsOverride`) qui prévalent sur le réglage global du quizz
  quand ils sont renseignés.

### Routes publiques (`src/quizzes/quizzes.controller.ts`)

| Route | Rôles | Notes |
|---|---|---|
| `GET /quizzes` | tous | recherche par `tag`/`keyword`, paginée, ne renvoie jamais les questions (liste de synthèse) |
| `POST /quizzes` | formateur, AP, RP | statut initial `pending_validation` (formateur) ou `validated` (AP/RP, auto-validé) ; `400` explicite si une question est mal formée |
| `GET /quizzes/pending-validation` | AP, RP | file de travail, déclarée avant `:id` pour éviter la capture de route |
| `GET /quizzes/:id` | tous | jamais la solution ; `404` (jamais `403`) si non visible pour l'appelant |

Le créateur marque directement `isCorrect` sur chaque option à la création
(`CreateQuizQuestionOptionDto`) ; le service sépare ensuite la forme publique (`options: {id,
text}`) de la solution (`correctOptionIds`) avant toute persistance/sérialisation.

### Validation AP/RP — réemploi du flux générique existant

Plutôt que de construire une route bespoke `POST /quizzes/:id/validate`, `ContentType.QUIZ` a été
ajouté à l'énumération partagée, et `ValidationsService.updateContentStatus()` sait désormais
mettre à jour un `Quiz`. Conséquence : `POST /validations/quiz/:id/decision` (validation/rejet,
commentaire obligatoire en cas de rejet) et `POST /validations/quiz/:id/request` (resoumission
après rejet) fonctionnent pour les quizz sans code de contrôleur supplémentaire côté quiz — choix
fait pour suivre au plus près les conventions réelles déjà en place dans ce service.

### Route interne (contrat figé avec `learning-activity-service`)

`POST /internal/quizzes/:quizId/grade` (`src/quizzes/internal-quizzes.controller.ts`), body
`{answers: [{questionId, selectedOptionIds?, text?}]}`, réponse `{score, maxScore, details:
[{questionId, isCorrect, pointsEarned, pointsPossible}]}` — exactement la forme posée dans
`docs/architecture.md`, point 9. `@ApiExcludeController()`, jamais exposée par api-gateway,
protégée par un nouveau guard `InternalSecretGuard` (`src/common/guards/internal-secret.guard.ts`)
qui **échoue fermé** : `401` si `INTERNAL_SECRET` n'est pas configuré côté serveur, plutôt que de
laisser passer (le bug historique documenté pour `profile-service` dans `docs/routes.md`).
`INTERNAL_SECRET` est déjà déclarée dans `docker-compose.yml` pour ce service (valeur par défaut
`change_me_in_production`) — aucune modification d'infra n'a été nécessaire pour ce chantier.

### Notation (`src/quizzes/quiz-grading.util.ts`)

Fonctions **pures**, sans dépendance TypeORM/Nest, testées isolément :

- Choix unique : juste si l'unique option sélectionnée est la bonne.
- Choix multiples, `all_or_nothing` : juste seulement si l'ensemble sélectionné est exactement
  l'ensemble correct. `per_option` : chaque case est jugée **indépendamment** (cochée à raison OU
  décochée à raison compte comme "case réussie") — fraction = cases correctement jugées / nombre
  total de cases, multipliée par le barème effectif.
- Texte court, `all_or_nothing` : juste si tous les mots-clés attendus sont présents (recherche de
  sous-chaîne insensible à la casse). `per_keyword` : fraction = mots-clés trouvés / total attendu.
- Pénalité : ne s'applique **que** si la question a reçu une réponse **et** que cette réponse n'a
  rapporté strictement aucun point — jamais cumulée avec un score partiel, jamais appliquée à une
  absence de réponse.
- Barème/pénalité effectifs = surcharge individuelle si présente, sinon réglage global du quizz,
  sinon 1 point / pas de pénalité (`resolveEffectiveScoring`, exportée et testée seule).

Ces règles de notation par option/mot-clé et la règle de non-cumul pénalité/score partiel
**comblent un blanc de la spécification utilisateur** (qui ne précisait pas ce niveau de détail) —
signalées explicitement ci-dessous comme point à confirmer.

## Vérifications

- `npm run build` (tsc via `nest build`) : 0 erreur.
- `npm test` : **169/169 tests verts, 13 suites** — inclut `quiz-grading.util.spec.ts` (notation
  pure des 3 catégories, barème global/individuel, pénalité), `quizzes.service.spec.ts` (rôles
  créateurs, validation par catégorie de question, visibilité recherche/lecture, notation interne,
  masquage 404 jamais 403), `internal-secret.guard.spec.ts` (échec fermé), et
  `validations.service.quiz.spec.ts` (réemploi du flux générique pour `ContentType.QUIZ`). Les
  fichiers de test préexistants de `ValidationsService` ont été mis à jour (mock du repository
  `Quiz` ajouté) pour rester compilables après l'ajout de la dépendance.
- **Aucune suite e2e n'existe pour ce service** (confirmé avant ce chantier) : la preuve fournie
  est unitaire (service mocké), pas une preuve HTTP contre une pile réelle. À signaler comme limite
  de la preuve — conforme à la règle du projet sur la définition de « terminé », je ne présente pas
  ces tests unitaires comme une validation finale.

## Points signalés à l'orchestrateur / arbitrages implicites pris

1. **Statut initial du quizz, différent du modèle Exercise/Evaluation.** Un quizz créé par un
   formateur démarre directement en `pending_validation` (pas de `draft` + étape de soumission
   séparée comme pour Exercise/Evaluation) — la spécification dit explicitement qu'un quizz de
   professeur "doit être validé... avant d'être visible", sans étape de soumission volontaire
   distincte. Divergence assumée et documentée dans `docs/services/content-catalog-service.md`.
2. **Règles de notation `per_option`/`per_keyword` et non-cumul pénalité/score partiel** : la
   spécification ne précisait pas ce niveau de détail. Interprétation retenue et documentée en
   détail dans le rapport technique du service — à confirmer si l'usage réel du RP/AP/formateur
   révèle une attente différente.
3. **Gap pré-existant confirmé mais non corrigé (hors périmètre de ce chantier)** : en lisant le
   code existant, `SearchExerciseDto`/`SearchEvaluationDto` exposent un champ `tag` qui n'est
   **jamais appliqué** dans `ExercisesService.search()`/`EvaluationsService.search()` (seuls
   level/difficulty/theme sont filtrés). Le nouveau code Quiz implémente correctement le filtre
   tag (nécessaire pour ce chantier), sans corriger ce gap ailleurs.
4. **`.env.example` non modifié** — permission bloquant tout fichier `.env*` (même constat déjà
   documenté par `pedagogical-log-service` le 2026-08-26). Sans impact pratique :
   `INTERNAL_SECRET` est déjà déclarée dans `docker-compose.yml` pour ce service.
5. **Pas de garde de démarrage (`process.exit`) si `INTERNAL_SECRET` est absent**, contrairement au
   choix fait par `profile-service`. Le guard échoue déjà fermé par requête, et `docker-compose.yml`
   fournit déjà une valeur par défaut non vide pour ce service. Ajouter un crash au démarrage aurait
   un rayon d'impact plus large pour un gain marginal ici — à reconsidérer si un incident similaire
   à celui de `profile-service` se reproduit.
6. **Aucun événement métier publié** (ex. `QuizCreated`, `QuizValidated`) — non demandé par la
   spécification, contrairement au flow demande de professeur qui l'exigeait explicitement.

## Branches non fusionnées constatées (rappel, hors périmètre de cette tâche)

En plus de `feat/quiz-definition` (cette tâche, PR #152 ouverte) :
- `feat/quiz-attempts` — vraisemblablement la contrepartie `learning-activity-service` développée
  en parallèle par un autre agent.
- `feat/reprise-candidature-formateur` et `feat/front-reprise-candidature-formateur` — non liées à
  ce chantier, non investiguées.

## Fichiers modifiés/créés (chemins absolus, worktree de cet agent)

- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a2f6969a015e765b5/services/content-catalog-service/src/quizzes/` (nouveau module complet)
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a2f6969a015e765b5/services/content-catalog-service/src/common/guards/internal-secret.guard.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a2f6969a015e765b5/services/content-catalog-service/src/common/enums/content-type.enum.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a2f6969a015e765b5/services/content-catalog-service/src/app.module.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a2f6969a015e765b5/services/content-catalog-service/src/validations/validations.module.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a2f6969a015e765b5/services/content-catalog-service/src/validations/validations.service.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a2f6969a015e765b5/services/content-catalog-service/test/unit/quizzes/`, `test/unit/common/internal-secret.guard.spec.ts`, `test/unit/validations/validations.service.quiz.spec.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a2f6969a015e765b5/docs/routes.md`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a2f6969a015e765b5/docs/services/content-catalog-service.md`

---

# Session 2 — correction de 2 bugs signalés après test HTTP par front-developer

Suite au test de bout en bout du flow Quizz par le subagent front-developer contre le
conteneur réel (PR #152 mergée, redéployée). Deux bugs remontés, tous deux confirmés par
reproduction HTTP directe contre `visiomath_content_catalog` (bypass du gateway, qui ne
routait pas encore vers ces endpoints — corrigé en parallèle par `api-gateway`).

Branche : `fix/quiz-validation-bugs`
PR : https://github.com/tquatrework/ClaudeVMA/pull/160 (ouverte, non mergée)

## Bug 1 — `GET /quizzes/pending-validation` → `500` sans `page`/`limit` en query

**Confirmé par reproduction directe** avant correctif : requête sans query → `500 Internal
server error` ; log serveur : `TypeORMError: Provided "skip" value is not a number.`

**Cause réelle**, établie en lisant le compiled `dist` et le comportement du
`ValidationPipe` global de NestJS (`{whitelist: true, transform: true}`) : pour un
paramètre individuel `@Query('page') page?: number` **sans DTO**, `ValidationPipe`
appelle `transformPrimitive()`, qui fait `return +value` pour un `metatype === Number` —
`+undefined` vaut `NaN`, **pas** `undefined`. Les valeurs par défaut de
`QuizzesService.getPendingValidation(callerRole, page = 1, limit = 20)` ne s'appliquent
qu'à un argument strictement `undefined` : `NaN !== undefined`, donc les défauts ne
s'appliquent jamais, `skip`/`take` valent `NaN`, TypeORM lève une erreur non attrapée →
500. Ceci n'est **pas** spécifique au Quizz : c'est un piège générique de NestJS pour tout
paramètre `@Query()` scalaire optionnel sans DTO — mais c'est la seule route de ce
service qui l'avait.

**Correctif** : nouvelle DTO `PendingValidationQueryDto`
(`src/quizzes/dto/pending-validation-query.dto.ts`), même schéma que `SearchQuizDto`
(déjà utilisée par `GET /quizzes`, qui n'avait pas ce bug précisément parce qu'elle passe
déjà par une DTO). Un champ absent d'une DTO reste `undefined` après transformation, il
n'est jamais coercé en `NaN`. Le contrôleur passe désormais `query.page`/`query.limit` au
service, sans changement côté service.

## Bug 2 — `POST /validations/quiz/:id/decision` → message d'erreur à énumération vide

**Investigation** : contrairement à l'hypothèse initiale transmise par l'orchestrateur
("l'ajout de `ContentType.QUIZ` n'a pas correctement branché les décisions valides"), la
**validation elle-même fonctionnait déjà** pour `'validated'` et `'rejected'` — confirmé
par 2 appels HTTP directs réussis (`201`) avant même toute correction, sur un quizz réel
créé puis validé/rejeté par un AP/RP. Le défaut réel, confirmé par reproduction directe
d'une valeur invalide (`{"decision":"approved"}`) : `400` avec
`"decision must be one of the following values: "` — **liste vide**, quelle que soit la
valeur envoyée.

**Cause réelle** : `ValidateContentDto.decision` utilisait
`@IsEnum([ContentStatus.VALIDATED, ContentStatus.REJECTED])` — un **tableau littéral**
passé à `@IsEnum`, décorateur prévu pour un véritable objet enum TS/JS. `class-validator`
construit la liste affichée dans le message via `validEnumValues()`, qui filtre les clés
dont `isNaN(parseInt(key))` est faux (mécanisme pensé pour ignorer le mapping inverse des
enums numériques `{0: 'A', 'A': 0}`). Sur un tableau, les clés ('0', '1') sont
précisément des index numériques et sont donc **toutes filtrées** → liste vide dans le
message. Bug **pré-existant depuis le tout premier commit du service** (`git log` sur ce
fichier ne montre qu'un commit), partagé par les 4 types de contenu
(exercise/evaluation/tutorial/quiz) — pas une régression introduite par PR #152, révélée
par le test du flow quizz car c'est la première fois que cette route était testée avec
une valeur de décision invalide.

**Correctif** : `@IsIn([ContentStatus.VALIDATED, ContentStatus.REJECTED])` à la place de
`@IsEnum([...])` — `IsIn` est prévu pour un tableau de valeurs autorisées et construit son
message directement à partir du tableau fourni, sans ce filtrage.

## Tests ajoutés

- `test/unit/quizzes/pending-validation-query.dto.spec.ts` : reproduit le mécanisme fautif
  (`ValidationPipe.transform(undefined, {metatype: Number, type:'query', data:'page'})` →
  `NaN`), puis prouve que la nouvelle DTO laisse `page`/`limit` `undefined` en absence de
  query, les convertit correctement quand fournis, et rejette une valeur non numérique ou
  `page < 1`.
- `test/unit/validations/validate-content.dto.spec.ts` : prouve qu'un `decision` invalide
  produit désormais un message listant `validated`/`rejected` (pas vide), et que
  `'validated'`/`'rejected'` restent acceptés.

`npm test` : **182/182 tests verts, 15 suites** (169 précédents + 13 nouveaux).
`npm run build` : 0 erreur.

## Preuve HTTP contre la pile réelle (avant/après)

Conteneur reconstruit (`docker build` depuis le worktree corrigé,
`claudevma-content-catalog-service:latest`) et recréé en place
(`docker stop/rm/run`, mêmes variables d'environnement, même réseau
`claudevma_visiomath_network`, mêmes alias, `restart: unless-stopped` préservé).

| Requête | Avant | Après |
|---|---|---|
| `GET /quizzes/pending-validation` (sans query) | `500` (`TypeORMError: Provided "skip" value is not a number.`) | `200 {"items":[],"total":0}` |
| `GET /quizzes/pending-validation?page=1&limit=5` | `200` (déjà OK) | `200` (non-régression) |
| `POST /validations/quiz/:id/decision` `{"decision":"validated"}` | `201` (déjà OK) | `201` (non-régression) |
| `POST /validations/quiz/:id/decision` `{"decision":"rejected","comment":"..."}` | `201` (déjà OK) | `201` (non-régression) |
| `POST /validations/quiz/:id/decision` `{"decision":"rejected"}` (sans commentaire) | `400` "commentaire obligatoire" (déjà OK) | `400` "commentaire obligatoire" (non-régression) |
| `POST /validations/quiz/:id/decision` `{"decision":"approved"}` (valeur invalide) | `400` `"...values: "` (liste vide) | `400` `"...values: validated, rejected"` |

## Points signalés à l'orchestrateur

1. **Bug 2 n'était pas spécifique au Quizz** : il affecte identiquement
   `/validations/exercise/:id/decision`, `/validations/evaluation/:id/decision` et
   `/validations/tutorial/:id/decision` sur toute valeur de décision invalide — corrigé
   pour les 4 types de contenu en un seul point (`ValidateContentDto` est partagée), sans
   élargir le périmètre demandé.
2. **Le symptôme rapporté ("refuse systématiquement toute valeur de decision") était plus
   fort que le défaut réel constaté** ('validated'/'rejected' fonctionnaient déjà). Le
   message d'erreur vide sur une valeur invalide est l'explication la plus probable de
   cette lecture par le testeur front, mais je n'ai pas pu confirmer l'exacte séquence de
   test qui a produit ce diagnostic — signalé pour transparence, la correction couvre le
   défaut réellement observable.
3. **`NODE_ENV=development` / absence de migrations** (point ouvert déjà consigné dans
   `docs/architecture.md`) : non retouché ici, hors périmètre de cette tâche.

## Fichiers modifiés/créés (chemins absolus, worktree de cet agent)

- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a290631a96d50c80d/services/content-catalog-service/src/quizzes/dto/pending-validation-query.dto.ts` (nouveau)
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a290631a96d50c80d/services/content-catalog-service/src/quizzes/quizzes.controller.ts` (modifié)
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a290631a96d50c80d/services/content-catalog-service/src/validations/dto/validate-content.dto.ts` (modifié)
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a290631a96d50c80d/services/content-catalog-service/test/unit/quizzes/pending-validation-query.dto.spec.ts` (nouveau)
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a290631a96d50c80d/services/content-catalog-service/test/unit/validations/validate-content.dto.spec.ts` (nouveau)
