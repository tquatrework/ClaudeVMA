# learning-activity-service — Tentatives d'Évaluation, correction manuelle, notifications

Date : 2026-09-01
Branche : `feat/learning-activity-evaluation-attempts`
PR : https://github.com/tquatrework/ClaudeVMA/pull/196

## Contexte

Source de vérité : `docs/architecture.md`, section « Refonte des Evaluations : notation manuelle,
demande de correction, notifications » (arbitrage du 2026-09-01), et section « Fonctionnalite
Quizz » du 2026-08-28 pour le précédent notifications (outbox Redis) et le scoping AP
`animator_of_teacher`.

`content-catalog-service` porte la définition de l'Évaluation (titre, niveau, difficulté, thème,
tags, `durationSeconds`, liste ordonnée d'Exercices via `exerciseItems`) et son cycle de
validation — développé en parallèle sur le même arbitrage, sans coordination synchrone possible
pendant ce chantier. `learning-activity-service` porte tout le cycle de vie de la tentative d'un
utilisateur : démarrage chronométré, réponses, clôture, demande de correction humaine, historique.

## Ce qui a été livré

### Module `evaluation-attempts/`

- **`EvaluationAttempt`** : `evaluationId`, `userId`, `userRole`, `status`
  (`in_progress`/`completed`/`abandoned`), `exerciseIds` (snapshot des Exercices de l'Évaluation
  pris au démarrage), `answers` (une entrée par `(exerciseId, partId)`, contenu texte/formule/image
  — même mécanisme que Memo/Exercice), `startedAt`, `deadlineAt` (calculé `startedAt +
  durationSeconds`), `completedAt`.
- **`EvaluationCorrectionRequest`** : machine à états `pending → accepted → corrected`, ou
  `pending → all_declined`. Premier arrivé premier servi à l'acceptation (tout `accept` suivant
  échoue explicitement en 400). Chaque professeur lié peut refuser indépendamment ; bascule en
  `all_declined` seulement quand **tous** les professeurs **actuellement** liés (relus en direct
  auprès de `profile-service` à chaque `accept`/`decline`, jamais en cache) ont refusé. Le RP peut
  accepter en override d'escalade, y compris depuis `all_declined` — traduit « le RP gère
  manuellement » de l'arbitrage sans construire de mécanisme de réassignation séparé.
- **Aucune lecture de solution d'Exercice dans ce flux** (point 6 de l'arbitrage, confirmé
  explicitement par l'utilisateur) : le correcteur ne lit que la réponse soumise par l'élève sur
  la tentative visée.
- **Premier système de notifications de ce service** : outbox transactionnel (`domain_events`) +
  publication Redis `XADD` sur `visiomath:events`, réutilisant exactement le pattern documenté
  pour `teacher-request-service` (2026-08-14) — `EventsService.emit()` n'échoue jamais l'action
  métier appelante, un cycle de rattrapage (15s) republie les événements non publiés en cas
  d'indisponibilité de Redis. 5 types d'événements émis :
  `EvaluationCorrectionRequested`/`Accepted`/`Declined`/`AllDeclined`, `EvaluationCorrected`.

### Contrat exact des routes (pour `front-developper` et pour la délégation
`dashboard-notification-service`)

Documenté en détail dans `docs/routes.md`, section `## learning-activity-service` (avec les DTOs
complets). Résumé :

| Méthode | Chemin | Rôles |
|---|---|---|
| POST | `/evaluation-attempts` | eleve, formateur, animateur_pedagogique, responsable_pedagogique |
| POST | `/evaluation-attempts/:id/answers` | idem |
| POST | `/evaluation-attempts/:id/submit` | idem |
| POST | `/evaluation-attempts/:id/request-correction` | idem |
| GET | `/evaluation-attempts/history` | tout compte authentifié |
| GET | `/evaluation-attempts/:id` | propriétaire uniquement (404 sinon) |
| GET | `/evaluation-corrections/pending` | formateur, responsable_pedagogique |
| GET | `/evaluation-corrections/mine` | formateur, responsable_pedagogique |
| GET | `/evaluation-corrections/:id` | élève propriétaire, professeur lié, RP |
| POST | `/evaluation-corrections/:id/accept` | formateur lié, responsable_pedagogique |
| POST | `/evaluation-corrections/:id/decline` | formateur lié |
| POST | `/evaluation-corrections/:id/correct` | l'accepteur (professeur ou RP) |

Événements Redis (`visiomath:events`) et leurs destinataires prévus — table complète dans
`docs/routes.md` :
- `EvaluationCorrectionRequested` → chaque professeur lié (individuel) + rôle RP.
- `EvaluationCorrectionAccepted` / `Declined` → rôle RP.
- `EvaluationCorrectionAllDeclined` → rôle RP (état actionnable, doit apparaître dans
  `GET /evaluation-corrections/pending`).
- `EvaluationCorrected` → l'élève.

