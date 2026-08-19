# calendar-service — 2026-08-18 — Gap réel comblé (chantier calendrier, point 3)

## Contexte

Gap trouvé en testant en HTTP contre la pile réelle : `GET /calendars/:ownerId` (lecture de son
propre calendrier) promettait déjà « créneaux de disponibilité + activités » dans sa propre
documentation, mais ne portait **jamais** les activités. Conséquence : un destinataire d'une
proposition de créneau de cours n'avait aucun moyen de la découvrir dans l'application.

Décision de l'utilisateur, implémentée ici : le créneau proposé apparaît **directement dans le
calendrier du destinataire** — pas de liste séparée.

## Ce qui a été fait

### 1. `GET /calendars/:ownerId` porte désormais `activities`

- `CalendarsService.getCalendar` construit `activities` (`CalendarActivityView[]`) via une
  nouvelle méthode privée `buildActivitiesView`, pour **tous** les lecteurs autorisés (titulaire,
  RP/TI/AF, et `PARENT_FINANCEUR` qui la reçoit en plus de `paymentEntries`, pas à la place).
- Réutilise `ActivitiesService.findActiveInRange` (déjà livré au point 2 pour `busyBlocks`,
  aucune nouvelle requête SQL inventée) : activités où le titulaire est créateur OU participant,
  statut `proposed`/`confirmed`.
- **Fenêtre par défaut** : aucune convention n'existait déjà dans ce service pour cette route —
  2 semaines passées + 4 semaines à venir, choix documenté dans `docs/routes.md` et
  `docs/services/calendar-service.md`.
- Chaque élément porte `id, type, status, startTime, endTime, creatorId, creatorName,
  participantIds`.

### 2. `creatorName` résolu — jamais un UUID affiché

- Nouveau `ProfileDisplayNameClient` (`src/common/clients/profile-display-name.client.ts`),
  consommant `POST /internal/profiles/display-names` sur `profile-service` — **route déjà
  existante**, déjà utilisée par `dashboard-notification-service` (même pattern réutilisé,
  aucun nouveau mécanisme inventé). Un seul appel HTTP en lot pour tous les créateurs distincts
  de la fenêtre.
