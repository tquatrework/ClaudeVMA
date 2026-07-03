# Rapport de correction — tests frontend (11 → 0 échecs)

**Date** : 2026-06-29  
**Auteur** : agent front-tester  
**Branche** : master

---

## Résultat final

- Avant : 11 tests en échec dans 3 fichiers (74 fichiers, 721 tests)
- Après : **0 tests en échec** — 74 fichiers, 721 tests, 100 % verts

---

## Fichier 1 — `test/archiveDocument.api.test.ts` (3 tests corrigés)

### Cause

Les assertions vérifiaient que `apiClient.get` était appelé avec des chemins sans préfixe (ex: `/students/student-42/pedagogical-archives`). Or la vraie implémentation dans `src/api/archiveDocument.ts` préfixe toutes les routes avec `/archives/` ou `/documents/` conformément au gateway nginx (`/api/v1/archives` → service reçoit `/archives/...`).

### Corrections

| Test | Ancienne assertion | Nouvelle assertion |
|---|---|---|
| `fetchPedagogicalArchives` | `/students/student-42/pedagogical-archives` | `/archives/students/student-42/pedagogical-archives` |
| `fetchArchiveTimeline` | `/students/student-42/archive-timeline` | `/archives/students/student-42/archive-timeline` |
| `createArchiveLink` (POST) | `/students/student-42/archive-links` | `/archives/students/student-42/archive-links` |

---

## Fichier 2 — `test/pages/TeacherRequestDetailPage.test.tsx` (5 tests corrigés)

### Cause

La refacto de `TeacherRequestDetailPage.tsx` et `TeacherCandidatesView.tsx` a modifié les URL et les corps des appels API. Les tests utilisaient les anciens chemins courts sans sous-préfixe `/requests/` et les anciennes clés de payload.

### Corrections

#### RP — ajouter un candidat (POST)
- Ancienne URL : `/teacher-requests/${REQUEST_ID}/candidates` avec `{teacherId}`
- Nouvelle URL : `/teacher-requests/requests/${REQUEST_ID}/proposals` avec `{teacherId}` (inchangé)

#### RP — changer le statut (PATCH)
- Ancienne URL : `/teacher-requests/${REQUEST_ID}/status`
- Nouvelle URL : `/teacher-requests/requests/${REQUEST_ID}/status`

#### Formateur — accepter sa candidature (POST)
- Ancien call : `/teacher-requests/${REQUEST_ID}/responses` avec `{candidateId, status: 'accepted'}`
- Nouveau call : `/teacher-requests/proposals/candidate-own/accept` avec `{}`
  (le composant encode l'action dans l'URL plutôt que dans le body)

#### Formateur — refuser sa candidature (POST)
- Ancien call : `/teacher-requests/${REQUEST_ID}/responses` avec `{status: 'declined'}`
- Nouveau call : `/teacher-requests/proposals/candidate-own/decline` avec `{}`

#### Client (élève) — sélectionner un candidat (POST)
- Ancienne URL + payload : `/teacher-requests/${REQUEST_ID}/select` avec `{candidateId: 'candidate-accepted'}`
- Nouvelle URL + payload : `/teacher-requests/requests/${REQUEST_ID}/select` avec `{proposalId: 'candidate-accepted'}`
  (la clé `candidateId` a été renommée en `proposalId`)

---

## Fichier 3 — `test/pages/pedagogicalLog.test.tsx` (3 tests corrigés)

### Cause

La refacto design de `StudentMemoPanel` a supprimé le message `"consultation individuelle uniquement"` affiché pour les formateurs. Le nouveau message est `"Lecture seule — réservé à l'élève"` (ligne 87 de `StudentMemoPanel.tsx`).

### Corrections

3 tests attendaient `/consultation individuelle uniquement/i` dans deux blocs `describe` :
- `MemosPage — formateur voit en readonly` (lignes 475, 486)
- `Formateur — écran mémo en lecture seule` (ligne 980)

Toutes les assertions ont été mises à jour pour chercher `/réservé à l'élève/i`, qui correspond au texte réel rendu par le composant.

Les noms de test ont été ajustés pour refléter la sémantique réelle :
- `"affiche un message informatif pour le formateur (pas de liste globale)"` → texte inchangé, assertion mise à jour
- `"formateur — voit le message informatif sur la consultation individuelle"` → `"formateur — voit le message informatif sur l'accès réservé à l'élève"`

---

## Règle respectée

Aucun fichier dans `src/pages/` ou `src/components/` n'a été modifié. Seuls les fichiers `test/` ont été touchés.
