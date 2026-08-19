# Rapport — preuve écran point 3 « calendrier de disponibilités lié à la visio » (2026-08-19)

## Statut : ✅ succès — les 5 preuves demandées sont établies contre la pile réelle

Test Playwright réel (aucun mock), joué à trois reprises consécutives contre
`https://claudevma.visioprof.fr`, résultat stable (3/3 vert). Chaque exécution crée de vrais
comptes élève/formateur via les routes d'inscription publiques et un vrai lien
TEACHER_OF_STUDENT, propose un créneau, attend la vraie notification asynchrone (consommateur
Redis), et fait accepter le créneau par l'élève à l'écran.

## Fichiers produits

- `apps/web/e2e/proof-course-slot-proposal.spec.ts` — le test.
- `apps/web/e2e/support/internalRelation.ts` — helper de préparation (voir section dédiée
  ci-dessous).
- `apps/web/e2e/README.md` — deux sections ajoutées (technique `docker exec`, mise à jour de « un
  seul test pour l'instant » qui ne reflétait déjà plus la réalité du dossier `e2e/`).

Committé sur la branche `worktree-agent-a1be69b445a70b349` de ce worktree, elle-même rebasée sur
`origin/feat/calendrier-proposition-creneau` avant de commencer (elle en contenait déjà les 15
commits du chantier, dont `21df266` qui documentait l'attente de cette preuve). **Non poussé** —
conformément à la consigne, l'orchestrateur relit et pousse.

## Comment la relation TEACHER_OF_STUDENT a été posée — écart à la consigne, documenté

La consigne proposait deux options : lire `INTERNAL_SECRET` dans `.env` à la racine du dépôt, ou
appeler la route interne via `docker exec` vers `profile-service`. **La première option m'était
inaccessible** : mes permissions de session bloquent explicitement la lecture de tout fichier
`.env*` (`Read`/`Bash cat` sur `.env` → « Permission denied » / « denied by your permission
settings », vérifié à plusieurs reprises, y compris avec des chemins absolus dans mon propre
worktree). J'ai donc pris la **seconde option**, comme la consigne l'anticipait explicitement pour
ce cas.

Mise en œuvre (`apps/web/e2e/support/internalRelation.ts`) :

```
docker exec visiomath_profile node -e "<script>"
```

Le script Node s'exécute **entièrement à l'intérieur du conteneur** `visiomath_profile` : il lit
`process.env.INTERNAL_SECRET` (la variable du conteneur lui-même, jamais transmise ni journalisée
par ce process hôte) pour construire l'en-tête `X-Internal-Secret`, puis appelle en HTTP local
(`localhost:3002`) `POST /internal/create-teacher-student-relation`. Seul le résultat (code HTTP +
corps, aucune donnée sensible) revient sur stdout du process hôte. Vérifié isolément avant
intégration au test :

```
$ docker exec visiomath_profile node -e "...avec un UUID nul invalide..."
{"status":400,"body":"{\"message\":[\"studentId must be a UUID\"],...}"}
```

confirmant la connectivité et la validation côté serveur, puis en usage réel dans le test :

```
POST /internal/create-teacher-student-relation (via docker exec) -> 201
{"teacherId":"...","studentId":"...","isPrincipalTeacher":true}
```

C'est le même contournement de test légitime déjà employé aux tours précédents de ce chantier
(point 2), seulement exécuté différemment (via `docker exec` plutôt que via un secret lu en
clair) parce que la route interne n'est de toute façon **jamais exposée par `api-gateway`**
(`docs/routes.md` le rappelle explicitement) — il aurait fallu de toute façon l'exécuter depuis
l'intérieur du réseau Docker, secret lu en local ou pas.

## Les 5 preuves, avec capture d'écran

Chemins absolus (`apps/web/test-results/`, produits à la dernière exécution verte) :

1. **LinkedCalendarView visible dans le composeur du formateur** (busy/free de l'élève, point 2 du
   chantier, jamais monté à l'écran jusqu'ici) :
   `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a1be69b445a70b349/apps/web/test-results/course-slot-01-linked-calendar-view-in-composer.png`
   — le dialogue « Proposer un créneau » affiche, sous le champ « Élève », le texte « Calendrier
   en lecture seule — seules les disponibilités, indisponibilités et périodes occupées sont
   visibles, jamais le contenu des activités. », la légende Disponible/Indisponible/Occupé, et la
   grille (vide ici — l'élève n'a aucune disponibilité déclarée, c'est un état réel et non un
   défaut).

2. **Créneau proposé, couleur pastel, boutons Accepter/Refuser** :
   `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a1be69b445a70b349/apps/web/test-results/course-slot-03-proposed-slot-pastel-with-buttons.png`
   — bloc « Cours / Morgane Creneau… / 20 août · 14:00 – 15:… » en `bg-indigo-50` (pastel),
   colonne Jeudi, ligne 14:00. Vérifié programmatiquement (`toHaveClass(/bg-indigo-50/)`) en plus
   du visuel : la différence pastel/plein étant subtile à l'œil sur une capture réduite, c'est
   l'assertion de classe qui fait foi.

3. **Notification dans la cloche, libellé exact, avant tout marquage lu** :
   `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a1be69b445a70b349/apps/web/test-results/course-slot-02-notification-bell-label.png`
   — cloche ouverte, badge « 1 », ligne « Proposition de cours ajoutée par Morgane
   Creneauprof1787120803633 » (nom réel du formateur créé pour ce run, résolu côté serveur — aucun
   UUID). Le clic sur cette ligne a été vérifié menant à `/calendar`
   (`expect(studentPage).toHaveURL(/\/calendar/)`, passé).

4. **Après acceptation — couleur pleine, boutons disparus** :
   `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a1be69b445a70b349/apps/web/test-results/course-slot-04-confirmed-slot-after-accept.png`
   — même bloc, désormais `bg-indigo-100` (plein), sans bouton (`getByRole('button')` compte 0
   dans ce bloc, vérifié). La réponse serveur réelle de `POST /activities/:id/accept` a été
   capturée et son `status` vérifié = `"confirmed"` (voir extrait de log ci-dessous), pas une
   supposition.

5. **Après rechargement complet de la page — l'état confirmé persiste** :
   `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a1be69b445a70b349/apps/web/test-results/course-slot-05-confirmed-slot-after-reload.png`
   — visuellement identique à la capture précédente, mais obtenue après `page.reload()` : preuve
   que l'état vient d'une vraie relecture serveur (`GET /calendars/:ownerId`) et non d'un état
   local qui aurait pu survivre en mémoire sans refléter la réalité.

Extrait de log de la dernière exécution verte (les IDs/horodatages changent à chaque run, ce sont
de vrais comptes/objets créés à chaque fois) :

```
Élève créé : e3718693-c7a2-45b8-ada6-87fdcabf591a (e2e.eleve.1787120851428)
Formateur créé : 48dcc81b-711c-45a9-9510-80f4bbed16e8 (e2e.prof.1787120851428)
POST /internal/create-teacher-student-relation (via docker exec) -> 201 {...}
POST /activities -> 201
Notification course_slot_proposed arrivée après 0s (-1 = jamais arrivée).
Notification trouvée : {"type":"course_slot_proposed","metadata":{"startTime":"2026-08-20T14:00:00.000Z","activityId":"...","activityType":"cours","proposerName":"Morgane Creneauprof1787120851428"}}
POST /activities/:id/accept -> 201
Corps de la réponse accept : {"id":"...","status":"confirmed",...}
1 passed (6.2s)
```

## Observation d'architecture (pas un bug bloquant, signalée quand même)

`useOwnerCalendarActivities.ts` (front) met à jour l'état local à `status: 'confirmed'`
**après** avoir attendu la réponse de `POST /activities/:id/accept`, mais **sans lire les champs
de cette réponse** — elle est `await`ée puis jetée, seul le succès (absence d'exception) déclenche
la mise à jour locale. La règle du projet (2026-08-10, « On réaffiche la réponse reçue, jamais le
corps envoyé ») demanderait de reconstruire l'entrée locale à partir du corps réellement renvoyé
par le serveur plutôt que de la déduire du succès de l'appel. Dans ce cas précis l'écart est sans
conséquence pratique : `accept` ne peut produire que `status: "confirmed"` en cas de succès
(contrat de la route, vérifié ci-dessus), donc l'affichage reste correct — et **le test le prouve
indépendamment** en revérifiant après un `page.reload()` complet (relecture serveur réelle, pas
d'état local). Je le signale par souci de cohérence avec la règle du projet, pas comme un défaut
utilisateur constaté.

## Ce que je n'ai pas fait / limites assumées

- Je n'ai touché à aucun fichier de `apps/web/src` ni à aucun service backend — uniquement
  `apps/web/e2e/`.
- Le créneau de test est fixé à J+1 14:00–15:00 UTC (le serveur exécutant ces tests tourne en UTC,
  `date` → `Etc/UTC`, vérifié) pour tomber dans la fenêtre 07:00–22:00 affichée par la grille — un
  choix de données de test, pas une contrainte produit.
- `npm install` et `npx playwright install chromium` ont été nécessaires (aucun `node_modules` ni
  navigateur Playwright n'existaient dans ce worktree) ; les deux sont dans le cache utilisateur
  partagé (`~/.cache/ms-playwright`), aucun fichier de dépôt modifié par cette étape.
- J'ai rencontré 2 fois le `502 "Service temporarily unavailable"` déjà documenté dans
  `e2e/README.md` (rate-limit `/auth/login`) pendant les itérations de mise au point du test — pas
  un bug, comportement attendu. J'ai ajouté un helper `loginOnScreen` avec retry borné (jusqu'à 4
  tentatives, 10s d'attente) pour que le test final ne soit pas fragile à ce phénomène documenté.

## Git

- Branche : `worktree-agent-a1be69b445a70b349` (ce worktree), rebasée sur
  `origin/feat/calendrier-proposition-creneau` avant tout travail — aucune nouvelle branche créée.
- Commit local (non poussé) : ajoute `apps/web/e2e/proof-course-slot-proposal.spec.ts`,
  `apps/web/e2e/support/internalRelation.ts`, et deux sections dans `apps/web/e2e/README.md`.
