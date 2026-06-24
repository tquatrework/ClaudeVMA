# Audit — Teacher-request routing frontend
Date : 2026-06-24

## Statut global : ⚠️ corrigé (3 URLs legacy supprimées)

---

## 1. Inventaire des fichiers API teacher-request

### Fichiers concernés

| Fichier | Rôle |
|---|---|
| `apps/web/src/pages/TeacherRequestsPage.tsx` | Liste + création inline (legacy page) |
| `apps/web/src/pages/TeacherRequestPage.tsx` | Page principale rôle-adaptatif |
| `apps/web/src/pages/TeacherRequestDetailPage.tsx` | Détail d'une demande |
| `apps/web/src/components/teacher-requests/RpTeacherSearchWorkspace.tsx` | Espace RP (liste demandes actives) |
| `apps/web/src/components/teacher-requests/TeacherRequestInbox.tsx` | Boîte formateur |
| `apps/web/src/components/teacher-requests/TeacherCandidatesView.tsx` | Gestion candidats |
| `apps/web/src/components/teacher-requests/SpecificTeacherRequestForm.tsx` | Formulaire création |
| `apps/web/src/components/teacher-requests/ChangePrincipalTeacherDialog.tsx` | Changement PP |
| `apps/web/src/components/teacher-requests/StopCollaborationRequestForm.tsx` | Arrêt collaboration |
| `apps/web/src/pages/DashboardPage.tsx` | Dashboard (section demandes récentes) |

### URLs avant/après correction

| Fichier | Avant | Après | Statut |
|---|---|---|---|
| `TeacherRequestsPage.tsx` ligne 45 | `GET /requests` | `GET /teacher-requests` | ✅ corrigé |
| `TeacherRequestsPage.tsx` ligne 65 | `POST /requests` | `POST /teacher-requests` | ✅ corrigé |
| `DashboardPage.tsx` ligne 113 | `GET /requests` | `GET /teacher-requests` | ✅ corrigé |

### URLs conformes (inchangées)

| Fichier | URL | Conforme |
|---|---|---|
| `TeacherRequestPage.tsx` | `GET /teacher-requests` | ✅ |
| `TeacherRequestDetailPage.tsx` | `GET /teacher-requests/:id` | ✅ |
| `TeacherRequestDetailPage.tsx` | `PATCH /teacher-requests/:id/status` | ✅ |
| `TeacherRequestDetailPage.tsx` | `DELETE /teacher-requests/:id` | ✅ |
| `RpTeacherSearchWorkspace.tsx` | `GET /teacher-requests` | ✅ |
| `TeacherRequestInbox.tsx` | `GET /teacher-requests` | ✅ |
| `TeacherRequestInbox.tsx` | `POST /teacher-requests/:id/responses` | ✅ |
| `TeacherCandidatesView.tsx` | `POST /teacher-requests/:id/candidates` | ✅ |
| `TeacherCandidatesView.tsx` | `POST /teacher-requests/:id/responses` | ✅ |
| `TeacherCandidatesView.tsx` | `POST /teacher-requests/:id/select` | ✅ |
| `SpecificTeacherRequestForm.tsx` | `POST /teacher-requests` | ✅ |
| `ChangePrincipalTeacherDialog.tsx` | `POST /teacher-requests/pp-change` | ✅ |
| `StopCollaborationRequestForm.tsx` | `POST /teacher-collaborations/:id/stop-request` | ✅ (route différente — non concernée par le préfixe teacher-requests) |

---

## 2. Dashboard RP — état

La section "Demandes professeur récentes" dans `DashboardPage.tsx` est **générique** : elle s'affiche pour tous les rôles (pas une section dédiée RP).

- Les `teacher_requests` sont affichées avec leur `request.id` ✅
- Clic sur une demande → `Link to="/teacher-requests/${request.id}"` ✅
- **Aucune section RP dédiée avec propositions/accept/reject dans DashboardPage** — voir lacune ci-dessous.

La page dédiée RP (`TeacherRequestPage.tsx` + `RpTeacherSearchWorkspace`) affiche correctement les demandes avec `request.id` et le clic redirige vers `/teacher-requests/:id`.

Les actions accept/reject du RP sont dans `TeacherRequestDetailPage.tsx` (boutons `PATCH /teacher-requests/:id/status`) — correctes.

---

## 3. Lacunes signalées (non bloquantes)

### L1 — Pas de section RP avec proposals/accept/reject dans DashboardPage
La tâche demandait de vérifier que le dashboard RP affiche des `proposals` avec `proposal.id` et des boutons accept/reject via `POST /api/v1/teacher-requests/proposals/:proposal.id/accept`.

Ce modèle de "proposals" distinctes (avec leur propre `proposal.id` séparé du `request.id`) **n'existe pas** dans l'implémentation actuelle. Le modèle utilisé est `candidates` (ajoutés sur une demande, avec `candidate.id`). Les actions accept/reject passent par :
- `POST /teacher-requests/:requestId/responses` (réponse du formateur)
- `PATCH /teacher-requests/:requestId/status` (action RP sur la demande)
- `POST /teacher-requests/:requestId/select` (sélection par le client)

Ce découpage n'est **pas incohérent** mais il diffère du schéma proposals/accept/reject imposé dans la convention. À aligner avec le backend si celui-ci implémente `/proposals/:id/accept` et `/proposals/:id/reject`.

### L2 — TeacherRequestsPage vs TeacherRequestPage — doublon de page
Il existe deux pages pour les demandes professeur :
- `TeacherRequestsPage.tsx` (liste + mini-formulaire inline, route `/teacher-requests`)
- `TeacherRequestPage.tsx` (page rôle-adaptatif complète, probablement route différente)

Le doublon crée un risque de désynchronisation (les deux pages maintenant utilisent `/teacher-requests` — correctement). À consolider.

### L3 — StopCollaborationRequestForm utilise `/teacher-collaborations/` 
Route `POST /teacher-collaborations/:id/stop-request` — non mentionnée dans `docs/routes.md` et hors convention `/api/v1/teacher-requests/`. À documenter ou à faire valider par le backend.

---

## 4. Fichiers modifiés

- `apps/web/src/pages/TeacherRequestsPage.tsx` — 2 URLs corrigées
- `apps/web/src/pages/DashboardPage.tsx` — 1 URL corrigée

## 5. Build

✅ `npm run build` passe sans erreur TypeScript.
