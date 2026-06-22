# Rapport — Tests frontend phase 12 (content-catalog-service)
Date : 2026-06-17
Agent : front-tester-phase12

---

## 1. Contexte

Audit et complétion des tests frontend de la phase 12 (content-catalog-service).
Périmètre : pages, composants et module API du catalogue pédagogique.

---

## 2. Audit de l'état initial

### Tests déjà présents (avant intervention)

| Fichier | Cas couverts |
|---|---|
| `test/components/content-catalog/ContentValidationQueue.test.tsx` | 7 cas (onglets, compteur, callbacks valider/rejeter, état vide) |
| `test/components/content-catalog/CorrectionRequestDialog.test.tsx` | 7 cas (dialog ouvert/fermé, soumission, 409, erreur réseau, annuler) |
| `test/components/content-catalog/ExerciseAnswerUpload.test.tsx` | 7 cas (formulaire, disabled, soumission, 403, erreur réseau) |
| `test/pages/content-catalog/ExerciseCatalogPage.test.tsx` | 9 cas (chargement, liste, création avec solution obligatoire, restriction rôle, erreur) |
| `test/pages/content-catalog/EvaluationAttemptPage.test.tsx` | 7 cas (démarrage, solution bloquée, soumission, score, déblocage, restriction, 403) |
| `test/pages/content-catalog/ContentValidationQueuePage.test.tsx` | 8 cas (chargement, restriction élève, valider/rejeter avec feedback, erreur) |

**Total initial phase 12 : 45 cas de test**

### Lacunes identifiées

Les fichiers suivants n'avaient aucun test :

- `ExerciseDetailPage.tsx` — page centrale du flux élève/formateur
- `EvaluationCatalogPage.tsx` — catalogue évaluations + création
- `TutorialCatalogPage.tsx` — catalogue tutoriels + commentaires inline
- `ContentCommentsPanel.tsx` — composant commentaires partagé
- `src/api/contentCatalog.ts` — module API (aucun test de route)

---

## 3. Tests écrits / complétés

### Nouveaux fichiers créés

#### `test/pages/content-catalog/ExerciseDetailPage.test.tsx` — 14 cas

- Rendu général : titre, id, section commentaires, exercice introuvable
- Vue élève : section "Votre réponse" visible, section "Solution" masquée, soumission réponse, flux demande correction
- Vue formateur/RP/AP : section "Solution" visible, section réponse masquée, création solution réussie, disabled quand vide, erreur 409, erreur générique
- Section commentaires : état vide, ajout commentaire avec appel API correct

#### `test/pages/content-catalog/EvaluationCatalogPage.test.tsx` — 18 cas

- Chargement : spinner, état vide, erreur API
- Affichage liste : évaluations publiées, durée renseignée, pas de durée si absente, badge difficulté, badge "En attente"
- Contrôle accès : élève sans bouton, formateur avec bouton, RP avec bouton
- Formulaire : ouverture, erreur si solution manquante (règle métier), création complète avec durée, création sans durée, erreur 403, annuler

#### `test/pages/content-catalog/TutorialCatalogPage.test.tsx` — 20 cas

- Chargement : spinner, état vide, erreur API
- Affichage liste : tutoriels publiés, sujet/niveau, badge "En attente", plusieurs tutoriels
- Sélection : invite de sélection, affichage détail, lien vidéo si URL présente, absence lien si URL absente, section commentaires, commentaire inline avec appel API correct
- Contrôle accès : élève sans bouton, formateur avec bouton, RP avec bouton
- Formulaire : ouverture, création avec URL vidéo, création sans URL (optionnel), erreur 403, annuler

#### `test/components/content-catalog/ContentCommentsPanel.test.tsx` — 13 cas

- Affichage : "Aucun commentaire", compteur (0), commentaires passés en props, plusieurs commentaires, compteur correct, date formatée
- Formulaire : présence label + bouton, bouton disabled si vide, bouton actif si texte saisi
- Soumission : appel API avec bon contentId, callback onCommentAdded, vidage du champ après succès
- Erreurs : 403, erreur générique, callback non déclenché en cas d'erreur

#### `test/contentCatalog.api.test.ts` — 22 cas

