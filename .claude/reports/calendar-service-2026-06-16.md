# Rapport — calendar-service — 2026-06-16

## Routes disponibles

### Activités (existant)
| Méthode | Chemin | Description |
|---------|--------|-------------|
| POST | /activities | Créer une activité planifiée (rôle : FORMATEUR, RP, AP) |
| PUT | /activities/:activityId | Modifier une activité (créateur, RP ou TI) |
| GET | /activities/:activityId | Lire une activité par ID |

### Calendriers (existant + ajout GET availability)
| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | /calendars/:ownerId | Lire le calendrier complet (lazy init) |
| GET | /calendars/:ownerId/availability | Lire les créneaux de disponibilité (**nouveau**) |
| PUT | /calendars/:ownerId/availability | Remplacer les créneaux de disponibilité |

### Rappels (existant)
| Méthode | Chemin | Description |
|---------|--------|-------------|
| POST | /reminders | Créer un rappel (ELEVE, FORMATEUR, RP, TI) |

### Événements calendrier (**nouveau**)
| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | /calendars/:ownerId/events | Lister les événements autorisés (filtres: type, personId) |
| POST | /calendars/:ownerId/events | Créer un événement selon rôle |
| POST | /events/:id/invitees/:userId/accept | Accepter une invitation |
| POST | /events/:id/invitees/:userId/decline | Refuser une invitation |
| POST | /events/:id/cancel-request | Demander/appliquer une annulation |
| POST | /events/:id/reminders | Configurer un rappel paramétré |
| POST | /calendars/:ownerId/grants | Créer un accès visibilité (RP uniquement) |
| DELETE | /calendars/:ownerId/grants/:granteeId | Révoquer un accès visibilité (RP uniquement) |

### Santé
| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | /health | Health check (sans auth) |

## Résultats des tests

### Tests unitaires : 62/62 passés
- test/unit/activities/activities.service.spec.ts : 17 tests
- test/unit/calendars/calendars.service.spec.ts : 9 tests
- test/unit/events/events.service.spec.ts : 4 tests
- test/unit/reminders/reminders.service.spec.ts : 4 tests
- test/unit/calendar-events/calendar-events.service.spec.ts : 28 tests (**nouveau**)

### Tests e2e : 61/61 passés
- test/e2e/health.e2e-spec.ts : 2 tests
- test/e2e/calendar.e2e-spec.ts : 59 tests (dont 31 nouveaux)

## Entités créées

| Entité | Fichier | Rôle |
|--------|---------|------|
| CalendarEvent | calendar-events/entities/calendar-event.entity.ts | Événement central multi-domaines |
| EventInvitation | calendar-events/entities/event-invitation.entity.ts | Invitation à un événement (pending→accepted/declined) |
| CancellationRequest | calendar-events/entities/cancellation-request.entity.ts | Demande d'annulation (règle 48h) |
| ReminderRule | calendar-events/entities/reminder-rule.entity.ts | Règle de rappel paramétré (1week/1day/1hour/15min/none) |
| CalendarVisibilityGrant | calendar-events/entities/calendar-visibility-grant.entity.ts | Grant d'accès visibilité (RP only) |

## Règles métier implémentées

- **Filtrage par rôle** : PARENT_FINANCEUR et ADMINISTRATEUR_FINANCIER ne voient que les événements de type `financier`
- **Règle 48h** : si annulation < 48h avant l'événement → statut `pending_approval`, sinon `approved` et événement annulé automatiquement
- **Invitations** : `pending` → `accepted` ou `declined` (idempotent, ConflictException si déjà traité)
- **ReminderRule** : délai `none` supprime la règle existante
- **CalendarVisibilityGrant** : idempotent (retourne l'existant si déjà créé)
- **Événements métier publiés** : CalendarEventCreated, InvitationAccepted, InvitationDeclined, CancellationRequested

## Écarts résiduels avec la spec XML

1. **`CalendarSession`** : entité héritée (`calendar/entities/calendar-session.entity.ts`) qui utilise le type `enum` PostgreSQL-natif — non migrée vers le nouveau modèle `CalendarEvent`. Elle reste pour compatibilité ascendante.
2. **Filtrage PARENT_FINANCEUR sur "événements de ses élèves liés"** : la spec mentionne que le parent voit les événements autorisés de ses élèves liés. La liaison parent-élève est gérée par `profile-service` — en phase 1, le parent voit les événements `financier` uniquement (implémenté). La vue étendue sur les élèves liés est un écart résiduel à combler en phase 2 quand l'interface avec profile-service sera disponible.
3. **Événement `ReminderDue`** : ajouté au type `CalendarEventType` mais non déclenché automatiquement (pas de job asynchrone en phase 1 — prévu phase 2).
4. **Lien vers élément cible depuis événement passé** (fonctionnalité 007 de la spec) : le champ `targetRef` est prévu sur `CalendarEvent`, mais la navigation depuis le frontend n'est pas dans le périmètre du service.