- Politique d'échec **délibérément différente** de `ProfileRelationsClient`/`IdentityAccessClient`
  (qui échouent fermé en `503`, ce sont des décisions d'accès) : une résolution de nom qui échoue
  dégrade gracieusement en `creatorName: null`, sans jamais faire échouer la lecture du calendrier
  — route de lecture centrale, rechargée à chaque visite de page. Ce qui reste non négociable :
  jamais un `creatorId` (UUID) affiché à la place.

### 3. `ActivityScheduled` réellement publié — mécanisme outbox + Redis, pas un nouveau stub

**Constat fait avant de coder** : `EventsService.publish()` de ce service écrivait UNE LIGNE DE
LOG et rien d'autre — aucun bus, aucun abonné, exactement le défaut déjà corrigé sur
`teacher-request-service` le 2026-08-12. Même remède appliqué ici, **copié fidèlement** du code
de `teacher-request-service` (vérifié explicitement, pas deviné) :

- Nouveau `src/events/entities/domain-event.entity.ts` (table `domain_events`, schéma identique).
- Nouveau `src/events/event-publisher.service.ts` (`EventPublisher`) : publie par `XADD` sur le
  **même** flux Redis `visiomath:events` que `teacher-request-service` — pas un flux propre à
  `calendar-service`. Sans `REDIS_URL`, rien n'est perdu (reste en attente dans `domain_events`).
- `EventsService.publish(type, payload, correlationId): void` **garde exactement sa signature
  publique** — les treize points d'appel existants du service n'ont pas été modifiés. En
  interne, l'écriture est asynchrone et non bloquante (fire-and-forget), cohérent avec le fait que
  tous les appelants publient déjà strictement après résolution de leur propre transaction.
- Nouvelle migration `1787070000000-AddDomainEventsOutbox` (schéma identique à celui de
  `teacher-request-service`), vérifiée `up`/re-exécution (no-op)/`down` contre une base Postgres
  jetable, indépendamment de la suite e2e (qui utilise `synchronize()`).
- `ioredis` ajouté aux dépendances, `REDIS_URL` optionnelle dans `env.validation.ts` (comme sur
  les autres services), déclarée dans `docker-compose.yml` pour `calendar-service`
  (`depends_on: redis: condition: service_healthy` ajouté).

### 4. Payload `ActivityScheduled` complété (pas de nouvel événement)

`recipientId` ajouté : le seul destinataire quand `participantIds` contient exactement un
élément (cas 1 proposeur → 1 destinataire déjà acté au point 3), `null` pour les usages
multi-participants existants (RP à plusieurs formateurs, `entretien_rp`, `rappel`, `autre`).
Destiné à `dashboard-notification-service` — **tâche séparée, non traitée ici**, comme demandé.

## Tests

- **236 tests unitaires** (était 198) — tous verts.
- **91 tests e2e** (était 88) — tous verts, `--runInBand` requis (défaut préexistant du service).
- Migration vérifiée manuellement contre une base Postgres jetable (`up`, re-exécution idempotente,
  `down`).
- `npm run build` (nest build) : succès, aucune erreur TypeScript.

## Forme exacte de `GET /calendars/:ownerId` (pour transmission sans ambiguïté)

```json
{
  "id": "b6e0920a-32dd-4a89-b46e-e7a981000001",
  "ownerId": "8d9a2c10-3b21-4b2b-9e9e-000000000001",
  "ownerRole": "eleve",
  "availabilitySlots": [],
  "createdAt": "2026-08-01T09:00:00.000Z",
  "updatedAt": "2026-08-01T09:00:00.000Z",
  "activities": [
    {
      "id": "3fa1b6e0-1234-4b2b-9e9e-000000000099",
      "type": "cours",
      "status": "proposed",
      "startTime": "2026-09-10T14:00:00.000Z",
      "endTime": "2026-09-10T15:00:00.000Z",
      "creatorId": "47a5808b-66c7-41c9-92cd-7367d1cda003",
      "creatorName": "Camille Durand",
      "participantIds": ["8d9a2c10-3b21-4b2b-9e9e-000000000001"]
    }
  ]
}
```

`paymentEntries` reste présent (en plus) pour `PARENT_FINANCEUR`, forme inchangée. Documentation
complète (champs, périmètre, fenêtre, mécanisme de résolution du nom) dans `docs/routes.md`,
section « `GET /calendars/:ownerId` — forme exacte de `activities` ».

## Fichiers modifiés/créés

- `services/calendar-service/src/calendars/calendars.service.ts` (+`CalendarActivityView`,
  `buildActivitiesView`, `formatDisplayName`)
- `services/calendar-service/src/calendars/calendars.controller.ts` (type de retour, doc Swagger)
- `services/calendar-service/src/calendars/calendars.module.ts` (+`ProfileDisplayNameClient`)
- `services/calendar-service/src/activities/activities.service.ts` (+`recipientId`)
- `services/calendar-service/src/common/clients/profile-display-name.client.ts` (nouveau)
- `services/calendar-service/src/events/events.service.ts` (réécrit : outbox au lieu de log)
- `services/calendar-service/src/events/event-publisher.service.ts` (nouveau)
- `services/calendar-service/src/events/entities/domain-event.entity.ts` (nouveau)
- `services/calendar-service/src/events/events.module.ts` (+repo/provider)
- `services/calendar-service/src/migrations/1787070000000-AddDomainEventsOutbox.ts` (nouveau)
- `services/calendar-service/src/config/env.validation.ts` (+`REDIS_URL` optionnelle)
- `services/calendar-service/package.json` / `package-lock.json` (+`ioredis`)
- `docker-compose.yml` (+`REDIS_URL`, `depends_on: redis` pour `calendar-service`)
- Tests : `test/unit/events/events.service.spec.ts` (réécrit), nouveau
  `test/unit/events/event-publisher.service.spec.ts`, nouveau
  `test/unit/common/clients/profile-display-name.client.spec.ts`, extensions de
  `test/unit/calendars/calendars.service.spec.ts`, `test/unit/activities/activities.service.spec.ts`,
  `test/e2e/calendar.e2e-spec.ts`, `test/e2e/helpers/app.helper.ts` (+`FakeProfileDisplayNameClient`)
- `docs/routes.md`, `docs/services/calendar-service.md` (documentation à jour)

## Points ouverts (hors mandat de cette tâche)

- `dashboard-notification-service` : consommer `ActivityScheduled`/`recipientId` pour notifier
  « Proposition de cours ajoutée par {nom} » — tâche séparée à venir.
- Front : afficher les créneaux `PROPOSED` en couleur distincte avec Accepter/Refuser inline dans
  la grille du calendrier du destinataire — tâche séparée, non traitée ici (backend uniquement).
- Fenêtre par défaut de `activities` (2 semaines passées + 4 à venir) : pas un paramètre de requête
  pour l'instant, contrairement à `from`/`to` sur `/busy` — à ouvrir si besoin plus tard.
- Point 4 du chantier (intégration LiveKit) toujours non traité.

## Commit / branche

Commit `ab00c73` sur `feat/calendrier-proposition-creneau`, poussé sur `origin`
(`52efafd..ab00c73`). Branche pullée avant commit (fast-forward depuis `origin`).
