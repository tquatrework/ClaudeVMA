# Rapport — teacher-request-service — 2026-06-15

## Statut global : ✅ Complété

## Ce que le delta demandait

Le delta (`teacher-request-service-delta.md`) identifiait trois ajouts majeurs par rapport à l'ancienne version :

1. **Changement de PP réservé au financeur** — `POST /requests/pp-change`
2. **Workflow complet des candidats** — statuts, refus formateur, choix client final
3. **Arrêt de collaboration formateur avec préavis** — alias `/collaborations/:id/stop-request` manquant

Fonctionnalités 005 (statuts complets) et refus formateur étaient entièrement absentes.

## Ce qui manquait exactement (avant cette session)

| Élément | État avant | Action effectuée |
|---|---|---|
| `POST /requests/pp-change` | Absent | Ajouté |
| `RequestType` enum (SPECIFIC / PP_CHANGE) | Absent | Ajouté dans `teacher-request.entity.ts` |
| Champs `type`, `currentPpTeacherId`, `chosenTeacherId` sur `TeacherRequest` | Absents | Ajoutés |
| `RequestStatus.CANDIDATES_SELECTED` | Absent | Ajouté |
| `RequestStatus.CANDIDATE_CHOSEN` | Absent | Ajouté |
| `RequestStatus.CLOSED` | Absent | Ajouté |
| `ProposalStatus.CHOSEN` | Absent | Ajouté |
| `POST /proposals/:id/decline` (refus formateur) | Absent | Ajouté |
| `POST /requests/:id/select` (choix candidat final) | Absent | Ajouté |
| `POST /collaborations/:id/stop-request` (alias XML) | Absent | Ajouté |
| Événement `TeacherCandidateChosen` | Absent | Émis par `selectCandidate` |
| Événement `TeacherStopRequested` | Émis comme `TeacherRelationTerminationRequested` | Renommé |
| `CreatePpChangeDto` | Absent | Créé |
| `SelectCandidateDto` | Absent | Créé |
| `CollaborationController` | Absent | Créé et enregistré dans le module |

## Routes disponibles après implémentation

### `/requests` (TeacherRequestController)
- `POST /requests` — créer une demande spécifique (ELEVE, PARENT_FINANCEUR, RP)
- `POST /requests/pp-change` — demander un changement de PP (PARENT_FINANCEUR uniquement)
- `GET /requests` — lister les demandes (scope selon rôle)
- `GET /requests/:id` — détail d'une demande
- `POST /requests/:id/select` — choisir le candidat final (ELEVE ou PARENT_FINANCEUR)
- `PATCH /requests/:id/status` — mettre à jour le statut (RP uniquement)
- `DELETE /requests/:id` — supprimer une demande (RP uniquement)
- `POST /requests/:requestId/proposals` — rediriger vers un formateur (RP uniquement)

### `/proposals` (ProposalController)
- `POST /proposals/:proposalId/accept` — accepter une proposition (FORMATEUR uniquement)
- `POST /proposals/:proposalId/decline` — refuser une proposition (FORMATEUR uniquement)

### `/assignments` (AssignmentController)
- `POST /assignments/:assignmentId/main-teacher` — désigner le PP (RP ou ELEVE)
- `POST /assignments/:assignmentId/termination` — demander l'arrêt (FORMATEUR uniquement)

### `/collaborations` (CollaborationController — alias XML)
- `POST /collaborations/:assignmentId/stop-request` — alias de `/assignments/:id/termination`

### `/health`
- `GET /health` — healthcheck

## Événements publiés

| Événement | Déclenché par |
|---|---|
| `TeacherRequestCreated` | `createRequest`, `createPpChangeRequest` |
| `TeacherProposalSent` | `createProposal` |
| `TeacherProposalDeclined` | `declineProposal` |
| `TeacherAssigned` | `acceptProposal` |
| `MainTeacherAssigned` | `setMainTeacher` |
| `TeacherCandidateChosen` | `selectCandidate` |
| `TeacherStopRequested` | `createTermination` / `createCollaborationStopRequest` |
| `TeacherRequestStatusUpdated` | `updateRequestStatus` |
| `TeacherRequestDeleted` | `deleteRequest` |

## Résultats des tests

```
Tests: 68 passed, 68 total (était 44 avant cette session)
Test Suites: 1 passed, 1 total
Time: 4.223 s
```

24 nouveaux tests ajoutés couvrant :
- `createPpChangeRequest` : 5 cas (nominal + rôles interdits + événement)
- `declineProposal` : 6 cas (nominal + rôles interdits + état invalide + 404)
- `selectCandidate` : 10 cas (nominal × 2 rôles + rôles interdits + états invalides + 404 + événement)
- `createCollaborationStopRequest` : 3 cas (délégation, nominal, rôle interdit)

TypeScript : `tsc --noEmit` sans erreur.

## Écarts restants avec les XML

- **Fonctionnalité 006 — Recherche formateur RP** : pas de route de recherche (`GET /teachers/search?points=...&level=...&sector=...`). Cette fonctionnalité nécessite une dépendance sur `profile-service` et `calendar-service` (disponibilités) ; elle est laissée pour une session dédiée.
- **`TeacherCandidatesSelected`** : événement prévu par le XML mais aucune route RP ne marque explicitement l'état "candidats sélectionnés" en bloc. Le statut `CANDIDATES_SELECTED` est disponible dans l'enum — à connecter si le RP veut valider un sous-ensemble avant soumission au client.
- **Notification email financeur** (critère d'acceptation 1) : l'événement `TeacherRequestCreated` est émis ; la notification email dépend de `communication-service` et est déléguée à l'orchestrateur.

## Fichiers modifiés ou créés

- `src/teacher-request/entities/teacher-request.entity.ts` — ajout `RequestType`, statuts, champs `type`/`currentPpTeacherId`/`chosenTeacherId`
- `src/teacher-request/entities/teacher-proposal.entity.ts` — ajout `ProposalStatus.CHOSEN`
- `src/teacher-request/dto/create-pp-change.dto.ts` — nouveau
- `src/teacher-request/dto/select-candidate.dto.ts` — nouveau
- `src/teacher-request/teacher-request.service.ts` — ajout `createPpChangeRequest`, `declineProposal`, `selectCandidate`, `createCollaborationStopRequest`; renommage événement `TeacherStopRequested`
- `src/teacher-request/teacher-request.controller.ts` — ajout routes `pp-change`, `select`, `decline`, `CollaborationController`
- `src/teacher-request/teacher-request.module.ts` — enregistrement `CollaborationController`
- `test/unit/teacher-request.service.spec.ts` — 24 nouveaux tests
