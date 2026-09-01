# Refonte des Exercices (front) — reprise après coupure — 2026-09-01

## Statut : ✅ Cycle complet prouvé (HTTP + visuel), PR ouverte non mergée

PR ouverte, non mergée : https://github.com/tquatrework/ClaudeVMA/pull/186 (branche
`feat/exercises-front`). Ne merge jamais soi-même — décision de merge/validation utilisateur
laissée au coordinateur, conformément à la consigne reçue.

## Contexte

Tâche de reprise : une session antérieure avait produit l'intégralité du travail front
(catalogue, création/édition en blocs, validation, passage, historique) dans un worktree isolé
(`agent-af4c8f5eb856afde7`), interrompue par une coupure de connexion **avant tout commit**. Cette
session a récupéré ce travail (copié fichier par fichier, git ne pouvant pas opérer entre
worktrees isolés), l'a poussé, puis a découvert deux blocages backend/infra bloquant la preuve
complète. Le coordinateur a ensuite signalé que ces deux blocages étaient résolus et mergés dans
`master` (PR #187 api-gateway, PR #188 content-catalog-service) et a demandé de rejouer le cycle
complet, HTTP **et** visuel.

## Round 1 — récupération et première preuve HTTP

1. Récupération intégrale du travail perdu, vérifiée fichier par fichier.
2. Relecture complète du code recouvré avant tout commit — conformité au contrat documenté, aux
   conventions du projet, à la règle des 300 lignes (`ExerciseCatalogPage.tsx` à 305 lignes, non
   découpé — 4 onglets courts et autonomes, aucune extraction cohérente identifiée).
3. `npx tsc --noEmit` → 0 erreur, `npm run build` → succès. Commit + push immédiat.
4. Preuve HTTP directe : création → validation RP → recherche par tag, intégralement fonctionnel.
5. Deux blocages découverts et signalés au coordinateur : stockage image `500`, gateway ne
   proxyant pas `/exercise-attempts` (`404` nginx brut).

## Round 2 — rebase, contrat réel du passage, preuve HTTP complète

1. **Rebase de la branche sur `master`** (`git rebase origin/master`, sans conflit) pour disposer
   des deux correctifs mergés (PR #187, #188), puis `git push --force-with-lease` (branche perso,
   pas de collaborateur dessus).
2. **Rejeu de la preuve HTTP** : les deux blocages sont bien résolus (image `201` + relecture
   `200` en `image/webp`, `/exercise-attempts/*` répond en JSON). Mais le passage d'un Exercice
   (`POST .../answers`) révèle un **écart de contrat réel**, jamais vérifiable avant que la
   gateway ne route ces appels : le serveur attend `content` comme un **tableau** d'items
   `{type, content}` (`400` sur une chaîne brute), et `ExerciseAttempt` porte les réponses/
   solutions révélées dans `parts[]` (`answerContent`, `revealedContent`), pas dans des tableaux
   séparés `answers`/`revealedSolutions` comme la première version du code le supposait (gap de
   documentation non comblé par `docs/routes.md`, signalé mais non corrigé — hors périmètre
   `apps/web`).
3. **Corrections front** : `src/types/exercise.ts` (`ExerciseAttempt.parts[]`,
   `ExerciseAttemptAnswerItem`), `src/api/exerciseAttempts.ts` (`content` en tableau, `reveal`
   renvoie déjà la tentative complète — suppression du second `GET` redondant),
   `ExercisePlayer.tsx` (dérive réponses/révélations depuis `parts[]`),
   `ExerciseDetailPage.tsx` (adapte les deux points d'appel). `npx tsc --noEmit` → 0 erreur,
   `npm run build` → succès. Commit + push immédiat.
4. **Preuve HTTP complète rejouée avec succès** contre `https://claudevma.visioprof.fr`, avec les
   payloads exacts désormais envoyés par le front : création (3 blocs, 2 questions) → upload
   d'image (`201`, ré-encodée en WebP) → figure dans `GET /exercises/pending-validation` → validée
   par le RP → relecture élève `validated` → retrouvée par tag → démarrage de tentative →
   réponse à une question → statut `in_progress` (1/2 répondu) → révélation de l'autre question →
   révélation de la première aussi → statut `done` → présente dans l'historique avec statut
   `done` → image du bloc énoncé relue avec succès (`200`, `image/webp`). Script conservé dans le
   scratchpad de session (non committé).

## Round 3 — preuve visuelle (Playwright, code réel de la branche, données réelles)

La PR n'étant pas mergée, `https://claudevma.visioprof.fr` ne sert pas ce code : aucune capture
d'écran de production n'est possible avant merge+déploiement. Pour fournir une preuve visuelle
malgré tout (demande explicite du coordinateur), j'ai fait tourner le **code réel de la branche**
localement (`vite`, jamais montré à l'utilisateur — seules les captures résultantes constituent la
preuve), avec un **proxy same-origin vers l'API réelle** (`/api/v1` → `https://claudevma.visioprof.fr`,
modification temporaire et non committée de `vite.config.ts`, annulée en fin de session) — un appel
cross-origin direct s'est heurté à un défaut réel de `content-catalog-service` (`OPTIONS` sur
`/exercises` renvoie `401` sans en-têtes CORS, contrairement à `identity-access-service` dont
`/auth/login` répond `204` avec CORS complet — signalé ci-dessous, hors périmètre `apps/web`).
Toutes les données affichées viennent de vrais appels au vrai backend (comptes créés via les
routes d'inscription publiques, comme un utilisateur réel).

**Cycle capturé, 15 captures** (`.claude/reports/screenshots/exercises-visual-proof-2026-09-01/`
dans ce worktree) :
1. Catalogue formateur, bouton de création.
2. Formulaire rempli (titre, tags, bloc énoncé, bloc question + solution).
3. Bandeau de succès après création, exercice visible en catalogue avec badge « En attente de
   validation ».
4. Ajout d'une image au bloc énoncé, depuis l'écran d'édition.
5. Onglet « Mes Exercices » — l'exercice y figure.
6. **Onglet « Validation » intégré directement dans la page Exercices du RP** (pas un écran
   séparé) — l'exercice y figure avec boutons Valider/Rejeter.
7. Exercice validé (retiré de la file après clic sur « Valider »).
8. Catalogue élève, recherche par tag — l'exercice validé est retrouvé.
9. Fiche de l'exercice avant démarrage.
10. Exercice démarré — bloc énoncé, bloc question avec zone de réponse facultative et bouton
    « Révéler la solution ».
11. Réponse enregistrée.
12. Solution révélée, badge de statut passé de « En cours » à **« Terminé »**.
13. Historique — l'exercice y figure avec titre résolu (jamais d'UUID) et statut « Terminé ».

