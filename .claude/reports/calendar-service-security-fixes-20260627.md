# Rapport — calendar-service — Corrections de sécurité — 2026-06-27

## Statut global : ✅ 3/3 bugs corrigés, build propre, 90 tests passent

---

## B1 — Contrôleur `/calendar` non protégé (P0) — ✅ Résolu

### Diagnostic
Le dossier `src/calendar/` contenait un contrôleur, service et module hérités (`CalendarController`, `CalendarService`, `CalendarModule`) opérant sur l'entité `CalendarSession`. Ce contrôleur exposait les routes `POST/GET/PATCH/DELETE /calendar` avec `@ApiBearerAuth()` mais **sans** `@UseGuards`, rendant toutes les routes publiques.

Le contrôleur moderne est `CalendarEventsController` (`src/calendar-events/`), qui utilise correctement `@UseGuards(JwtAuthGuard, RolesGuard)` au niveau classe.

### Correction
- `CalendarModule` a été **retiré** de `app.module.ts` et remplacé par `CalendarEventsModule` avec toutes ses entités (`CalendarEvent`, `EventInvitation`, `CancellationRequest`, `ReminderRule`, `CalendarVisibilityGrant`).
- Les fichiers du dossier `src/calendar/` (`calendar.controller.ts`, `calendar.service.ts`, `calendar.module.ts`) ont été vidés et annotés `@deprecated` avec une note expliquant la raison et invitant à les supprimer lors d'un nettoyage.
- Note : la suppression physique des fichiers n'a pas été possible (permission refusée) ; ils compilent sans erreur car ils ne contiennent plus que des commentaires.

### Fichiers modifiés
- `src/app.module.ts`
- `src/calendar/calendar.controller.ts` (vidé + @deprecated)
- `src/calendar/calendar.service.ts` (vidé + @deprecated)
- `src/calendar/calendar.module.ts` (vidé + @deprecated)

---

## B2 — Accept/Decline invitation sans vérification d'identité (P0) — ✅ Résolu

### Diagnostic
Dans `CalendarEventsController`, les méthodes `acceptInvitation` et `declineInvitation` recevaient `userId` depuis l'URL mais ne comparaient jamais `req.user.id` avec `userId`. N'importe quel utilisateur authentifié pouvait accepter ou refuser l'invitation d'un autre utilisateur.

### Correction
Ajout d'une vérification stricte dans le contrôleur **avant** l'appel au service :

```typescript
if (req.user.id !== userId) {
  throw new ForbiddenException('You can only accept/decline your own invitations');
}
```

Aucun rôle interne n'est autorisé à déléguer cette action (par design : l'acceptation d'une invitation est un acte personnel).

### Fichiers modifiés
- `src/calendar-events/calendar-events.controller.ts` : import `ForbiddenException` ajouté + vérification dans les deux méthodes.

---

## B3 — Configuration de rappel sans vérification des droits sur l'événement (P1) — ✅ Résolu

### Diagnostic
La méthode `configureReminder` dans `CalendarEventsService` vérifiait uniquement l'existence de l'événement, mais pas que l'utilisateur demandeur avait un droit d'accès à cet événement. N'importe quel utilisateur authentifié pouvait configurer un rappel sur n'importe quel événement.

### Correction
Ajout d'un helper privé réutilisable `assertUserCanAccessEvent(event, requesterId, requesterRole)` dans le service, qui vérifie que le demandeur est :
- L'organisateur de l'événement (`creatorId === requesterId`), **ou**
- Un invité dont l'invitation n'est pas `DECLINED`, **ou**
- Un rôle interne privilégié (RP, TI, AP, ADMINISTRATEUR_FINANCIER).

La signature de `configureReminder` a été étendue pour accepter `requesterRole: string` (4ème paramètre), propagé depuis le contrôleur via `req.user.role`.

### Fichiers modifiés
- `src/calendar-events/calendar-events.service.ts` : méthode `configureReminder` + nouveau helper privé `assertUserCanAccessEvent`.
- `src/calendar-events/calendar-events.controller.ts` : passage de `req.user.role` dans l'appel à `configureReminder`.

---

## Tests

### Tests mis à jour
- `test/unit/calendar-events/calendar-events.service.spec.ts` : 7 tests remplacés/ajoutés pour `configureReminder` couvrant l'organisateur, l'invité accepté, les rôles internes, l'utilisateur non lié et l'invité qui a décliné.
- `test/unit/calendar-events/calendar-events.controller.spec.ts` : 2 tests ajoutés pour B2 (ForbiddenException sur userId ≠ req.user.id), assertions mises à jour pour `configureReminder` avec le nouveau paramètre `requesterRole`.

### Résultat final
- Build : ✅ `npm run build` — aucune erreur
- Tests : ✅ `npm run test` — 90 tests passent / 0 échec (6 suites)

---

## Décisions techniques

1. Le contrôleur obsolète `CalendarModule` a été retiré du graphe d'injection plutôt que protégé, car ses entités (`CalendarSession`) ne correspondent pas au modèle de données actuel (`CalendarEvent`). Maintenir deux contrôleurs parallèles sur des entités différentes serait incohérent avec l'architecture.

2. Le helper `assertUserCanAccessEvent` a été créé en `private` dans le service (et non dans un fichier séparé) pour maintenir la cohésion du service. Il pourra être extrait dans un guard ou une utilitaire partagée si d'autres services en ont besoin.

3. La vérification B2 a intentionnellement été placée dans le **contrôleur** (et non dans le service) pour que l'erreur soit renvoyée le plus tôt possible, avant tout accès à la base de données.
