# calendar-service — Rapport d'audit statique — 2026-06-12

## BUG-001 — Suppression de CalendarModule non sécurisé

**Fichier modifié :** `services/calendar-service/src/app.module.ts`

**Changements :**
- Suppression de `import { CalendarModule } from './calendar/calendar.module'`
- Suppression de `import { CalendarSession } from './calendar/entities/calendar-session.entity'`
- Suppression de `CalendarModule` du tableau `imports`
- Suppression de `CalendarSession` du tableau `entities` dans `TypeOrmModule.forRootAsync`

**Résultat :** L'ancien domaine `calendar/` (CRUD sans guards) n'est plus monté dans l'application. Les routes exposées sans contrôle d'accès sont désactivées. Les 5 entités des modules sécurisés (`Calendar`, `AvailabilitySlot`, `PaymentScheduleEntry`, `ScheduledActivity`, `Reminder`) restent enregistrées.

---

## BUG-002 — Vérification de portée sur GET /activities/:activityId (IDOR)

**Fichiers modifiés :**
- `services/calendar-service/src/activities/activities.controller.ts`
- `services/calendar-service/src/activities/activities.service.ts`

**Contrôleur :**
- `getActivity()` reçoit maintenant `@Req() req: any` en paramètre
- Appelle `findOne(activityId, req.user.id, req.user.role)` au lieu de `findOne(activityId)`
- Ajout de `@ApiResponse({ status: 403, description: 'Forbidden — IDOR check' })`

**Service :**
- `findOne()` accepte deux paramètres supplémentaires : `requesterId: string`, `requesterRole: string`
- Après récupération, appelle le nouveau helper privé `assertCanReadActivity()`
- `assertCanReadActivity()` autorise l'accès si :
  - `requesterId === activity.creatorId`
  - `requesterId` est dans `activity.participantIds`
  - `requesterRole` est `RP`, `TI` ou `ADMINISTRATEUR_FINANCIER`
  - Sinon : lève `ForbiddenException('Access to this activity is not allowed')`

**Note :** `ForbiddenException` était déjà importé dans le service. Aucune modification d'autres méthodes.

---

## Statut

✅ Les deux bugs sont corrigés sans modification hors périmètre.
