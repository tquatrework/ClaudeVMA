# teacher-request-service — Rapport Phase 1 — 2026-06-07

## Statut : ✅ Implémenté, 27/27 tests passent

## Arborescence finale

```
src/
  common/
    jwt.guard.ts              ← vérifie JWT (Bearer) via @nestjs/jwt + ConfigService
    current-user.decorator.ts ← @CurrentUser() extrait JwtPayload de req.user
  teacher-request/
    entities/
      teacher-request.entity.ts      ← requesterId, requesterRole, studentId, subject, level, sector, status
      teacher-proposal.entity.ts     ← requestId, teacherId, availabilityNote, status
      assignment.entity.ts           ← studentId, teacherId, proposalId, requestId, isMainTeacher, status
      termination-request.entity.ts  ← assignmentId, teacherId, noticeDate, reason, status
    dto/
      create-request.dto.ts      ← studentId optional (PARENT requis seulement)
      create-proposal.dto.ts     ← teacherId + availabilityNote
      create-termination.dto.ts  ← noticeDate (ISO 8601) + reason
      update-status.dto.ts       ← scaffold conservé, non exposé dans le controller
    events.service.ts            ← logging structuré des événements domaine
    teacher-request.controller.ts ← toutes les routes spec, @Controller()
    teacher-request.service.ts   ← logique métier complète (TRQ-BR-001..008, TRQ-FB-001..003)
    teacher-request.module.ts    ← TypeOrmModule + JwtModule.registerAsync
    teacher-request.service.spec.ts ← 27 tests unitaires (nominaux + erreurs)
  app.module.ts                  ← 4 entités enregistrées
  health/                        ← inchangé (scaffold)
  main.ts                        ← inchangé (scaffold)
```

## Routes implémentées

| Méthode | Chemin | Rôles autorisés | Spec |
|---------|--------|-----------------|------|
| POST | /teacher-requests | STUDENT, PARENT | TRQ-BR-001..003 |
| GET  | /teacher-requests | STUDENT, PARENT, RP, TEACHER | TRQ-RA-001..004 |
| POST | /teacher-requests/:requestId/proposals | RP | TRQ-BR-003 |
| POST | /proposals/:proposalId/accept | TEACHER | TRQ-BR-002 |
| POST | /assignments/:assignmentId/main-teacher | RP, STUDENT | TRQ-BR-006 |
| POST | /assignments/:assignmentId/termination | TEACHER | TRQ-BR-005 |

## Événements publiés (log structuré)

- `TeacherRequestCreated` — après création d'une demande
- `TeacherProposalSent` — après redirection RP→formateur
- `TeacherAssigned` — après acceptation d'une proposition (crée l'Assignment)
- `MainTeacherAssigned` — après désignation du professeur principal
- `TeacherRelationTerminationRequested` — après demande d'arrêt avec préavis

## Décisions techniques

1. **TEACHER GET /teacher-requests** — retourne les `TeacherProposal[]` (et non les `TeacherRequest[]`) pour respecter TRQ-FB-001 (le formateur ne voit pas toutes les demandes, seulement celles qui lui sont adressées).
2. **studentId implicite** — si le requester est STUDENT, `studentId = user.sub` (pas besoin de le passer dans le body).
3. **isMainTeacher sur Assignment** — l'entité `MainTeacherStatus` de la spec est représentée par un booléen `isMainTeacher` sur `Assignment` (plus simple, même sémantique).
4. **JwtModule.registerAsync** — utilise `JWT_SECRET` de ConfigService (default `'dev-secret'` en dev).
5. **Entités TypeORM sans FK explicite** — les relations sont maintenues par UUIDs sans contrainte FK TypeORM pour simplifier les migrations en phase 1.

## Points en suspens

- Synchronisation du rôle JWT : le guard attend `user.role` au format `STUDENT | PARENT | TEACHER | RP | AP | TI | FINANCE_ADMIN` — à valider avec le token produit par identity-access-service.
- `PARENT` : la vérification que le parent est bien lié à l'élève (via profile-service) est reportée en Phase 2 — en Phase 1, le parent fournit `studentId` librement.
- Liste des activités non pourvues (TRQ-BR-007/008) : pas implémentée en Phase 1 (hors routes spec définies).

## Résultat des tests

```
Tests:  27 passed, 27 total
Suites: 1 passed, 1 total
Time:   2.608 s
```
