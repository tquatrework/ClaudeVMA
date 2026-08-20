# Front — avertir sur une date de créneau déjà passée (2026-08-19)

## Contexte

`CalendarUnifiedView`/`AvailabilityGrid` est un gabarit hebdomadaire récurrent, sans année ni
semaine affichée. Un clic sur une case en mode « Créer un événement » résout la date réelle en
« prochaine occurrence de ce jour de semaine » (`buildIsoDateTimeForDay`). Si le jour cliqué est
**aujourd'hui** et l'heure déjà dépassée (ex. « Mercredi 15:00 » alors qu'il est 16h ce même
mercredi), la date résolue tombe dans le passé sans qu'aucun signal ne le montre.

## Décision utilisateur (2026-08-19)

Avertir avant de valider, laisser créer quand même si l'utilisateur insiste — pas de blocage.

## Périmètre isolé — remarque worktree

Mon worktree agent était sur une branche (`worktree-agent-a0a209c33a5bfc4ec`) en retard par
rapport à `feat/calendrier-vue-unifiee` : les fichiers `QuickEventCreatePopover.tsx` /
`CalendarUnifiedView.tsx` n'existaient pas encore dans mon arbre. J'ai réinitialisé (`git reset
--hard`) ma branche locale sur `origin/feat/calendrier-vue-unifiee` (aucun commit local perdu, ma
branche n'en avait aucun d'unique), travaillé et committé par-dessus. **Le commit produit
(`56a0f41`) est donc sur ma branche worktree, avec `origin/feat/calendrier-vue-unifiee` comme
parent direct** — l'orchestrateur doit le rapatrier/rebaser sur `feat/calendrier-vue-unifiee` dans
le dépôt principal avant de pousser, pas juste pousser ma branche telle quelle.

## Ce qui a été fait

1. **Nouvelle fonction pure** `isResolvedDateTimeInPast(isoDateTime, referenceDate = new Date())`
   dans `apps/web/src/utils/availabilitySlotApiMapping.ts`, à côté de `buildIsoDateTimeForDay`
   (même fichier, même logique de date). Paramètre `referenceDate` explicite pour rester testable
   de façon déterministe (même convention que `nextOrTodayDateForWeekday`).

2. **`QuickEventCreatePopover.tsx`** — avertissement amber (`bg-amber-50 border-amber-200
   text-amber-800`, même style que `CancellationRequestDialog`) affiché sous la date résolue en
   toutes lettres, quand `isResolvedDateTimeInPast(startAt)` est vrai. Message : « Cette date est
   déjà passée. Vous pouvez tout de même créer l'événement si vous le souhaitez. » Le bouton
   « Créer » reste actif, aucun blocage.

3. **`AvailabilitySlotFormModal.tsx`** (création de disponibilité, même mécanisme de résolution de
   date via `buildIsoDateTimeForDay`, `AvailabilityGrid`) — même risque identifié et confirmé :
   la valeur par défaut de `recurrence` en création est `'NONE'` (« Une seule fois »), qui
   représente une occurrence concrète et unique exactement comme un événement. Avertissement
   appliqué **uniquement pour `recurrence === 'NONE'`** — un créneau `WEEKLY`/`BIWEEKLY` reste
   valide pour les semaines suivantes même si l'occurrence d'aujourd'hui est déjà dépassée ;
   avertir dans ce cas induirait en erreur sur l'utilité réelle du créneau (documenté en
   commentaire dans le code). Le formulaire ne montrait auparavant aucune date résolue — le
   calcul et l'affichage ont été ajoutés (`useMemo` sur `dayOfWeek`/`startTime`/`recurrence`), même
   style d'avertissement que ci-dessus.

## Tests ajoutés

- `apps/web/test/components/calendar/QuickEventCreatePopover.test.tsx` (nouveau, 3 tests) :
  - avertissement affiché quand le jour/heure cliqués résolvent vers aujourd'hui déjà passé,
    bouton « Créer » toujours actif ;
  - aucun avertissement quand l'heure résolue est encore à venir aujourd'hui ;
  - aucun avertissement quand le jour cliqué n'est pas encore survenu cette semaine.
  - `vi.useFakeTimers()` + `vi.setSystemTime('2026-08-24T16:00:00.000Z')` (lundi 16h UTC, vérifié
    `getUTCDay() === 1`) pour un test déterministe.

- `apps/web/test/components/calendar/AvailabilitySlotFormModal.test.tsx` (3 tests ajoutés, même
  référence de date) :
  - avertissement en récurrence NONE quand l'heure résolue est déjà passée ;
  - aucun avertissement en récurrence NONE quand l'heure résolue est à venir ;
  - aucun avertissement en récurrence WEEKLY même si l'heure du jour est déjà passée (valeur
    initiale directe, pas d'interaction `userEvent` sous timers fictifs — voir note ci-dessous).

Note technique : `userEvent` (délais internes via `setTimeout`) est incompatible avec
`vi.useFakeTimers()` sans avancer les timers manuellement ; le test de non-régression sur la
récurrence WEEKLY passe donc la valeur directement en `initialValues` plutôt que de simuler la
sélection dans le menu déroulant.

## Vérifications

- `npx tsc --noEmit` → 0 erreur.
- `npm run build` → succès.
- `npx vitest run` (suite complète, 1761 tests) → **28/28 verts** sur les 3 fichiers touchés
  (`QuickEventCreatePopover.test.tsx`, `AvailabilitySlotFormModal.test.tsx`,
  `CalendarUnifiedView.test.tsx` — vérifié que la fusion des trois sources et le flow de création
  d'événement ne sont pas cassés). **2 échecs pré-existants** dans
  `test/pages/EleveDashboardPage.test.tsx`, confirmés indépendants de ce changement (aucun fichier
  touché par cette tâche, échec reproduit en isolation sur la branche telle que reçue).

## Rappel — pas une preuve utilisateur

Conformément à la définition de « terminé » du projet : cette suite de tests simule tout le
réseau et ne prouve rien contre la pile réelle. Le comportement (avertissement affiché à l'écran
lors d'un clic sur une case déjà passée) reste à valider par une capture d'écran ou un test e2e
contre `https://claudevma.visioprof.fr`, non fait ici (hors périmètre demandé — tests unitaires
uniquement).

## Fichiers modifiés/créés

- `apps/web/src/utils/availabilitySlotApiMapping.ts`
- `apps/web/src/components/calendar/QuickEventCreatePopover.tsx`
- `apps/web/src/components/calendar/AvailabilitySlotFormModal.tsx`
- `apps/web/test/components/calendar/QuickEventCreatePopover.test.tsx` (nouveau)
- `apps/web/test/components/calendar/AvailabilitySlotFormModal.test.tsx`

Commit : `56a0f41` sur la branche worktree `worktree-agent-a0a209c33a5bfc4ec`, parent
`origin/feat/calendrier-vue-unifiee` (90f02e5). Non poussé, comme demandé.
