# teacher-request-service — Route decline/reject proposal — 2026-06-24

## Statut : ✅

## Contexte

La tâche initiale demandait d'ajouter `POST /proposals/:proposalId/reject`.
À l'analyse du code, le codebase utilise systématiquement `decline` / `DECLINED`
(entité, spec service, spec contrôleur). La route a donc été nommée
`POST /proposals/:proposalId/decline` pour rester cohérent.

Les tests existants dans `test/unit/` référençaient déjà plusieurs méthodes
absentes du service et du contrôleur, causant 2 suites de tests en échec complet.
Toutes ces méthodes ont été implémentées dans la même session.

## Fichiers modifiés

### `src/teacher-request/entities/teacher-request.entity.ts`
- Ajout de l'enum `RequestType` (`SPECIFIC`, `PP_CHANGE`)
- Ajout des statuts `CANDIDATES_PUBLISHED`, `CANDIDATES_SELECTED`, `CANDIDATE_CHOSEN` dans `RequestStatus`
- Ajout des colonnes `type`, `currentPpTeacherId`, `selectedTeacherIds`, `chosenTeacherId`

### `src/teacher-request/teacher-request.service.ts`
- **`declineProposal(proposalId, user)`** : symétrie de `acceptProposal` — FORMATEUR uniquement, vérifie que la proposition lui est adressée, passe le statut à `DECLINED`, émet `TeacherProposalDeclined`
- **`createPpChangeRequest(dto, user)`** : PARENT_FINANCEUR uniquement, crée une demande de type `PP_CHANGE`
- **`publishSelectedCandidates(requestId, dto, user)`** : RP uniquement, vérifie que chaque teacherId a une proposition acceptée, passe la demande à `CANDIDATES_PUBLISHED`, émet `TeacherCandidatesSelected`
- **`selectCandidate(requestId, dto, user)`** : ELEVE ou PARENT_FINANCEUR, choisit un candidat parmi les propositions acceptées, passe la demande à `CANDIDATE_CHOSEN`, émet `TeacherCandidateChosen`
- **`createCollaborationStopRequest(assignmentId, dto, user)`** : FORMATEUR uniquement, symétrie de `createTermination` mais émet `TeacherStopRequested`

### `src/teacher-request/teacher-request.controller.ts`
- **`ProposalController`** : ajout de `POST :proposalId/decline` → `declineProposal`
- **`TeacherRequestController`** : ajout de `POST pp-change`, `POST :id/selected-candidates`, `POST :id/select`
- **`CollaborationController`** (nouveau) : `POST :assignmentId/stop-request` → `createCollaborationStopRequest`

## Résultats des tests

```
Test Suites: 2 passed, 2 total
Tests:       140 passed, 140 total
```

## Build TypeScript

`npx tsc --noEmit` : aucune erreur.

## Points en suspens

- Les nouvelles colonnes de l'entité (`type`, `currentPpTeacherId`, etc.) nécessitent une migration
  de base de données si la BDD est déjà provisionnée.
- `CollaborationController` doit être enregistré dans le module NestJS
  (`teacher-request.module.ts`) si ce n'est pas déjà géré dynamiquement.
