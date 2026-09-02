# front-developper — Reconstruction des écrans Évaluation (2026-09-02)

## Statut : ✅ livré, buildé, testé en HTTP direct contre la pile réelle, PR ouverte

Branche : `feat/front-evaluations-rebuild`
PR : https://github.com/tquatrework/ClaudeVMA/pull/202 (ouverte, non mergée)

## Contexte

Le chantier backend « Refonte des Evaluations » (`docs/architecture.md`, arbitrage du
2026-09-01) avait été livré et déployé côté `content-catalog-service` (PR #195),
`learning-activity-service` (PR #196-199) et `dashboard-notification-service` (PR #200/201),
mais **le front n'avait jamais été reconstruit** — oubli identifié par l'orchestrateur le
2026-09-02. L'ancien écran (juin 2026) appelait des routes retirées côté serveur
(`POST /evaluations/:id/attempts` → 404 depuis le 2026-09-01).

## Périmètre livré

Les 6 écrans demandés, sur le même patron déjà établi pour Quizz/Exercice :

1. **Catalogue** (`EvaluationCatalogPage` + `EvaluationSearchCatalog`) — recherche par
   tag/mot-clé, pagination.
2. **Création** (`EvaluationForm` + `EvaluationExercisePicker` + `EvaluationMetadataFields`
   + `EvaluationCreationSection`) — titre, métadonnées, sélection ordonnée d'Exercices déjà
   validés, durée obligatoire. **Pas d'édition** : aucune route `PUT /evaluations/:id` côté
   serveur (confirmé par `.claude/reports/content-catalog-service-evaluations-2026-09-01.md`).
   Une évaluation `rejected` se resoumet telle quelle (`MyEvaluationsList`).
3. **Passage chronométré** — deux pages partageant le même cœur
   (`EvaluationAttemptSessionView`) :
   - `EvaluationAttemptPage` (`/content/evaluations/:evaluationId/attempt`) : démarrage.
   - `EvaluationAttemptResumePage` (`/content/evaluations/attempts/:attemptId`) : reprise
     d'une tentative déjà en cours, lien profond depuis l'historique. Nouvelle route,
     aucune entrée de menu créée.
   Décompte visible (`useCountdownTimer`, hook transverse réutilisable), réponse par bloc
   « question » de chaque Exercice de la suite (`EvaluationExercisePlayer`, réutilise
   `ExerciseContentItemView` pour le rendu lecture seule énoncé/image), aucune solution
   jamais accessible (conforme à l'arbitrage : la correction ne compare jamais à la
   solution). « Enregistrer ma réponse » (clôture) et « Demander une correction » sont deux
   actions distinctes et non couplées, comme spécifié.
4. **File de correction professeur** (`EvaluationCorrectionQueueList` — accepter/refuser)
   et **corrections prises en charge** (`MyEvaluationCorrectionsList` — lecture de la
   réponse élève à la demande, score + commentaire), regroupées dans l'onglet
   « Corrections » (`EvaluationCorrectionsTab`) de la page catalogue.
5. **Vue RP** — même onglet « Corrections », même file (`GET /evaluation-corrections/pending`
   renvoie aussi les demandes `all_declined` pour le RP, état actionnable d'escalade) ; le
   RP peut accepter en override mais jamais refuser (route réservée au professeur lié,
   `canDecline` calculé sur le rôle exact).
6. **Historique élève** (`EvaluationAttemptHistoryList` via `useEvaluationAttemptHistory`,
   qui résout le titre — jamais un UUID affiché) — reprise d'une tentative `in_progress`,
   demande de correction différée pour une tentative `completed`.

## Gaps backend documentés, jamais comblés par une route inventée

- **Pas de `PUT /evaluations/:id`** : `MyEvaluationsList` n'a pas de bouton « Modifier »,
  contrairement à `MyExercisesList`/`MyQuizzesList`.
- **Pas de `GET /evaluations/pending-validation`** : `fetchPendingEvaluations`/
  `fetchMyEvaluations` (`api/evaluations.ts`) réutilisent `GET /evaluations` (qui renvoie
  tous statuts pour formateur/AP/RP, confirmé par le rapport `content-catalog-service`) et
  filtrent côté client (`status === 'pending_validation'`, `authorId === user.id`). Le
  scoping réel par relation `animator_of_teacher` reste appliqué côté serveur au moment de
  la décision (`POST /validations/evaluation/:id/decision`) — le filtrage client n'est donc
  qu'un confort d'affichage, pas une règle de droit.
- `ContentValidationQueue.tsx`/`ContentValidationQueuePage.tsx` (écran générique
  `/content/validation`) mis à jour pour utiliser la vraie route de décision d'Évaluation
  plutôt que le retrait optimiste hérité de juin — cohérent avec ce qui avait déjà été fait
  pour Exercice/Quizz.

## Bugs trouvés et corrigés par la preuve HTTP directe

Deux écarts entre mon hypothèse initiale et le contrat réel du serveur, trouvés en testant
le cycle complet contre la pile réelle avant d'écrire ce rapport (pas seulement `tsc`/build) :

1. `POST /evaluations` exige `exerciseItems[].order >= 1` — le front envoyait un index
   0-based (`400 "exerciseItems.0.order must not be less than 1"`). Corrigé
   (`index + 1` dans `EvaluationForm.tsx`) — distinct de l'ordre des blocs d'Exercice, qui
   lui part bien de 0 (deux DTO différents, pas la même convention).
2. `tags` est renvoyé `null` (pas `[]`) par le serveur quand aucun tag n'a été fourni à la
   création, alors que `Evaluation.tags` est déclaré non-nullable (même convention que
   Quizz/Exercice). Normalisé dans `api/evaluations.ts` (`normalizeEvaluation`) pour ne
   jamais faire planter un `.map`/`.length` côté composants — sans ce correctif,
   `EvaluationSearchCatalog`/`EvaluationValidationList` auraient planté sur toute évaluation
   créée sans tag.

Le reste du contrat (formes `Evaluation`, `EvaluationAttemptView`,
`EvaluationCorrectionRequest`, corps de `POST .../answers` déduit par analogie avec
`exercise-attempts`) s'est confirmé **exactement** conforme à ce qui avait été codé à partir
de la lecture de `docs/routes.md` — aucun autre écart trouvé.

## Preuve HTTP directe (cycle complet, comptes créés pour l'occasion)

Contre `https://claudevma.visioprof.fr`, après redéploiement du conteneur `visiomath_frontend`
(image reconstruite depuis la branche, hash de bundle vérifié différent avant/après) :

1. Comptes de test créés via `POST /accounts/teachers`/`/accounts/students` (préfixe
   `evalflow.*`) ; **RP obtenu par promotion de rôle directe en base**
   (`UPDATE users SET role='responsable_pedagogique'` sur `visiomath_identity_access`) — pas
   de route self-service pour ce rôle, cohérent avec la manière dont les comptes `trsflow.rp.*`
   d'un rapport antérieur avaient dû être obtenus.
2. Exercice créé par le RP (auto-validé) — forme confirmée conforme à `docs/routes.md`.
3. Évaluation créée par le RP (`durationSeconds: 300`) → `status: validated`, forme
   `Evaluation` confirmée champ par champ.
4. Élève : catalogue (`GET /evaluations`), démarrage (`POST /evaluation-attempts`) →
   `EvaluationAttemptView` confirmé champ par champ (`deadlineAt`, `answers: []`,
   `timeExpired: false`).
5. Réponse (`POST .../answers` avec `{exerciseId, partId, content}`) → confirmé, l'hypothèse
   déduite par analogie avec `exercise-attempts` était exacte.
6. Clôture (`POST .../submit`) → `status: completed`.
7. Demande de correction **sans professeur lié** → bascule immédiate en `all_declined`
   (conforme à l'arbitrage), visible dans `GET /evaluation-corrections/pending` côté RP.
8. RP accepte en override (`POST .../accept`) → `status: accepted`, `acceptedByTeacherId`
   posé.
9. RP lit le détail (`GET /evaluation-corrections/:id`) → `attemptAnswers` bien joint,
   jamais la solution de l'Exercice.
10. RP corrige (`POST .../correct` avec `score`+`comment`) → `status: corrected`. Confirmé
    que `score` revient en **chaîne décimale** (`"8.00"`) sur les lectures ultérieures
    (`GET .../mine`, détail) — `formatEvaluationCorrectionScore` gère déjà les deux formes.
11. Élève : historique (`GET /evaluation-attempts/history`) et détail de sa propre correction
    (`GET /evaluation-corrections/:id`) → confirmés.
12. **Deuxième tentative, avec professeur lié** (`POST /relations/teacher-student` par le
    RP) → demande de correction `pending`, `linkedTeacherIds` non vide, visible dans la file
    du professeur (`GET /evaluation-corrections/pending`).
13. Refus individuel du professeur (`POST .../decline`) → un seul professeur lié, bascule
    immédiate en `all_declined`, **disparaît de sa propre file** (comportement du hook
    `useEvaluationCorrectionQueue.decline`, confirmé).
14. Cycle de validation : Évaluation créée par un **formateur** → `pending_validation` ;
    rejet RP avec commentaire (`POST /validations/evaluation/:id/decision`) ; historique
    visible par l'auteur formateur (`GET /validations/evaluation/:id/history`, route non
    documentée séparément pour l'Évaluation dans `docs/routes.md` mais confirmée fonctionner
    exactement comme pour Quizz/Exercice) ; resoumission
    (`POST /validations/evaluation/:id/request`) → repasse `pending_validation`.

Aucun compte de test n'a été supprimé après coup (même convention que les comptes
`trsflow.*` laissés par une session antérieure sur cette même pile de test).

## Vérifications

- `npx tsc --noEmit` (depuis `apps/web`) : 0 erreur.
- `npm run build` : succès (warning pré-existant sur la taille du bundle, non aggravé par ce
  chantier).
- Tous les fichiers neufs/modifiés restent sous le seuil de 300 lignes (le plus gros,
  `EvaluationCatalogPage.tsx`, a été redécoupé de 315 à 222 lignes en extrayant
  `EvaluationSearchCatalog.tsx`). `App.tsx` reste à 1034 lignes — fichier de registre de
  routes pré-existant, hors périmètre de ce chantier.
- Pas de tests automatisés (unitaires/Playwright) écrits dans cette session — la preuve
  demandée était un cycle HTTP direct, explicitement listé comme suffisant par le mandat ;
  aucune demande explicite de preuve Playwright reçue.

## Navigation — aucune nouvelle entrée créée

- `/content/evaluations` était déjà présent dans `navigationConfig.ts` (rail élève,
  formateur, AP) — inchangé.
- La file de correction et la vue RP vivent dans l'onglet « Corrections » de la page déjà
  existante, pas une nouvelle route de rail.
- La reprise d'une tentative (`/content/evaluations/attempts/:attemptId`) est un lien
  profond interne (bouton « Continuer » dans l'historique), jamais une entrée de menu.
- **Point à signaler, hors périmètre de ce chantier** : le rail du RP
  (`RAIL_GROUPS_BY_ROLE.responsable_pedagogique`, groupe « Pédagogie ») ne contient
  aujourd'hui qu'une entrée « Quizz », pas « Exercices » ni « Évaluations » — écart
  préexistant (le RP peut y accéder par URL directe, `ProtectedRoute` l'autorise, mais rien
  ne l'y mène depuis le rail). Je ne l'ai pas corrigé : ce serait un ajout de menu, qui
  demande validation explicite. Le signaler ici pour trancher séparément si souhaité.

## Fichiers créés/modifiés (apps/web)

Types : `src/types/evaluation.ts`, `src/types/evaluationAttempt.ts`.
Utils : `src/utils/evaluationLabels.ts`.
API : `src/api/evaluations.ts`, `src/api/evaluationAttempts.ts`, `src/api/evaluationCorrections.ts`
(+ `src/api/contentCatalog.ts` — Évaluations retirées).
Hooks : `src/hooks/useCountdownTimer.ts`,
`src/hooks/content-catalog/{useMyEvaluations,useEvaluationValidationQueue}.ts`,
`src/hooks/learning-activity/{useEvaluationAttemptHistory,useEvaluationCorrectionQueue,useMyEvaluationCorrections}.ts`.
Composants : `src/components/content-catalog/{EvaluationCreationSection,EvaluationExercisePicker,
EvaluationForm,EvaluationMetadataFields,EvaluationSearchCatalog,EvaluationValidationList,
MyEvaluationsList,ContentValidationQueue(modifié)}.tsx`,
`src/components/learning-activity/{EvaluationAttemptHistoryList,EvaluationAttemptSessionView,
EvaluationCorrectionQueueList,EvaluationCorrectionsTab,EvaluationExercisePlayer,
MyEvaluationCorrectionsList}.tsx`.
Pages : `src/pages/{EvaluationCatalogPage,EvaluationAttemptPage}.tsx` (réécrites),
`src/pages/EvaluationAttemptResumePage.tsx` (neuf),
`src/pages/ContentValidationQueuePage.tsx` (modifié).
Routes : `src/App.tsx` (rôles alignés Quizz/Exercice sur `/content/evaluations*`, nouvelle
route de reprise).
Docs : `docs/api-mapping.md` (nouveaux helpers listés).
Supprimé : `src/components/content-catalog/EvaluationCreateForm.tsx` (ancien modèle).

## Branches non fusionnées (rappel obligatoire)

`git branch -r --no-merged origin/master` liste, en plus de `feat/front-evaluations-rebuild`
(cette PR) : `feat/front-reprise-candidature-formateur`, `feat/reprise-candidature-formateur`
— non liées à ce chantier, signalées pour information.
