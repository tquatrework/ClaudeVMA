# Rapport test-writer — content-catalog-service — 2026-06-17

## 1. Tests existants (avant intervention)

5 fichiers de test, 67 tests, tous passants :

| Fichier | Méthodes couvertes | Tests |
|---------|-------------------|-------|
| `exercises.service.spec.ts` | `create()`, `search()`, `submitAnswer()`, `requestCorrection()`, `proposeSolution()`, `getOfficialSolution()`, `removeExercise()` | 21 |
| `evaluations.service.spec.ts` | `create()`, `search()`, `startAttempt()`, `removeEvaluation()` | 16 |
| `contents.service.spec.ts` | `addComment()`, `addRating()`, `getAverageRating()` | 14 |
| `tutorials.service.spec.ts` | `create()`, `search()`, `findOne()`, `removeTutorial()` | 12 |
| `validations.service.spec.ts` | `validateContent()` (exercice seulement), `requestValidation()` (exercice seulement) | 8 |

**Ce qui était couvert :**
- Restriction création exercice/évaluation/tutoriel aux rôles formateur/AP/RP
- Élève et parent ne voient que les contenus validés (`search()`)
- Soumission de réponse réservée aux élèves
- Demande de correction sur sa propre réponse
- Proposition de solution réservée aux formateurs/AP/RP
- Solution officielle = moins chère des validées
- Suppression par RP/TI/auteur uniquement
- Commentaires avec `isOwnerHint` pour formateurs (mais pas AP/RP/parent testés)
- Rating : mise à jour si vote existant
- Validation par AP/RP, rejet avec commentaire obligatoire

---

## 2. Tests ajoutés

4 nouveaux fichiers, 52 nouveaux tests :

### `exercises.service.rules.spec.ts` (14 tests)

| Test | Règle | Couverture |
|------|-------|-----------|
| Solution systématiquement enregistrée à la création | CCS-BR-001 | `exerciseSolutionRepo.create` + `save` appelés |
| Solution créée avec le contenu fourni | CCS-BR-001 | `content` transmis à `create()` |
| Solution associée à l'exercice par `exerciseId` | CCS-BR-001 | `exerciseId` dans les args de `create()` |
| NotFoundException si aucune solution validée | CCS-BR-002 | filtre `isValidated: true` |
| Filtre `isValidated: true` dans la requête | CCS-BR-002 | where clause vérifiée |
| Demande de correction → `correctionRequested: true` | CCS-BR-003 | flag mis à jour |
| Double demande de correction bloquée | CCS-BR-003 | `BadRequestException` |
| Demande correction sur réponse d'autrui interdite | CCS-BR-003 | exception levée |
| `findOne()` retourne l'exercice existant | non couvert | happy path |
| `findOne()` lève `NotFoundException` | non couvert | not found |
| `animateur_pedagogique` peut créer un exercice | non couvert | rôle AP autorisé |

### `evaluations.service.rules.spec.ts` (15 tests)

| Test | Règle | Couverture |
|------|-------|-----------|
| Blocage si tentative IN_PROGRESS existe | CCS-BR-005 | exception levée |
| Nouvelle tentative autorisée si précédente COMPLETED | CCS-BR-005 | `attemptRepo.findOne` retourne null |
| Filtre sur `evaluationId + studentId + IN_PROGRESS` | CCS-BR-005 | where clause vérifiée |
| `hasActiveAttempt()` → true si tentative existe | non couvert | retour booléen |
| `hasActiveAttempt()` → false si pas de tentative | non couvert | retour booléen |
| `findOne()` retourne l'évaluation | non couvert | happy path |
| `findOne()` lève `NotFoundException` | non couvert | not found |
| TI peut retirer une évaluation | non couvert | rôle TI |
| Auteur peut retirer sa propre évaluation | non couvert | `authorId === requesterId` |
| Autre formateur lève `ForbiddenException` | non couvert | access control |
| `animateur_pedagogique` peut créer une évaluation | non couvert | rôle AP |
| Parent ne peut pas créer une évaluation | non couvert | `ForbiddenException` |

### `contents.service.rules.spec.ts` (13 tests)

