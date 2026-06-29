# Rapport — Tests parcours élève "demande de professeur" (bug fix 404)

**Date** : 2026-06-29  
**Agent** : front-tester  
**Périmètre** : bug fix URL `/teacher-requests/requests` → `/teacher-requests`

---

## Résumé exécutif

- Nouveau fichier de tests créé : `test/pages/TeacherRequestStudentJourney.test.tsx` (15 tests)
- Tests existants corrigés (URLs buggées) : 4 fichiers, 7 assertions
- Résultat final suite complète : **736 tests passent / 0 échec** (75 fichiers)

---

## Fichier de tests créé

### `test/pages/TeacherRequestStudentJourney.test.tsx`

15 tests couvrant les 5 cas demandés :

#### 1. État vide — TeacherRequestPage
| Test | Statut |
|------|--------|
| Affiche "Vous n'avez pas pour l'instant de professeur attitré" quand GET /teacher-requests retourne [] | ✅ |
| N'affiche PAS d'erreur technique (pas de 404) quand la liste est vide | ✅ |
| Affiche "Aucune demande" (état vide générique) dans TeacherRequestsPage | ✅ |

#### 2. Liste avec demandes
| Test | Statut |
|------|--------|
| Affiche les demandes retournées par GET /teacher-requests | ✅ |
| Affiche les statuts des demandes avec les libellés français corrects | ✅ |
| Affiche les demandes dans TeacherRequestsPage | ✅ |

#### 3. Appel API correct — URL sans /requests parasite
| Test | Statut |
|------|--------|
| TeacherRequestPage appelle GET /teacher-requests (pas /teacher-requests/requests) | ✅ |
| TeacherRequestsPage appelle GET /teacher-requests (pas /teacher-requests/requests) | ✅ |
| TeacherRequestInbox (formateur) appelle GET /teacher-requests | ✅ |

#### 4. Création de demande — POST /teacher-requests
| Test | Statut |
|------|--------|
| TeacherRequestsPage soumet POST /teacher-requests (pas /teacher-requests/requests) | ✅ |
| La nouvelle demande apparaît dans la liste après création | ✅ |

#### 5. Détail d'une demande — GET /teacher-requests/:id
| Test | Statut |
|------|--------|
| Appelle GET /teacher-requests/:id (pas /teacher-requests/requests/:id) | ✅ |
| Affiche le détail de la demande chargée | ✅ |
| Affiche une erreur 404 si la demande est introuvable | ✅ |
| Affiche "Accès refusé" sur erreur 403 | ✅ |

---

## Tests existants corrigés (URLs buggées pré-correctif)

Ces tests avaient été écrits avant le correctif et vérifiaient les anciennes URLs incorrectes. Ils ont été mis à jour pour refléter les URLs réelles.

### `test/pages/TeacherRequestsPage.test.tsx`
- Ligne 263 : `/teacher-requests/requests` → `/teacher-requests` (POST création)

### `test/pages/TeacherRequestDetailPage.test.tsx`
- Ligne 177 : `/teacher-requests/requests/${REQUEST_ID}/proposals` → `/teacher-requests/${REQUEST_ID}/proposals`
- Ligne 201 : `/teacher-requests/requests/${REQUEST_ID}/status` → `/teacher-requests/${REQUEST_ID}/status`
- Ligne 259 : `/teacher-requests/proposals/candidate-own/accept` → `/proposals/candidate-own/accept`
- Ligne 290 : `/teacher-requests/proposals/candidate-own/decline` → `/proposals/candidate-own/decline`
- Ligne 348 : `/teacher-requests/requests/${REQUEST_ID}/select` → `/teacher-requests/${REQUEST_ID}/select`

### `test/userJourneys.test.tsx`
- Ligne 298 : `/teacher-requests/requests` → `/teacher-requests` (Journey 4 POST création)

---

## Output des tests

```
✓ test/pages/TeacherRequestStudentJourney.test.tsx  (15 tests) 680ms
✓ test/pages/TeacherRequestPage.test.tsx  (16 tests) 1090ms
✓ test/pages/TeacherRequestsPage.test.tsx  (14 tests) 658ms
✓ test/pages/TeacherRequestDetailPage.test.tsx  (16 tests) 1043ms

Test Files  75 passed (75)
      Tests  736 passed (736)
   Duration  ~40s
```

---

## Observations techniques

1. **URLs corrigées par le bug fix** :
   - `GET /teacher-requests` (liste) — dans `TeacherRequestPage`, `TeacherRequestsPage`, `TeacherRequestInbox`
   - `POST /teacher-requests` (création) — dans `TeacherRequestsPage`
   - `GET /teacher-requests/:id` (détail) — dans `TeacherRequestDetailPage`
   - `PATCH /teacher-requests/:id/status` — dans `TeacherRequestDetailPage`
   - `POST /teacher-requests/:id/proposals` — dans `TeacherCandidatesView`
   - `POST /teacher-requests/:id/select` — dans `TeacherCandidatesView`
   - `POST /proposals/:candidateId/accept|decline` — dans `TeacherCandidatesView` et `TeacherRequestInbox`

2. **Méthode de mock** : `vi.mock('../../src/api/client')` + `vi.mocked(apiClient).get/post/patch` — conforme aux conventions du projet.

3. **Aucun fichier source modifié**.

---

## Blocages

Aucun.
