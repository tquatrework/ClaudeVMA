# Arborescence — calendar-service (2026-06-10)

## Arborescence complète avec descriptions

```
services/calendar-service/
├── CLAUDE.md
├── Dockerfile                                     # Build multi-stage Node 20 Alpine, HEALTHCHECK, USER node
├── nest-cli.json
├── package.json                                   # Dépendances NestJS + TypeORM + Swagger
├── package-lock.json
├── tsconfig.json                                  # strictNullChecks: false
└── src/                                           # ~51 fichiers sources
    ├── main.ts                                    # Bootstrap NestJS, ValidationPipe, Swagger, CORS
    ├── app.module.ts                              # ConfigModule + TypeORM + CalendarModule (legacy) + CalendarsModule + ActivitiesModule + RemindersModule + HealthModule
    ├── health/
    │   ├── health.module.ts
    │   └── health.controller.ts                   # GET /health
    ├── calendar/                                  # Module legacy (rétrocompatibilité)
    │   ├── calendar.module.ts
    │   ├── calendar.controller.ts                 # Routes /calendar (ancienne nomenclature)
    │   ├── calendar.service.ts
    │   └── entities/
    │       └── calendar.entity.ts
    ├── calendars/                                 # Module principal — gestion des calendriers utilisateur
    │   ├── calendars.module.ts
    │   ├── calendars.controller.ts                # CRUD /calendars + gestion des créneaux de disponibilité
    │   ├── calendars.service.ts                   # Lazy calendar creation ; full-replace pour les créneaux
    │   ├── dto/
    │   │   ├── create-calendar.dto.ts
    │   │   └── update-availability.dto.ts
    │   └── entities/
    │       ├── calendar.entity.ts                 # id, ownerId, ownerType, timezone, createdAt
    │       └── availability-slot.entity.ts        # id, calendarId, dayOfWeek, startTime, endTime, isRecurring
    ├── activities/                                # Module activités planifiées
    │   ├── activities.module.ts
    │   ├── activities.controller.ts               # CRUD /activities
    │   ├── activities.service.ts                  # Publie ActivityScheduled, ActivityUpdated via EventsService
    │   ├── dto/
    │   │   ├── create-activity.dto.ts             # title, type, participantIds (simple-json), startTime, endTime, calendarId
    │   │   └── update-activity.dto.ts
    │   └── entities/
    │       └── activity.entity.ts                 # id, calendarId, title, type, participantIds (simple-json), startTime, endTime, status, createdAt
    ├── reminders/                                 # Module rappels
    │   ├── reminders.module.ts
    │   ├── reminders.controller.ts                # CRUD /reminders
    │   ├── reminders.service.ts                   # Publie ReminderCreated via EventsService
    │   ├── dto/
    │   │   └── create-reminder.dto.ts
    │   └── entities/
    │       └── reminder.entity.ts                 # id, activityId, userId, reminderAt, message, sent
    └── events/
        └── events.service.ts                      # Stub EventsService : log en console, prêt pour broker phase 2
```

## Routes HTTP exposées

| Méthode | Chemin                                  | Description                                                          | Auth       |
|---------|-----------------------------------------|----------------------------------------------------------------------|------------|
| GET     | /health                                 | Health check                                                         | Aucune     |
| GET     | /calendar                               | Liste des calendriers (route legacy)                                 | Bearer JWT |
| POST    | /calendar                               | Créer un calendrier (route legacy)                                   | Bearer JWT |
| GET     | /calendars                              | Lister les calendriers                                               | Bearer JWT |
| POST    | /calendars                              | Créer un calendrier (lazy : crée si inexistant pour le owner)        | Bearer JWT |
| GET     | /calendars/:id                          | Récupérer un calendrier par ID                                       | Bearer JWT |
| PATCH   | /calendars/:id                          | Mettre à jour un calendrier                                          | Bearer JWT |
| DELETE  | /calendars/:id                          | Supprimer un calendrier                                              | Bearer JWT |
| PUT     | /calendars/:id/availability             | Remplacer intégralement les créneaux de disponibilité (full-replace) | Bearer JWT |
| GET     | /activities                             | Lister les activités                                                 | Bearer JWT |
| POST    | /activities                             | Créer une activité (publie ActivityScheduled)                        | Bearer JWT |
| GET     | /activities/:id                         | Récupérer une activité                                               | Bearer JWT |
| PATCH   | /activities/:id                         | Mettre à jour une activité (publie ActivityUpdated)                  | Bearer JWT |
| DELETE  | /activities/:id                         | Supprimer une activité                                               | Bearer JWT |
| POST    | /reminders                              | Créer un rappel (publie ReminderCreated)                             | Bearer JWT |
| GET     | /reminders/:id                          | Récupérer un rappel                                                  | Bearer JWT |
| DELETE  | /reminders/:id                          | Supprimer un rappel                                                  | Bearer JWT |
| GET     | /api/docs                               | Swagger UI                                                           | Aucune     |

## Événements publiés

| Événement            | Déclencheur                         |
|----------------------|-------------------------------------|
| AvailabilityUpdated  | PUT /calendars/:id/availability     |
| ActivityScheduled    | POST /activities                    |
| ActivityUpdated      | PATCH /activities/:id               |
| ReminderCreated      | POST /reminders                     |

## Décisions techniques visibles dans le code

- **Lazy calendar creation :** la création de calendrier est idempotente — retourne l'existant si un calendrier existe déjà pour le même `ownerId`.
- **Full-replace pour les créneaux :** `PUT /calendars/:id/availability` supprime tous les créneaux existants avant d'insérer les nouveaux (pas de PATCH partiel).
- **JWT maison sans Passport :** guard JWT implémenté directement sans la couche Passport — vérifie simplement le token via `JwtService`.
- **Stub EventsService :** log en console uniquement (phase 1), remplacé par un broker en phase 2.
- **participantIds en simple-json :** liste de participants stockée en JSON dans une colonne sans table de jointure.
- **Module legacy `calendar` :** coexistence avec le module `calendars` pour rétrocompatibilité — à unifier.
- **TypeORM `synchronize` :** désactivé en production.
- **Tests e2e :** présents avec base PostgreSQL locale.

## Points en suspens

- Pas de route `GET /activities?participantId=` ni `GET /calendars?ownerId=` — filtrage par participant ou propriétaire absent.
- Module legacy `/calendar` à unifier avec `/calendars`.
- `PaymentScheduleEntry` mentionné dans le domaine mais sans route d'écriture exposée.
- Guard JWT déclaré mais sans vérification des rôles sur chaque route.
- Propagation de `x-correlation-id` non implémentée.
- Pas de gestion des conflits de créneaux (chevauchement d'activités non détecté).
