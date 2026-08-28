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