## Points de coordination / blocages

1. **`GET /evaluations/:id` (content-catalog-service) — non confirmé contre une PR réelle.**
   Développé en parallèle sur le même arbitrage (alignement du cycle de validation sur
   Quizz/Exercice, `durationSeconds` rendu obligatoire, retrait de `evaluation_attempts`).
   `EvaluationStructureClientService` valide strictement `status`/`durationSeconds`
   (nombre > 0)/`exerciseItems` et lève une `502` explicite en cas d'écart — aucune absorption
   silencieuse, mais preuve de bout en bout impossible avant déploiement conjoint.
2. **`GET /internal/relations/teachers/:studentId` (profile-service) — HYPOTHÈSE non confirmée.**
   Aucune route de ce type n'est documentée dans `docs/architecture.md` pour la relation
   élève→professeurs (contrairement à `GET /internal/relations/finance-owners/:studentId`, sur
   laquelle cette route a été construite par stricte analogie de forme et de préfixe). Hors
   périmètre de lecture de cet agent (règle projet « Interfaces externes : jamais lire le code
   source d'un autre service »). Un `404` amont est traité comme liste vide (dégradation
   gracieuse), toute autre divergence de forme lève une `502`. **À vérifier/créer côté
   `profile-service` avant toute preuve de bout en bout réelle du flux de correction.**
3. **Délégation `dashboard-notification-service` à mener séparément** : aucun des 5 types
   d'événements n'est aujourd'hui consommé. Contrat exact (payloads, destinataires) documenté
   dans `docs/routes.md` et ci-dessus.

## Décisions techniques notables

- Deux entités séparées (`EvaluationAttempt`, `EvaluationCorrectionRequest`) plutôt qu'une seule
  comme `QuizAttempt` : la demande de correction a un cycle de vie asynchrone impliquant des tiers
  (professeurs, RP), contrairement à la notation Quizz (aller-retour synchrone unique).
- `exerciseIds` figé au démarrage pour valider les réponses sans revalider la structure de chaque
  Exercice référencé à chaque soumission — simplification assumée : `partId` n'est **pas**
  cross-validé contre la vraie structure de l'Exercice (contrairement à `exercise-attempts`, qui
  ne référence qu'un seul Exercice et peut se permettre de seeder tous ses blocs).
- `submitAnswer` refuse après l'échéance (verrouillage de confiance, pas anti-triche durci —
  conforme à l'arbitrage), mais `submit` (clôture) reste autorisé même après l'échéance : il ne
  rouvre aucune fenêtre de saisie, il fige simplement l'état existant.
- `ioredis` ajouté comme nouvelle dépendance directe (déjà présente en transitif). `REDIS_URL` et
  `PROFILE_SERVICE_URL` ajoutées à `docker-compose.yml` pour ce service (absentes jusqu'ici), plus
  dépendance de démarrage sur `redis` (`condition: service_healthy`).
- Aucune migration ajoutée : `NODE_ENV=development` sur la pile réelle (point ouvert déjà
  documenté) fait créer les nouvelles tables par `synchronize`, même convention que
  `QuizAttempt`/`ExerciseAttempt`.

## Tests

199 tests unitaires (127 existants + 72 nouveaux), tous verts. `npm run build` et `tsc --noEmit`
sans erreur. **Aucune preuve HTTP directe contre la pile réelle** dans cette session — contrainte
explicite de la délégation (pas de build/déploiement par cet agent). Preuve à faire par
l'orchestrateur après déploiement conjoint avec `content-catalog-service` (et création de la route
`profile-service` ci-dessus si elle n'existe pas encore) : démarrer une tentative, vérifier la
deadline, soumettre une réponse, clôturer, demander une correction, vérifier son apparition côté
professeur lié (`GET /evaluation-corrections/pending`), accepter (et vérifier qu'un second accept
échoue proprement en 400), corriger, vérifier l'historique élève.

## Branches non fusionnées constatées (rappel, hors périmètre de ce chantier)

`git branch -r --no-merged origin/master` liste, en plus de `feat/learning-activity-evaluation-attempts` (cette PR) :
`feat/content-catalog-evaluation-lifecycle`, `feat/content-catalog-exercise-image-block`,
`feat/content-catalog-title-disambiguation-step1`, `feat/content-catalog-title-uniqueness-step2`,
`feat/exercises-front`, `feat/front-reprise-candidature-formateur`,
`feat/reprise-candidature-formateur`, `fix/api-gateway-exercise-attempts-proxy`,
`fix/content-catalog-exercise-image-storage`, `fix/content-catalog-exercise-title-and-solutions`,
`fix/exercise-edit-solution-image-and-navigation`, `fix/front-exercises-post-test-feedback`.
Plusieurs semblent liées au même chantier Évaluations/Exercices en cours côté
`content-catalog-service`/front — signalé pour information, pas traité ici.
