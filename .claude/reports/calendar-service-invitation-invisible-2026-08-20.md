# calendar-service — invitation d'événement invisible pour le destinataire (2026-08-20)

## Contexte

Bug réel signalé par l'utilisateur : `professeur.lycee` crée un événement partagé avec
`eleve.sixieme` (`POST /calendars/professeur.lycee/events` avec `inviteeIds`). L'élève ne voit
rien — ni sur son calendrier, ni de notification — donc aucun moyen d'accepter ou de refuser
l'invitation.

Branche : `fix/calendrier-creation-et-affichage`, commit `a2af752` (docs uniquement) puis
`f1f744d` (ce correctif), poussé sur `origin/fix/calendrier-creation-et-affichage`.

## Point 1 — Visibilité des événements où l'utilisateur est invité

**Hypothèse confirmée.** Lecture du code réel (`CalendarEventsService.listEvents`) :
`GET /calendars/:ownerId/events` filtrait uniquement sur `event.owner_id = :ownerId` — jamais sur
`EventInvitation.invitee_id`. Un événement est toujours stocké sous le calendrier de son
**créateur** (`ownerId` du chemin `POST` = l'appelant), jamais sous celui de ses invités.
Conséquence directe : `GET /calendars/eleve.sixieme/events` ne pouvait **jamais** renvoyer un
événement créé par `professeur.lycee`, quel que soit le nombre d'invitations posées. C'est le
bug racine.

`GET /calendars/:ownerId` (l'autre route mentionnée dans l'hypothèse) a aussi été vérifiée :
**elle n'est pas concernée**, et ne l'a jamais été — elle ne porte que `availabilitySlots` et
`activities` (`ScheduledActivity`), jamais `CalendarEvent`, depuis le chantier du 2026-08-18. Ce
n'est pas une régression introduite ici, c'est un choix de périmètre déjà en place (deux agrégats
distincts, deux routes distinctes — `CalendarEvent`/`GET .../events` d'un côté,
`ScheduledActivity`/`activities` de l'autre).

**Correctif** : `CalendarEventsService.listEvents` filtre désormais sur
`(event.owner_id = :ownerId OR invitation.invitee_id = :ownerId)` — même principe que
`ActivitiesService.findActiveInRange` (« créateur OU participant » devient « créateur OU invité »).
Chaque événement renvoyé porte un nouveau champ calculé `viewerInvitationStatus`
(`pending`/`accepted`/`declined`/`null`) — le statut de l'invitation du titulaire du `GET` sur cet
événement, `null` s'il n'est pas invité (son propre événement, ou accès par rôle privilégié /
`CalendarVisibilityGrant`).

Effet de bord documenté et assumé : pour un événement où le lecteur n'est qu'invité, seule SA
propre ligne `EventInvitation` remonte dans le tableau `invitations` (protection de vie privée —
un invité n'a pas à voir la réponse des autres invités) ; pour un événement dont il est créateur,
toutes les invitations restent visibles comme avant.

## Point 2 — Contenu de `CalendarEventCreated`

**Hypothèse infirmée.** Le payload publié par `CalendarEventsService.createEvent` portait déjà
`inviteeIds: dto.inviteeIds ?? []` avant cette session — aucune modification de code n'était
nécessaire. Vérifié et documenté avec un exemple JSON complet dans `docs/routes.md`, section
« Événements publiés ». Le payload suit le même modèle que `ActivityScheduled`/`participantIds` :
une liste d'`userId`, la résolution de nom pour l'affichage restant à la charge du consommateur
(`dashboard-notification-service`, hors périmètre de cette session).

## Point 3 — Route de suppression

**Confirmée absente.** Aucune route `DELETE` n'existait pour `CalendarEvent`, ni codée ni
documentée, contrairement à `DELETE /activities/:activityId` et
`DELETE /calendars/:ownerId/availability-slots/:slotId`.

**Ajoutée** : `DELETE /calendars/:ownerId/events/:eventId` — suppression physique, réservée au
créateur, RP ou TI (même politique que `POST /events/:id/cancel-request`, réutilise
`assertCanCancelEvent`), `404` si l'événement n'existe pas ou appartient à un autre `ownerId`
(pas de fuite d'existence, même posture que `DELETE .../availability-slots/:slotId`), `204` sans
corps. Publie un nouvel événement `CalendarEventDeleted` (`{eventId, ownerId, deletedBy}`),
ajouté au mécanisme outbox + flux Redis déjà en place depuis le 2026-08-18 — aucune modification
supplémentaire nécessaire côté `EventsService`, seul l'ajout du type à la liste connue.

## Tests

- Unitaires : 261 tests verts (245 avant, +16 nouveaux) —
  `test/unit/calendar-events/calendar-events.service.spec.ts` (filtre créateur OU invité,
  `viewerInvitationStatus` dans ses trois états, confirmation du payload `CalendarEventCreated`,
  `deleteEvent` complet), `test/unit/calendar-events/calendar-events.controller.spec.ts`
  (`deleteEvent`), `test/unit/events/events.service.spec.ts` (`CalendarEventDeleted`).
- E2E : 109 tests verts (97 avant, +12 nouveaux) — `test/e2e/calendar.e2e-spec.ts`, deux nouveaux
  `describe` : visibilité côté invité (avec acceptation réelle via
  `POST /events/:id/invitees/:userId/accept`) et suppression (créateur/RP/TI/tiers sans
  droit/404/401). Exécution `--runInBand` : course préexistante (déjà documentée dans une session
  précédente) entre suites e2e sur `DROP SCHEMA public CASCADE` concurrent sur `calendar_test`, non
  introduite par ce correctif.
- `npx tsc --noEmit` et `npm run build` (nest build) : verts.

## Documentation

- `docs/routes.md` : ligne `GET /calendars/:ownerId/events` mise à jour, nouvelle ligne `DELETE
  /calendars/:ownerId/events/:eventId`, nouvelle section dédiée avec exemple JSON complet (forme
  exacte de la réponse avec `viewerInvitationStatus`), section « Événements publiés » complétée
  (`CalendarEventDeleted` + confirmation `CalendarEventCreated`).
- `docs/services/calendar-service.md` : nouvelle session technique documentant l'ensemble.

## Points en suspens

- Notification effective des invités par `dashboard-notification-service` (consommation de
  `CalendarEventCreated`) : tâche séparée, non traitée ici — seul le payload côté
  `calendar-service` a été vérifié et documenté.
- Course entre suites e2e sur la base `calendar_test` partagée en exécution parallèle : toujours
  présente (héritée), `--runInBand` reste nécessaire pour une exécution fiable de
  `npm run test:e2e`.

## Fichiers modifiés

- `services/calendar-service/src/calendar-events/calendar-events.service.ts`
- `services/calendar-service/src/calendar-events/calendar-events.controller.ts`
- `services/calendar-service/src/events/events.service.ts`
- `services/calendar-service/test/unit/calendar-events/calendar-events.service.spec.ts`
- `services/calendar-service/test/unit/calendar-events/calendar-events.controller.spec.ts`
- `services/calendar-service/test/unit/events/events.service.spec.ts`
- `services/calendar-service/test/e2e/calendar.e2e-spec.ts`
- `docs/routes.md`
- `docs/services/calendar-service.md`

## État git

- Branche `fix/calendrier-creation-et-affichage` poussée sur `origin` (commit `f1f744d`, en tête
  de `a2af752`). PR non créée dans cette session (pas demandé).
- Branches locales/distantes non fusionnées dans `master`, hors périmètre de cette tâche mais
  signalées par prudence : `feat/front-reprise-candidature-formateur`,
  `feat/reprise-candidature-formateur`, `origin/feat/calendrier-vue-unifiee` (déjà mentionnée
  comme mergée dans un commit précédent — à vérifier fichier par fichier si le statut est
  incertain).