| Test | Règle | Couverture |
|------|-------|-----------|
| Pas de création si vote existant (idempotence) | CCS-BR-004 | `create` non appelé |
| Mise à jour du score existant seulement | CCS-BR-004 | `save` avec score mis à jour |
| Création si premier vote | CCS-BR-004 | `create` appelé |
| Filtre sur `contentId + contentType + authorId` | CCS-BR-004 | where clause vérifiée |
| `getComments()` retourne la liste | non couvert | happy path |
| `getComments()` retourne liste vide | non couvert | empty case |
| `isOwnerHint=true` autorisé pour AP | non couvert | rôle AP |
| `isOwnerHint=true` autorisé pour RP | non couvert | rôle RP |
| `isOwnerHint=true` refusé pour parent (→ false) | non couvert | rôle parent |
| `getAverageRating()` avec un seul vote | non couvert | cas limite |

### `validations.service.rules.spec.ts` (22 tests)

| Test | Règle | Couverture |
|------|-------|-----------|
| AP peut valider une **évaluation** | non couvert | type EVALUATION |
| Rejet évaluation sans commentaire → `BadRequestException` | non couvert | type EVALUATION |
| Rejet évaluation avec commentaire autorisé | non couvert | type EVALUATION |
| `NotFoundException` si évaluation introuvable | non couvert | type EVALUATION |
| AP peut valider un **tutoriel** | non couvert | type TUTORIAL |
| Rejet tutoriel sans commentaire → `BadRequestException` | non couvert | type TUTORIAL |
| `NotFoundException` si tutoriel introuvable | non couvert | type TUTORIAL |
| Formateur peut soumettre une **évaluation** à validation | non couvert | type EVALUATION |
| Élève ne peut pas soumettre à validation (évaluation) | non couvert | type EVALUATION |
| `NotFoundException` si évaluation introuvable (soumission) | non couvert | type EVALUATION |
| Formateur peut soumettre un **tutoriel** à validation | non couvert | type TUTORIAL |
| Parent ne peut pas soumettre à validation (tutoriel) | non couvert | type TUTORIAL |
| `NotFoundException` si tutoriel introuvable (soumission) | non couvert | type TUTORIAL |
| `getValidationHistory()` retourne l'historique complet | non couvert | happy path |
| `getValidationHistory()` retourne liste vide | non couvert | empty case |
| Tri historique par `createdAt DESC` | non couvert | order clause |
| Workflow : statut → PENDING_VALIDATION à la soumission | non couvert | transition état |
| Workflow : statut → VALIDATED après décision AP | non couvert | transition état |
| Workflow : entrée historique enregistrée à chaque décision | non couvert | `validationRepo.create` appelé |

---

## 3. Résultat d'exécution

**Commande :** `npm test` dans `services/content-catalog-service/`

```
Test Suites: 9 passed, 9 total
Tests:       119 passed, 119 total
Snapshots:   0 total
Time:        ~6s
```

Avant : 5 suites / 67 tests
Après : 9 suites / 119 tests (+ 4 suites / + 52 tests)

---

## 4. Règles métier non couvertes — lacunes identifiées

| Lacune | Raison |
|--------|--------|
| **CCS-BR-002 (élève demande correction → note/solution)** | La mécanique de remise de la solution après correction validée n'est pas implémentée dans le service actuel. Les méthodes manquent (`getCorrectionResult`, `getStudentSolution`). Impossible de tester ce qui n'existe pas. |
| **Interdiction commentaire donnant la solution** | Contrainte éditoriale de modération, pas de logique technique dans le code. Aucun filtre de contenu texte n'est implémenté dans `addComment()`. Ne peut pas être testé unitairement. |
| **Événements publiés** (`ContentUploaded`, `CorrectionRequested`, etc.) | Aucune infrastructure d'événements n'est implémentée dans le service (pas d'EventBus, pas d'émission). Phase 3 — hors scope courant. |
| **Restriction élève à certains contenus en phase future** | Règle mentionnée dans la spec XML (`Eleve: peut charger certains contenus à valider selon phase future`) — non implémentée par design (phase 3). |
| **Rejet avec impact sur les points pédagogiques** (`ContentRemoved → PedagogicalPointsAwarded inversé`) | Aucun système de points pédagogiques dans ce service actuellement. |

---

## 5. Fichiers créés / modifiés

- `services/content-catalog-service/test/unit/exercises/exercises.service.rules.spec.ts` (nouveau)
- `services/content-catalog-service/test/unit/evaluations/evaluations.service.rules.spec.ts` (nouveau)
- `services/content-catalog-service/test/unit/contents/contents.service.rules.spec.ts` (nouveau)
- `services/content-catalog-service/test/unit/validations/validations.service.rules.spec.ts` (nouveau)

**Branche :** `test/content-catalog-service-rules`
**PR :** https://github.com/tquatrework/ClaudeVMA/pull/20
