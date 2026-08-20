# calendar-service — CalendarEventCreated : title manquant du payload (2026-08-20)

## Contexte
Branche `fix/calendrier-creation-et-affichage`. Un test e2e réel a trouvé que la notification
`event_invitation_received` reçue par un invité affichait toujours `metadata.title: null`, même
pour un événement créé avec un vrai titre.

## Cause
`CalendarEventsService.createEvent` (`src/calendar-events/calendar-events.service.ts`) publiait
`CalendarEventCreated` sans jamais inclure la clé `title` dans le payload. Côté consommateur,
`dashboard-notification-service` lisait déjà `payload.title ?? null` — rien à corriger là-bas,
il recevait simplement `undefined` traité comme `null`.

## Correctif
Ajout de `title: createdEvent.title` dans le payload publié (valeur persistée après commit de la
transaction, jamais `dto.title` brut) — `null` reste la valeur correcte quand l'événement n'a
réellement pas de titre (titre optionnel depuis un correctif antérieur du même chantier, aucun
titre par défaut n'est fabriqué côté serveur).

Fichier modifié : `services/calendar-service/src/calendar-events/calendar-events.service.ts`.

## Tests
Deux tests ajoutés dans
`services/calendar-service/test/unit/calendar-events/calendar-events.service.spec.ts`
(describe `createEvent`) :
- `CalendarEventCreated payload carries the real event title`
- `CalendarEventCreated payload carries title: null when the event has no title`

Suite complète relancée (`npm test`, après `npm install` car `node_modules` absent au démarrage
de la session) :

```
Test Suites: 17 passed, 17 total
Tests:       263 passed, 263 total
Time:        11.512 s
```

Aucune régression.

## Documentation
`docs/routes.md` mis à jour :
- section calendar-service : exemple JSON de `CalendarEventCreated` corrigé (`title` ajouté),
  paragraphe explicatif du défaut et du correctif ajouté.
- section dashboard-notification-service : le paragraphe qui constatait l'absence de `title` sur
  le flux Redis réel (`XREVRANGE`, 2026-08-20) est mis à jour pour renvoyer vers le correctif côté
  calendar-service plutôt que de décrire un défaut encore actif.

## Git
Remarque opérationnelle : la branche `fix/calendrier-creation-et-affichage` était déjà checkoutée
dans le worktree principal (`/home/debian/Documents/claudeVMA`), inaccessible depuis ce worktree
d'agent isolé. Travail fait sur une branche temporaire `agent/calendar-title-fix` créée depuis
`origin/fix/calendrier-creation-et-affichage`, committé (`c76e098`), puis poussé directement sur
`origin/fix/calendrier-creation-et-affichage` (`git push origin HEAD:fix/calendrier-creation-et-affichage`).
Le worktree principal devra faire un `git pull` pour voir ce commit.

## Statut
✅ Correctif ciblé, testé (unitaire) et documenté. Reste, comme rappelé par les règles du projet :
la preuve e2e/écran finale sur https://claudevma.visioprof.fr n'a pas été rejouée par cet agent —
à confirmer après déploiement.
