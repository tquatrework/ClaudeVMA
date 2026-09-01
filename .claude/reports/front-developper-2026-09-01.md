# Refonte des Exercices (front) — reprise après coupure — 2026-09-01

## Statut : ⚠️ Front complet et poussé, deux blocages backend/infra empêchent la preuve complète

PR ouverte, non mergée : https://github.com/tquatrework/ClaudeVMA/pull/186 (branche
`feat/exercises-front`).

## Contexte

Tâche de reprise : une session antérieure avait produit l'intégralité du travail front
(catalogue, création/édition en blocs, validation, passage, historique) dans un worktree isolé
(`agent-af4c8f5eb856afde7`), interrompue par une coupure de connexion **avant tout commit**. Cette
session a dû récupérer ce travail sans jamais pouvoir faire de `git diff`/`git log` sur l'autre
worktree (isolation stricte des agents par worktree, y compris pour les commandes git en lecture
seule) : les 28 fichiers concernés ont été identifiés puis copiés un par un (`cp`, une commande par
fichier — les commandes shell groupées touchant l'autre worktree étaient refusées par le sandbox).

## Ce qui a été fait

1. **Récupération intégrale du travail perdu**, vérifiée fichier par fichier contre l'état attendu
   décrit par la tâche (`git status` identique à celui annoncé).
2. **Relecture complète du code recouvré** avant tout commit : `api/exercises.ts`,
   `api/exerciseAttempts.ts`, tous les composants `content-catalog`/`learning-activity`, hooks,
   pages, `types/exercise.ts`, `utils/exerciseLabels.ts`/`exercisePayload.ts`. Conformité vérifiée
   au contrat documenté (`docs/routes.md` § content-catalog-service), aux conventions du projet
   (état propriétaire de la page, jamais de solution servie directement par
   content-catalog-service, réutilisation des composants Mémo/Quizz pour texte/formule/image),
   et à la règle du fichier < 300 lignes (`ExerciseCatalogPage.tsx` à 305 lignes, jugé non
   découpable sans nuire à la lisibilité — 4 onglets courts et autonomes).
3. **`npx tsc --noEmit`** → 0 erreur. **`npm run build`** → succès.
4. **Commit + push immédiat** dès la relecture terminée (règle de sauvegarde continue), avant toute
   vérification HTTP plus longue.
5. **Preuve HTTP directe contre `https://claudevma.visioprof.fr`** (comptes formateur/élève créés à
   la volée, compte RP de test déjà existant `rptest.proof.*`) :
   - Création d'un exercice multi-blocs (3 blocs, 2 questions avec solution) par un formateur →
     `201`, `status: "pending_validation"`.
   - `GET /exercises/pending-validation` (RP) → l'exercice y figure.
   - `POST /validations/exercise/:id/decision` (RP, `validated`) → `201`.
   - `GET /exercises/:id` (élève) → `status: "validated"`.
   - `GET /exercises?tag=preuve-e2e` (élève) → l'exercice est retrouvé.

   **Ce tronçon (création → validation → recherche) est intégralement prouvé et fonctionnel**,
   exactement comme le code front l'attend.
6. **Deux blocages réels découverts** en poursuivant la preuve (démarrage de tentative, réponse,
   révélation, historique) :
   - `POST /exercises/:id/parts/:partId/images` → `500 "Stockage de l'image d'exercice
     indisponible"` (reproduit deux fois, comptes distincts). Volume Docker probablement non
     provisionné en production (`content-catalog-service`).
   - `GET /exercise-attempts/history` → `404` nginx **brut** (pas une réponse JSON du service),
     alors que `GET /quiz-attempts/history` (même service, même jeton) répond `200`. Confirmé que
     le code front appelle exactement les chemins réels du contrôleur
     `learning-activity-service` (vérifié contre
     `.claude/reports/learning-activity-service-2026-08-29.md`) : `api-gateway` ne proxy tout
     simplement pas le préfixe `/exercise-attempts`.
7. **Documentation de session** ajoutée à `docs/services/frontend-react-app.md` (arborescence,
   décisions, preuve HTTP, points ouverts), commitée et poussée séparément.

## Blocages — hors périmètre `apps/web`

Ces deux points relèvent de `content-catalog-service`/infra et de la configuration
`gateway/api-gateway/nginx.conf` — je ne les ai pas corrigés (hors de mon domaine, et je ne lis/ne
modifie jamais le code des services backend) :

1. Stockage image exercice indisponible (`500` systématique).
2. `api-gateway` ne proxy pas `/exercise-attempts` vers `learning-activity-service` (`404` nginx
   brut).

**Tant que le point 2 n'est pas corrigé, le cycle de passage d'un Exercice (démarrage, réponse,
révélation, statut fait/en cours, historique) ne peut être ni exécuté ni prouvé** — l'écran
`ExerciseDetailPage`/`ExercisePlayer` échouera en production avec un `404` sur `POST
/exercise-attempts` tant que ce n'est pas résolu.

## Vérifications faites

- `npx tsc --noEmit` → 0 erreur.
- `npm run build` → succès.
- Preuve HTTP directe contre la pile réelle (voir ci-dessus) — **partielle**, bloquée par les deux
  points ci-dessus pour la partie learning-activity-service.
- Fichiers au-dessus de 300 lignes : `ExerciseCatalogPage.tsx` (305 lignes) — signalé, non
  découpé (4 onglets courts, aucune extraction cohérente identifiée sans perte de lisibilité).

## Ce qui n'a PAS pu être fait

- Capture d'écran de l'UI réelle : impossible tant que la PR #186 n'est pas mergée et le front
  redéployé (règle du projet : ne jamais merger soi-même).
- Preuve du cycle complet de passage d'un Exercice (démarrage/réponse/révélation/historique) :
  bloquée par le gap `api-gateway` ci-dessus, indépendant du code front.

## Branches non fusionnées (rappel, hors périmètre de cette tâche)

`git branch --no-merged origin/master` / `git branch -r --no-merged origin/master` (relevé en fin
de session) listaient, en plus de `feat/exercises-front` (cette tâche) : `docs/exercises-goal-update`,
`docs/exercises-rebuild-arbitrage`, `docs/quiz-import-spreadsheet-arbitrage`,
`docs/quiz-validation-tab-goal`, `docs/quizz-validation-nav-close`,
`feat/front-reprise-candidature-formateur`, `feat/reprise-candidature-formateur`, plus des
worktrees d'agents résiduels. Non traitées ici.

## Fichiers concernés (chemins absolus)

- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ad28b98fa754f25ee/apps/web/src/api/exercises.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ad28b98fa754f25ee/apps/web/src/api/exerciseAttempts.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ad28b98fa754f25ee/apps/web/src/api/contentCatalog.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ad28b98fa754f25ee/apps/web/src/components/content-catalog/` (ExerciseForm.tsx, ExercisePartEditor.tsx, ExerciseItemListEditor.tsx, ExerciseContentItemView.tsx, ExerciseImageManager.tsx, ExercisePlayer.tsx, ExerciseValidationList.tsx, MyExercisesList.tsx, ExerciseCreationSection.tsx, ContentValidationQueue.tsx)
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ad28b98fa754f25ee/apps/web/src/components/learning-activity/` (ExerciseAttemptContentItemView.tsx, ExerciseAttemptHistoryList.tsx)
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ad28b98fa754f25ee/apps/web/src/hooks/content-catalog/` (useExercisePartImageUrl.ts, useExerciseValidationQueue.ts, useMyExercises.ts)
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ad28b98fa754f25ee/apps/web/src/hooks/learning-activity/` (useExerciseAttemptHistory.ts, useExerciseAttemptImageUrl.ts)
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ad28b98fa754f25ee/apps/web/src/pages/` (ExerciseCatalogPage.tsx, ExerciseDetailPage.tsx, ExerciseEditPage.tsx, ContentValidationQueuePage.tsx)
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ad28b98fa754f25ee/apps/web/src/types/exercise.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ad28b98fa754f25ee/apps/web/src/utils/exerciseLabels.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ad28b98fa754f25ee/apps/web/src/utils/exercisePayload.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ad28b98fa754f25ee/apps/web/src/App.tsx`
- `/home/debian/Documents/claudeVMA/docs/services/frontend-react-app.md`