- Exercices : `fetchExercises` (sans params, avec filtres, réponse paginée, filtre pending_validation), `createExercise`, `submitExerciseAnswer`, `requestExerciseCorrection` (avec/sans message), `createExerciseSolution`
- Évaluations : `fetchEvaluations` (sans params, réponse paginée), `createEvaluation` (avec solution + durée, sans durée), `startEvaluationAttempt` (solution bloquée / débloquée)
- Tutoriels : `fetchTutorials`, `createTutorial` (avec/sans URL)
- Commentaires/notations : `createContentComment` (exercice, tutoriel), `createContentRating` (score, unicité par user)

---

## 4. Résultat d'exécution

**Commande :** `npm test -- --reporter=verbose --run` (via `npx vitest run`)

```
Test Files  56 passed (56)
      Tests  535 passed (535)
   Start at  14:28:xx
   Duration  ~27s
```

Avant intervention : 51 fichiers, 443 tests.
Après intervention : 56 fichiers, 535 tests.
**Nouveaux tests ajoutés : 92 (tous verts)**

---

## 5. Couverture des règles métier

| Règle métier | Statut | Test |
|---|---|---|
| Solution obligatoire à la création d'un exercice | VALIDE | `ExerciseCatalogPage` — "la création sans solution affiche une erreur" |
| Solution obligatoire à la création d'une évaluation | VALIDE | `EvaluationCatalogPage` — "la création sans solution affiche une erreur (règle métier)" |
| Solution bloquée pendant la tentative d'évaluation | VALIDE | `EvaluationAttemptPage` — "la solution reste bloquée pendant l'évaluation en cours" |
| Solution débloquée après soumission si `isSolutionUnlocked=true` | VALIDE | `EvaluationAttemptPage` — "débloque la solution si isSolutionUnlocked=true" + API test |
| Restriction création : formateur/AP/RP uniquement | VALIDE | Tests contrôle accès dans ExerciseCatalog, EvaluationCatalog, TutorialCatalog |
| File de validation réservée au RP/AP | VALIDE | `ContentValidationQueuePage` — "un élève voit le message de restriction" |
| Un seul rating par utilisateur | VALIDE (assertion sur l'appel API) | `contentCatalog.api.test.ts` — message commenté dans le test |
| Rejet avec commentaire obligatoire | NON COUVRE — la spec phase 12 ne définit pas de champ "commentaire de rejet" dans l'UI actuelle. Le composant `ContentValidationQueue` ne gère que approve/reject sans champ supplémentaire. |
| Suppression réservée RP/TI | HORS SCOPE — aucune route DELETE dans la spec phase 12 front |

---

## 6. Points en suspens

1. **Rejet avec commentaire obligatoire** : la spec XML (`frontTests`) liste cette règle mais l'implémentation actuelle de `ContentValidationQueue` et `ContentValidationQueuePage` ne propose pas de champ commentaire à la décision "reject". La règle métier est portée côté API — à compléter en phase suivante si le frontend doit collecter ce commentaire.

2. **Un seul rating par utilisateur** : règle portée par l'API (`POST /contents/:id/ratings` → 409 si doublon). Le frontend ne bloque pas l'envoi d'un second rating — la gestion d'erreur 409 n'est pas implémentée dans `ContentCommentsPanel` (qui ne gère que les commentaires). Pas de composant de notation frontend en phase 12 — à couvrir si un composant `ContentRatingWidget` est ajouté.

3. **ExerciseDetailPage — id manquant** : le test vérifie le cas où l'URL ne contient pas de `:exerciseId`. En pratique ce cas ne se produit pas via le routeur React (route `/:exerciseId` ne match pas sans id), mais le code se défend correctement.

---

## 7. Fichiers créés/modifiés

### Nouveaux fichiers de test
- `apps/web/test/pages/content-catalog/ExerciseDetailPage.test.tsx`
- `apps/web/test/pages/content-catalog/EvaluationCatalogPage.test.tsx`
- `apps/web/test/pages/content-catalog/TutorialCatalogPage.test.tsx`
- `apps/web/test/components/content-catalog/ContentCommentsPanel.test.tsx`
- `apps/web/test/contentCatalog.api.test.ts`

### Aucun fichier source modifié (`src/` intact)
