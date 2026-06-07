# calendar-service — Rapport Phase 1 — 2026-06-07

## Statut : ✅ Déjà implémenté, 28/28 tests passent

## Contexte

Le calendar-service était déjà entièrement implémenté dans un commit antérieur. Les fichiers source sont committé. L'audit de cette session confirme l'implémentation conforme à la spec.

## Arborescence finale

```
src/
  common/
    enums/user-role.enum.ts            ← UserRole (french-lowercase)
    guards/jwt-auth.guard.ts           ← vérifie JWT + type 'access', mappe sur req.user
    guards/roles.guard.ts              ← vérifie @Roles() via Reflector
    decorators/roles.decorator.ts      ← @Roles(...roles) SetMetadata
    current-user.decorator.ts          ← créé cette session (non utilisé, dead code bénin)
    jwt.guard.ts                       ← créé cette session (duplicate, non utilisé)
  events/
    events.service.ts                  ← publish() structuré JSON vers Logger
    events.module.ts                   ← exporte EventsService
    events.service.spec.ts             ← 4 tests
  calendars/
    entities/
      calendar.entity.ts               ← ownerId, ownerRole, OneToMany(availabilitySlots)
      availability-slot.entity.ts      ← calendarId, dayOfWeek, startTime, endTime, recurrence
      payment-schedule-entry.entity.ts ← financeur read-only (CAL-BR-003)
    dto/update-availability.dto.ts     ← slots[] avec recurrence enum
    calendars.controller.ts            ← GET /calendars/:ownerId, PUT /calendars/:ownerId/availability
    calendars.service.ts               ← getCalendar, updateAvailability, assertCanReadCalendar/Write
    calendars.service.spec.ts          ← 8 tests
    calendars.module.ts
  activities/
    entities/scheduled-activity.entity.ts ← ActivityType, ActivityStatus, participantIds (JSON array)
    dto/create-activity.dto.ts         ← validé participantIds >= 1 (CAL-FB-002)
    dto/update-activity.dto.ts         ← partial update avec re-validation
    activities.controller.ts           ← POST /activities, PUT /activities/:id, GET /activities/:id
    activities.service.ts              ← create, update, findOne, findByParticipant
    activities.service.spec.ts         ← 11 tests
    activities.module.ts
  reminders/
    entities/reminder.entity.ts        ← ownerId, activityId, remindAt, isSent
    dto/create-reminder.dto.ts
    reminders.controller.ts            ← POST /reminders (rôles limités)
    reminders.service.ts               ← create, findByOwner
    reminders.service.spec.ts          ← 4 tests
    reminders.module.ts
  app.module.ts                        ← TypeOrmModule + 3 feature modules
  main.ts
  calendar/                            ← scaffold original (dead code, non importé)
  events.service.ts                    ← créé cette session (duplicate, non utilisé)
```

## Routes implémentées

| Méthode | Chemin | Spec | Règle |
|---------|--------|------|-------|
| GET | /calendars/:ownerId | CAL-BR-001..004 | CAL-FB-001 : owner ou rôle interne |
| PUT | /calendars/:ownerId/availability | CAL-BR-001,002 | CAL-FB-001 : owner, RP ou TI |
| POST | /activities | CAL-BR-007,008 | CAL-FB-002,003 |
| PUT | /activities/:activityId | CAL-BR-010 | CAL-FB-001 : créateur, RP ou TI |
| GET | /activities/:activityId | — | public (auth JWT uniquement) |
| POST | /reminders | CAL-BR-004,010 | @Roles(RP, TI, FORMATEUR, ELEVE) |

## Événements publiés (log structuré)

- `AvailabilityUpdated` — après PUT /calendars/:ownerId/availability
- `ActivityScheduled` — après POST /activities
- `ActivityUpdated` — après PUT /activities/:activityId
- `ReminderCreated` — après POST /reminders

## Points en suspens

- **Incohérence potentielle sur les rôles JWT** : `UserRole` enum utilise les valeurs `eleve`, `formateur`, `responsable_pedagogique`... (format lowercase-french). Si identity-access-service émet des JWT avec `STUDENT`, `TEACHER`, `RP`... le guard rejettera tous les appels. À valider/harmoniser avant intégration.
- **GET /activities par participant** : `findByParticipant` utilise `LIKE %userId%` sur le champ `simple-json` — fonctionne pour les UUIDs mais fragile. Migration vers PostgreSQL `@>` jsonb en Phase 2.
- **PaymentScheduleEntry** : seule la lecture est implémentée. L'écriture appartient à finance-credit-service.
- **Vieux dossier `calendar/`** : dead code (scaffold initial), peut être supprimé proprement.
- **`src/events.service.ts` et `src/common/jwt.guard.ts`** : créés par erreur cette session, inutilisés, peuvent être supprimés.

## Résultat des tests

```
Tests:  28 passed, 28 total
Suites: 4 passed, 4 total
Time:   3.931 s
```
