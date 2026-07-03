# Bug Fix Report — teacher-request GET /teacher-requests/requests 404

**Date :** 2026-06-29  
**Statut :** ✅ Corrigé

---

## Diagnostic

### Cause racine — double problème

Le bug est issu de deux erreurs cumulées :

**1. Nginx — mauvais proxy_pass**

`location ^~ /api/v1/teacher-requests` mappait vers `http://teacher_request/teacher-requests`.  
Cela signifiait que `/api/v1/teacher-requests/foo` arrivait au backend sous `/teacher-requests/foo`.  
Or le contrôleur NestJS est `@Controller('requests')`, pas `@Controller('teacher-requests')`.  
Toute requête arrivant sous `/teacher-requests/*` retournait donc 404.

**2. Frontend — chemin doublé**

Le frontend appelait `/teacher-requests/requests` (GET et POST), au lieu de `/teacher-requests`.  
Même avec un nginx correct, le backend recevrait `/requests/requests` — qui n'existe pas.

### Chaîne complète (avant correction)

```
Frontend : GET /api/v1/teacher-requests/requests
Nginx    : proxy_pass → http://teacher_request/teacher-requests/requests
Backend  : aucune route /teacher-requests/requests → 404 "Cannot GET /teacher-requests/requests"
```

### Chaîne correcte (après correction)

```
Frontend : GET /api/v1/teacher-requests
Nginx    : proxy_pass → http://teacher_request/requests
Backend  : @Controller('requests') → @Get() listRequests() → 200 []
```

---

## Routes exposées par le contrôleur

Fichier : `services/teacher-request-service/src/teacher-request/teacher-request.controller.ts`

| Contrôleur            | Méthode   | Chemin backend                          | Via gateway                             |
|-----------------------|-----------|-----------------------------------------|-----------------------------------------|
| TeacherRequestController | GET    | /requests                               | /api/v1/teacher-requests                |
| TeacherRequestController | POST   | /requests                               | /api/v1/teacher-requests                |
| TeacherRequestController | GET    | /requests/:id                           | /api/v1/teacher-requests/:id            |
| TeacherRequestController | PATCH  | /requests/:id/status                    | /api/v1/teacher-requests/:id/status     |
| TeacherRequestController | DELETE | /requests/:id                           | /api/v1/teacher-requests/:id            |
| TeacherRequestController | POST   | /requests/pp-change                     | /api/v1/teacher-requests/pp-change      |
| TeacherRequestController | POST   | /requests/:id/selected-candidates       | /api/v1/teacher-requests/:id/selected-candidates |
| TeacherRequestController | POST   | /requests/:id/select                    | /api/v1/teacher-requests/:id/select     |
| TeacherRequestController | POST   | /requests/:requestId/proposals          | /api/v1/teacher-requests/:requestId/proposals |
| ProposalController    | POST      | /proposals/:proposalId/accept           | /api/v1/proposals/:proposalId/accept    |
| ProposalController    | POST      | /proposals/:proposalId/decline          | /api/v1/proposals/:proposalId/decline   |
| CollaborationController | POST    | /collaborations/:assignmentId/stop-request | (pas de route nginx /api/v1/collaborations — voir point en suspens) |
| AssignmentController  | POST      | /assignments/:assignmentId/main-teacher | /api/v1/assignments/:assignmentId/main-teacher |
| AssignmentController  | POST      | /assignments/:assignmentId/termination  | /api/v1/assignments/:assignmentId/termination |

---

## Fichiers modifiés

### 1. `gateway/api-gateway/nginx.conf` (ligne 438)

```diff
- proxy_pass http://teacher_request/teacher-requests;
+ proxy_pass http://teacher_request/requests;
```

**Impact :** Toutes les routes `/api/v1/teacher-requests/*` arrivent désormais au backend sous `/requests/*`, alignées avec `@Controller('requests')`.

### 2. `apps/web/src/pages/TeacherRequestsPage.tsx`

```diff
- apiClient.get<TeacherRequest[]>('/teacher-requests/requests')
+ apiClient.get<TeacherRequest[]>('/teacher-requests')

- await apiClient.post<TeacherRequest>('/teacher-requests/requests', payload)
+ await apiClient.post<TeacherRequest>('/teacher-requests', payload)
```

### 3. `apps/web/src/pages/TeacherRequestDetailPage.tsx`

```diff
- .get<TeacherRequest>(`/teacher-requests/requests/${requestId}`)
+ .get<TeacherRequest>(`/teacher-requests/${requestId}`)

- `/teacher-requests/requests/${requestId}/status`
+ `/teacher-requests/${requestId}/status`

- await apiClient.delete(`/teacher-requests/requests/${requestId}`)
+ await apiClient.delete(`/teacher-requests/${requestId}`)
```

### 4. `apps/web/src/components/teacher-requests/TeacherCandidatesView.tsx`

```diff
- `/teacher-requests/requests/${requestId}/proposals`
+ `/teacher-requests/${requestId}/proposals`

- await apiClient.post(`/teacher-requests/proposals/${candidateId}/${responseAction}`, {})
+ await apiClient.post(`/proposals/${candidateId}/${responseAction}`, {})
```

Note : `/proposals/...` utilise la route nginx `/api/v1/proposals` → `teacher_request/proposals` (déjà présente).

### 5. `apps/web/src/components/teacher-requests/TeacherRequestInbox.tsx`

```diff
- await apiClient.post(`/teacher-requests/proposals/${proposalId}/${responseAction}`, {})
+ await apiClient.post(`/proposals/${proposalId}/${responseAction}`, {})
```

---

## Tests

- Build frontend : `npm run build` — ✅ succès (202 modules, 0 erreur TypeScript)
- Routes non touchées : `/api/v1/requests` (legacy), `/api/v1/proposals`, `/api/v1/assignments` — inchangées
- Routes parent/RP/formateur : non impactées négativement (les chemins `/teacher-requests/:id`, `/teacher-requests/:id/status`, `/teacher-requests/:id/proposals` sont désormais correctement routés)

---

## Point en suspens (hors scope de ce fix)

`StopCollaborationRequestForm.tsx` utilise `/teacher-collaborations/${collaborationId}/stop-request`.  
Or le backend a `@Controller('collaborations')` avec `POST /collaborations/:assignmentId/stop-request`,  
et la gateway n'a pas de règle nginx pour `/api/v1/collaborations`.  
Ce chemin frontend `/teacher-collaborations/...` n'a pas non plus de règle nginx correspondante.  
**À corriger dans un ticket séparé** : soit ajouter une location nginx `/api/v1/collaborations` → `teacher_request/collaborations`, soit mettre à jour le frontend pour appeler directement `/assignments/:id/termination` (qui a une règle nginx).
