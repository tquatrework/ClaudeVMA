# Rapport front-tester — corrections calendrier A/B/C/D (2026-08-20)

## Contexte

Chantier front : `.claude/reports/front-developper-calendrier-corrections-2026-08-20.md`
(branche `fix/calendrier-creation-et-affichage`).

Point de départ : le worktree isolé de cet agent était sur une branche distincte
(`worktree-agent-a2c4c9a4390f9728f`, ancêtre commun avec `fix/calendrier-creation-et-affichage`
au commit `f3a4eb1`). Fast-forward `git merge --ff-only origin/fix/calendrier-creation-et-affichage`
effectué (aucune divergence, pur avancement) pour disposer du code réel à tester
(`EventCreateFormModal`, `EventRecipientPicker`, `CalendarWeekNavigator`, etc., absents avant ce
fast-forward).

## Test écrit

`apps/web/e2e/proof-calendar-fixes-2026-08-20.spec.ts` — Playwright, aucun mock, joué contre
`https://claudevma.visioprof.fr`. Inspiré de `proof-calendar-unified-view.spec.ts` (même
mécanisme de login, mêmes helpers d'API de préparation de données —
`createTestStudent`/`createTestTeacher`/`createTeacherStudentRelationViaInternalRoute`).

Scénario : élève + formateur créés par les routes publiques d'inscription, relation
`TEACHER_OF_STUDENT` posée via la route interne `profile-service` (`docker exec`, secret jamais
exposé), puis pilotage de l'écran `/calendar` côté élève.

## Résultats — exécution réelle (2 runs, tous deux verts)

```
✓  Corrections calendrier 2026-08-20 (A/B/C/D) › mode selector à 2 boutons, semaine navigable,
   sélection au quart d'heure, vraie création (4.2s–4.4s)
1 passed
```

Réponses HTTP réelles citées dans la sortie du test :
- `POST /internal/create-teacher-student-relation` → `201`
- `GET /calendars/:ownerId/busy` (prévisualisation destinataire) → `200`
- `POST /calendars/:ownerId/events` → `201`, corps cité intégralement, notamment
  `"title":null` — confirme que le backend accepte et persiste un événement sans titre, sans
  fabriquer de valeur de repli.

## Preuves point par point

**A — Sélecteur de mode.** `tablist` contient exactement 2 `tab` (`toHaveCount(2)`), le tab
« Consultation » a `toHaveCount(0)`. Exclusivité vérifiée en 3 temps : activer « Créer un
événement » → sélectionné ; activer « Indiquer une disponibilité » → celui-ci devient sélectionné
et l'autre se désélectionne automatiquement ; re-cliquer sur le bouton déjà actif → il se
désélectionne (retour à l'état neutre). Capture :
`apps/web/test-results/calendar-fixes-01-mode-selector.png` (gros plan du sélecteur, confirme
visuellement l'absence de « Consultation »).

**B — Dates réelles + navigation.** Libellé de semaine lu textuellement
(« Semaine du 17 au 23 août 2026 »), 7 dates réelles `JJ/MM` comptées sur la grille
(`toHaveCount(7)`). Clic « Semaine suivante » → libellé devient « Semaine du 24 au 30 août 2026 »
(`not.toBe` vérifié), clic « Semaine précédente » → retour exact au libellé initial. Captures :
`calendar-fixes-02-real-dates.png` (avant), `calendar-fixes-03-week-nav.png` (après « suivant »).

**C — Sélection au quart d'heure par glisser.** Glisser réel (`mouse.move`/`mouse.down`/
`mouse.move` par étapes/`mouse.up`, pas `dragTo`) entre les cases « Ajouter un créneau mercredi à
10:00 » et « ...à 10:15 ». La modale s'ouvre avec `#event-create-start = ...T10:00` et
`#event-create-end = ...T10:30` — exactement la plage survolée, pas la plage d'1h par défaut d'un
simple clic. C'est la preuve directe que la granularité au quart d'heure fonctionne, distincte du
comportement historique.

**D — Vraie modale de création.** Type limité à « Rappel » pour un élève (conforme
`ALLOWED_EVENT_TYPES_BY_ROLE`), titre laissé **volontairement vide** (`#event-create-title` vérifié
vide avant soumission), destinataire ajouté en tapant le **prénom** du formateur dans le champ de
recherche puis en cliquant son nom complet — jamais un UUID saisi. Une puce nominative retirable
apparaît (« Retirer Prénom Nom »), et le contenu texte de la modale entière est vérifié **sans**
correspondre au motif UUID. La prévisualisation busy/free (`GET /calendars/:ownerId/busy` → `200`)
s'affiche avec sa légende Disponible/Indisponible/Occupé. Capture :
`calendar-fixes-04-event-modal-recipient-availability.png`.

Après soumission : `POST /calendars/:ownerId/events` → `201`, `title: null` cité dans les logs ;
la modale se ferme ; le bloc créé sur la grille affiche **« Sans titre »** (repli de
`EventGridBlockLabel`), et le texte visible de la page ne contient **aucun** fragment de l'UUID de
l'événement créé (vérifié en comparant à `id.slice(0, 8)`). Capture :
`calendar-fixes-05-event-created-no-title.png` — le bloc rose « Sans titre / 19 août · 10:00 -
10:30 » est visible sur la colonne Mercredi.

## Défaut réel constaté en testant

Aucun défaut fonctionnel trouvé sur les 4 points testés — les deux exécutions du test sont
passées sans ajustement du test après le premier essai (aucune assertion affaiblie, aucun
contournement). Seul artefact visuel bénin remarqué sur la capture finale : un très léger
surlignage résiduel (état `:hover`) sur une case vide du mardi, dû à la position du curseur
laissée par Playwright après le dernier `mouse.move` du glisser — pas un bug applicatif, juste un
effet de survol normal capturé au hasard de la position finale de la souris de test.

## Fichiers

- Test : `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a2c4c9a4390f9728f/apps/web/e2e/proof-calendar-fixes-2026-08-20.spec.ts`
- Captures : `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a2c4c9a4390f9728f/apps/web/test-results/calendar-fixes-0{1..5}-*.png`
- Commit : `faeece5` sur `fix/calendrier-creation-et-affichage`, poussé sur `origin`
  (`git push origin HEAD:fix/calendrier-creation-et-affichage`, `6e1bf89..faeece5`).

## Note de workflow (git)

Cet agent est isolé dans un worktree dédié ; le fast-forward vers
`origin/fix/calendrier-creation-et-affichage` a été nécessaire pour disposer du code réellement
concerné avant de pouvoir écrire un test qui le cible. Aucune opération destructive.

Branches locales non fusionnées dans `master` à date (relevé informatif, hors périmètre de cette
tâche — signalé conformément à la règle du projet) : `feat/front-reprise-candidature-formateur`,
`feat/reprise-candidature-formateur`, `fix/calendrier-creation-et-affichage` (celle de cette
tâche, PR à ouvrir/merger par l'orchestrateur), et les worktrees d'agents résiduels
`worktree-agent-ad884b1dea2051024`, `worktree-agent-afdb918b5be5f477e`.