Aucun blocage front rencontré dans ce round une fois les sélecteurs de test corrigés (les onglets
du projet portent `role="tab"`, pas `role="button"` — ARIA explicite prioritaire sur l'élément
`<button>` sous-jacent ; les panneaux d'onglets restent tous montés et masqués via `hidden`, un
sélecteur de texte non scopé au panneau visible peut résoudre sur un panneau caché — piège de mon
script de test, pas du code de l'application).

## Blocage résiduel — hors périmètre `apps/web`, découvert dans ce round

**CORS manquant côté `content-catalog-service` pour les requêtes authentifiées cross-origin** :
`OPTIONS /exercises` avec `Access-Control-Request-Headers: authorization` renvoie `401` sans aucun
en-tête `Access-Control-*`, alors que `identity-access-service` (`OPTIONS /auth/login`) répond
`204` avec un CORS complet (`Access-Control-Allow-Origin: *`, etc.). Sans incidence sur la
production actuelle (le front et l'API sont servis depuis la même origine réelle,
`https://claudevma.visioprof.fr`), mais à corriger si un jour un domaine front distinct de l'API
est introduit. Non corrigé ici (backend, hors périmètre `apps/web`).

## Vérifications faites

- `npx tsc --noEmit` → 0 erreur (à chaque round).
- `npm run build` → succès (à chaque round).
- Preuve HTTP directe **complète** contre la pile réelle (round 2) : cycle création → validation →
  recherche → passage → réponse → révélation → statut fait → historique → image lisible.
- Preuve **visuelle** complète (round 3) : 15 captures, code réel de la branche, données réelles.
- Fichiers au-dessus de 300 lignes : `ExerciseCatalogPage.tsx` (305 lignes) — signalé, non
  découpé (4 onglets courts, aucune extraction cohérente identifiée sans perte de lisibilité).

## Ce qui reste à faire

- Capture d'écran de la **vraie** URL de production : possible seulement après merge de la PR
  #186 et redéploiement — hors de mon ressort (je ne merge jamais moi-même).
- CORS de `content-catalog-service` pour les appels cross-origin (voir ci-dessus) — signalé, non
  corrigé, sans impact sur la production actuelle.

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
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ad28b98fa754f25ee/.claude/reports/screenshots/exercises-visual-proof-2026-09-01/` (15 captures, non committées)
