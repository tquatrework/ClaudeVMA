# Audit S3 — teacher-request-service — Identifiants utilisateur dans l'URL

**Date** : 2026-06-28  
**Service** : `teacher-request-service`  
**Statut global** : ✅ Corrigé (2 failles identifiées et traitées)

---

## Périmètre audité

Contrôleurs :
- `TeacherRequestController` (`/requests`)
- `ProposalController` (`/proposals`)
- `CollaborationController` (`/collaborations`)
- `AssignmentController` (`/assignments`)

Tous les endpoints utilisent `@UseGuards(JwtAuthGuard)` + `@CurrentUser()`.  
Aucun endpoint n'expose de `:studentId`, `:teacherId` ou `:userId` directement en URL —
les paramètres d'URL sont des IDs de ressources (requestId, proposalId, assignmentId).

---

## Tableau endpoint par endpoint

| Endpoint | Paramètre URL | Vérification demandeur | Statut avant | Statut après |
|---|---|---|---|---|
| `POST /requests` | — | ELEVE → `user.id`; PARENT/RP → `dto.studentId` requis | ✅ | ✅ |
| `GET /requests` | — | Scoped par `user.id` / `user.role` | ✅ | ✅ |
| `GET /requests/:id` | `:id` = requestId | ELEVE : `studentId === user.id`; parent : `requesterId === user.id`; RP : all | ✅ | ✅ |
| `PATCH /requests/:id/status` | `:id` = requestId | RP uniquement | ✅ | ✅ |
| `DELETE /requests/:id` | `:id` = requestId | RP uniquement | ✅ | ✅ |
| `POST /requests/pp-change` | — (body: studentId) | Rôle PARENT_FINANCEUR seul; `requesterId` forcé à `user.id`; pas de vérification lien parent-élève | ⚠️ S3-B | ✅ documenté |
| `POST /requests/:id/selected-candidates` | `:id` = requestId | RP uniquement | ✅ | ✅ |
| `POST /requests/:id/select` | `:id` = requestId | ELEVE : `request.studentId === user.id`; PARENT : **sans check** | ❌ S3-A | ✅ |
| `POST /requests/:requestId/proposals` | `:requestId` = requestId | RP uniquement | ✅ | ✅ |
| `POST /proposals/:proposalId/accept` | `:proposalId` | FORMATEUR + `proposal.teacherId === user.id` | ✅ | ✅ |
| `POST /proposals/:proposalId/decline` | `:proposalId` | FORMATEUR + `proposal.teacherId === user.id` | ✅ | ✅ |
| `POST /collaborations/:assignmentId/stop-request` | `:assignmentId` | FORMATEUR + `assignment.teacherId === user.id` | ✅ | ✅ |
| `POST /assignments/:assignmentId/main-teacher` | `:assignmentId` | RP ou ELEVE; ELEVE : `assignment.studentId === user.id` | ✅ | ✅ |
| `POST /assignments/:assignmentId/termination` | `:assignmentId` | FORMATEUR + `assignment.teacherId === user.id` | ✅ | ✅ |

---

## Failles corrigées

### ❌ S3-A — `selectCandidate` (PARENT_FINANCEUR sans vérification propriétaire)

**Fichier** : `teacher-request.service.ts` — méthode `selectCandidate`  
**Avant** : Un `PARENT_FINANCEUR` pouvait appeler `POST /requests/:id/select` sur n'importe quelle
demande, y compris celles créées par d'autres parents ou directement par l'élève.  
**Après** : Ajout de `if (user.role === UserRole.PARENT_FINANCEUR && request.requesterId !== user.id) throw ForbiddenException(...)`.  
**Impact** : Empêche un parent de choisir un formateur pour la famille d'un autre élève.

### ⚠️ S3-B — `createPpChangeRequest` (studentId non vérifié par rapport au lien parent-élève)

**Fichier** : `teacher-request.service.ts` — méthode `createPpChangeRequest`  
**Situation** : Un `PARENT_FINANCEUR` peut fournir n'importe quel `studentId` dans le DTO.
La vérification du lien parent-élève est une responsabilité de `profile-service` (non disponible
dans ce service phase 1).  
**Risque résiduel** : Moyen — la demande ne peut pas aboutir sans approbation RP. Pas d'accès
aux données, pas de modification directe.  
**Action** : Commentaire de garde ajouté documentant la limitation et le chemin d'upgrade
(vérification synchrone via `profile-service /verify-link` en phase 2).

---

## Points sans faille confirmés

- Toutes les routes formateur (`acceptProposal`, `declineProposal`, `createTermination`, `createCollaborationStopRequest`) vérifient `entity.teacherId === user.id` avant toute action.
- `setMainTeacher` vérifie `assignment.studentId === user.id` pour les élèves.
- `listRequests` est scopé par rôle (aucune fuite inter-utilisateur).
- Le JWT est vérifié côté guard (type `access` obligatoire, secret requis).

---

## Commit

`fix(teacher-request-service): corriger accès par identifiant URL sans vérification demandeur (S3)`  
SHA : `a98d453`
