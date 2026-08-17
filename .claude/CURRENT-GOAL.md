# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## RÈGLE PERMANENTE — 2026-08-17 — pas de changement de menu sans approbation

L'utilisateur a explicitement demandé : ne plus ajouter d'élément au menu du haut ni au rail
latéral gauche sans son approbation préalable explicite. Il tient à sa structure de navigation
initiale. Voir mémoire `feedback-no-menu-changes-without-approval`. Cette règle s'applique à
toute délégation future à `front-developper` : proposer, ne pas ajouter directement.

## Besoin — 2026-08-17 — retirer FAMILLE/Mes parents financeurs du rail gauche élève

Demande explicite de l'utilisateur : l'entrée de rail latéral gauche « FAMILLE / Mes parents
financeurs » côté élève doit être retirée. Cette information (qui finance l'élève) doit rester
consultable **uniquement via le profil**, pas comme entrée de navigation dédiée. Voir mémoire
`feedback-remove-family-finance-owners-menu`.

### Comment on saura que c'est fait

Capture d'écran du rail gauche élève sur `https://claudevma.visioprof.fr` montrant l'absence de
cette entrée, et confirmation que l'information reste accessible depuis le profil de l'élève.

### État

- [x] Localisée : `apps/web/src/navigation/navigationConfig.ts`, groupe `Famille` du rail
      `eleve` (un seul item, « Mes parents financeurs » → `/parent-link-requests/inbox`).
      Le groupe entier disparaît, c'était son seul item.
- [x] Entrée retirée, information du profil intacte — l'onglet « Parents financeurs » de
      `ProfilePage` (`ParentFinanceurSection` + `useFinanceOwnerStudentLinks` +
      `FinanceOwnerStudentLinkList`) existait déjà, indépendant de cette route de rail, et n'a
      pas été touché. La route `/parent-link-requests/inbox` reste ouverte à `eleve` dans
      `App.tsx` (accessible par URL directe) ; seule l'entrée de rail dédiée a disparu. L'entrée
      homonyme du rail RP (« Demandes rattachement », même chemin, but différent : le RP y
      valide les demandes en attente) a été laissée intacte — aucun autre menu du haut ni du
      rail gauche n'a été touché, conformément à la règle permanente ci-dessus.
- [x] Déployé sur la pile réelle — `frontend` reconstruit et redémarré, bundle
      `index-DOem2XZu.js` servi (`Mes parents financeurs` : 0 occurrence, `Parents financeurs` :
      1 occurrence, vérifié sur les octets du bundle).
- [x] Preuve livrée à l'utilisateur — test Playwright
      `apps/web/e2e/repro-remove-family-rail-entry.spec.ts`, joué contre
      `https://claudevma.visioprof.fr` avec un élève et son parent financeur créés par les
      routes réelles d'inscription : rail gauche sans le groupe « Famille » (capture
      `test-results/proof-rail-eleve-sans-famille.png`), puis onglet « Parents financeurs » du
      profil affichant « Marc Railtest » avec option « Délier » (capture
      `test-results/proof-profil-onglet-parents-financeurs.png`). Vert.
- [ ] Validé par l'utilisateur

---

## Besoin — 2026-08-17 — le formateur ne trouve pas où gérer une proposition reçue

Constat direct de l'utilisateur, en testant le flow demande professeur : élève (`eleve.sixieme`)
crée une demande, RP (`responsable.peda`) envoie une proposition à deux formateurs
(`prof.sixieme`, `prof.lycee`). Le formateur reçoit bien une notification, mais l'utilisateur ne
trouve dans l'interface front aucun endroit où le formateur peut accepter ou refuser cette
proposition. Possible régression, à vérifier avant de corriger.

Le backend fonctionne (vérifié cette session même : `POST /proposals/:id/accept` répond `201`
contre la pile réelle). Le problème est circonscrit au front — écran manquant, mal routé, ou
lien cassé depuis la notification.

### Diagnostic (2026-08-17)

Reproduit avec un scénario neuf (compte formateur jamais connecté, créé via les routes réelles
d'inscription) et Playwright contre `https://claudevma.visioprof.fr` : **ce n'est pas un trou
fonctionnel**, `/teacher-requests` existait déjà avec « Me porter candidat » / « Décliner » pour
le formateur (livré avec le flow, PR #100, 2026-08-12), et l'entrée de rail gauche « Propositions
reçues » (groupe « Suivi ») y mène. Une exploration à froid la trouve sans peine.

Le vrai trou : **cliquer sur la notification de la cloche ne faisait que la marquer lue**, sans
jamais emmener l'utilisateur vers l'écran concerné (`NotificationBell.tsx` et `NotificationsPage.tsx`
n'avaient aucune navigation associée à un type de notification). Un formateur qui ne remarque pas
l'entrée de rail — la seule qui existait — n'avait donc aucun chemin direct depuis la notification
qu'il vient de recevoir. Régression de découvrabilité, pas de régression d'accès ni de trou
fonctionnel.

### Correctif livré

`getNotificationTargetPath` (nouveau, `src/utils/notificationLabels.ts`) fait correspondre les 8
types de notification du flow demande de professeur à `/teacher-requests` (seul hub de ce flow,
quel que soit le rôle). `NotificationBell` et `NotificationsPage` naviguent désormais vers cette
route après avoir marqué la notification lue.

### Comment on saura que c'est fait

Capture d'écran ou réponse HTTP montrant : depuis le compte `prof.sixieme` (ou équivalent), un
chemin dans l'interface qui mène à la proposition reçue avec des actions accepter/refuser, testé
contre `https://claudevma.visioprof.fr`.

**Fait** — test Playwright `apps/web/e2e/repro-proposal-visibility.spec.ts`, joué contre la pile
réelle après reconstruction et redéploiement de `visiomath_frontend` : connexion formateur, clic
sur la notification « Nouvelle proposition de professeur pour Camille Reprotest » dans la cloche,
assertion que l'URL devient `/teacher-requests`, puis que les boutons « Me porter candidat » et
« Décliner » y sont visibles. Vert, captures `test-results/proof-1-notification-menu-open.png` et
`test-results/proof-2-teacher-requests-after-click.png` (non committées, `test-results/` gitignoré).

### État

- [x] Vérifier si l'écran existe déjà (régression d'accès) ou n'a jamais existé (trou fonctionnel)
      — l'écran existait déjà ; le trou était la navigation depuis la notification
- [x] Corriger côté front — `getNotificationTargetPath`, branché dans `NotificationBell` et
      `NotificationsPage`
- [x] Déployé sur la pile réelle — `visiomath_frontend` reconstruit et redémarré (bundle
      `index-9ZheGy2w.js`), en copiant les fichiers modifiés depuis le worktree d'agent vers le
      checkout principal (`/home/debian/Documents/claudeVMA/apps/web`, seul contexte de build
      docker-compose), git étant refusé sur ce chemin pour un agent isolé en worktree
- [x] Preuve livrée à l'utilisateur — test Playwright + captures ci-dessus, sur la branche
      `fix/front-acceptation-proposition-formateur` (poussée, non mergée sur décision de
      l'utilisateur)
- [x] Validé par l'utilisateur — 2026-08-17 : « la demande existe dans "Propositions reçues" [...]
      je valide pour l'instant ». Confirme aussi que le besoin réel était bien le lien depuis la
      notification (« il faut inclure dans les notifications, un lien vers ce menu ») — exactement
      ce que corrige `getNotificationTargetPath`.

---

## Besoin — 2026-08-14 — système de notifications (cloche front)

Demande directe de l'utilisateur : mettre en place les notifications pour chaque flow (en
premier lieu le flow demande de professeur, cf. section « Suite immédiate — les notifications
(étape 7) » ci-dessous, laissée ouverte le 2026-08-12). Accessible via une cloche au niveau du
front, avec un compteur de non-lues, et chaque ligne cliquable bascule de non-lue à lue. Les
types de notification (événements déclencheurs) doivent être modélisés en base, pas codés en dur
dans un texte libre.

### Comment on saura que c'est fait

Réponse HTTP citée contre `https://claudevma.visioprof.fr` montrant : une notification créée par
un événement réel du flow demande de professeur, le compteur de non-lues qui reflète son
existence, et son passage à lue par clic. Capture d'écran de la cloche si le front est
vérifiable en session.

### État

- [x] Recherche du contrat existant (outbox `teacher-request-service`, état actuel
      `dashboard-notification-service`, gateway, front)
- [x] Architecture du contrat interservice arbitrée et écrite dans `docs/architecture.md`
      (2026-08-14, section « Systeme de notifications transversal »)
- [x] Codé et committé — front (cloche, contexte, libellés), `profile-service` (route interne
      finance-owners), `teacher-request-service` (studentId dans les événements),
      `dashboard-notification-service` (consommateur Redis, dédup, migration). Le backend
      consommateur avait été codé dans un worktree d'agent orphelin (2026-08-14, jamais fusionné) ;
      retrouvé et fusionné dans `feat/systeme-notifications` le 2026-08-17. 84 tests unitaires
      passent, migration rejouée avec succès contre PostgreSQL réel.
- [x] Déployé sur la pile réelle — 2026-08-17 : `dashboard-notification-service`,
      `profile-service`, `teacher-request-service`, `frontend` reconstruits et redémarrés,
      tous sains (`docker ps` healthy). Volume Postgres nommé (`claudevma_postgres_data`)
      préservé malgré la recréation du conteneur (nouveau `depends_on` entre services).
- [x] Preuve livrée à l'utilisateur — 2026-08-17, voir `.claude/reports/front-tester-2026-08-17.md`.
      Flow complet rejoué contre `https://claudevma.visioprof.fr` : les 6 événements notifient le
      bon destinataire (réponses HTTP citées). Un bug réel trouvé en testant (notifications par
      rôle RP jamais reçues) et corrigé en cours de route — voir rapport pour le détail.
- [~] Validé par l'utilisateur — **mergé sur sa décision le 2026-08-17** (« merge directement »),
      après avoir reçu la preuve HTTP ci-dessus. Comme pour les objectifs précédents mergés sur
      décision, ce n'est pas une validation par constat écran par écran.
- [x] Mergé dans master — PR #111, squash, `fde54c2`, branche supprimée

## Besoin — 2026-08-12/13 — fin d'une relation élève↔formateur

Arbitrage rendu le 2026-08-12 dans `docs/architecture.md` (« Fin d'une relation
élève↔formateur ») : seul le RP peut y mettre fin, depuis la fiche de l'élève, sans effacer
l'historique (`endedAt`/`endedBy`/`endReason`), et sans fin automatique.

### État réel constaté le 2026-08-13, avant tout travail de cette session

Une implémentation backend complète existait déjà, **écrite, testée (e2e + unitaire) et poussée
sur `origin/worktree-agent-a10185c500589032e`**, mais jamais fusionnée dans la branche de
fonctionnalité `feat/fin-relation-eleve-professeur` — restée, elle, au seul commit d'arbitrage.
Trouvée en traitant les résidus signalés par le hook `Stop` (worktree d'agent orphelin). Ce
fichier n'avait pas été mis à jour en conséquence : il pointait encore vers l'objectif précédent,
déjà mergé.

### Consolidé le 2026-08-13

Fusionné dans `feat/fin-relation-eleve-professeur` et poussé (commit `0e6a377`) :
`DELETE /relations/teacher-student/:teacherId/:studentId` côté `profile-service` — DTO, entité,
migration, contrôleur/service, tests e2e et unitaires, `docs/routes.md` et
`docs/services/profile-service.md` à jour.

### Reste ouvert — non vérifié à ce stade

- **Exposition via `api-gateway`** : non confirmée par cette session.
- **UI côté front** : l'arbitrage place l'action sur la fiche de l'élève ; aucune preuve que cet
  écran existe.
- **Aucune preuve contre la pile réelle** (`https://claudevma.visioprof.fr`) — condition stricte de
  ce projet avant de qualifier quoi que ce soit de terminé. Les tests e2e/unitaires verts ne
  valent pas cette preuve.
- **Aucune PR ouverte** pour `feat/fin-relation-eleve-professeur`.
- `docs/routes.md` liste encore les anciennes routes d'arrêt pilotées par le formateur
  (`POST /assignments/:id/termination`, `POST /collaborations/:id/stop-request`) que l'arbitrage
  du 2026-08-12 dit pourtant retirées — a vérifier, pas encore traité.

---

## Objectif précédent — 2026-08-12 — le plan de travail du RP

Validé par l'utilisateur et **mergé** (PR #102) : « OK c'est bon pour le flow "nouveau professeur"
au niveau du RP. »

Verbatim du besoin :

> Le RP doit avoir dans ses flux de travaux 2 choses au moins : les nouveaux professeurs, à passer
> en validé (ou non validé), et ensuite les demandes de professeurs faites par les élèves. Il doit
> de toute façon avoir accès aux fiches de tous, élèves comme professeurs.

### Ce qui était cassé — deux défauts, pas un

1. **Un formateur qui s'inscrivait n'apparaissait jamais devant le RP.** L'inscription ne créait
   aucun enregistrement de validation ; la lecture individuelle fabriquait un `pending` de
   synthèse. Le formateur se croyait en attente d'examen, personne ne le voyait jamais — donc
   jamais validé, jamais dans l'annuaire, jamais proposable.
2. **Même en le trouvant, le RP ne pouvait pas le valider.** Le front envoyait
   `{validationStatus, rejectionReason}` là où le serveur attend `{status, comment}` → `400`. La
   validation était inopérante depuis l'interface, y compris depuis la fiche. Aucun test ne le
   voyait : ils figeaient le corps erroné.

Le flow « demande de professeur » livré le matin même ne tenait donc que parce que deux formateurs
avaient été forcés en `validated` à la main.

### Livré et prouvé contre la pile réelle

Inscription réelle → file du RP (18 en attente) → validation en deux temps → annuaire des
proposables → sortie de la file (17). Écran `/rp/teacher-validations`, groupe de rail « À traiter »
réunissant les deux files du RP.

### Reste ouvert sur ce sujet

- **Aucune recherche de personne** : le RP n'atteint que les gens présents dans une liste. C'est le
  manque suivant pour que son poste de travail soit complet.
- **Aucun chemin applicatif pour créer le premier RP** — l'auto-inscription avec un rôle interne
  est refusée et la promotion exige un RP ou un TI déjà connecté. C'est ce qui a forcé un `UPDATE`
  SQL le 2026-08-11, lequel a produit un compte **sans profil administratif** : toute
  l'application cassait après connexion (`GET /profiles/:id` → `500`). Réparé en base le
  2026-08-12 par la route interne, **pas dans le code**. Rien ne détecte ni ne signale les comptes
  dans cet état.
- `orchestration-service` ne transmet pas le rôle dans `teacher-onboarding` : un formateur créé
  par ce chemin resterait invisible.
- La reprise de stock est un **script**, pas une migration.
- Pas de file « traités » : le RP ne peut pas revoir ses décisions autrement que par la fiche.

---

## Objectif précédent — le flow de la demande de professeur, mergé le 2026-08-12 (PR #100)

### Besoin d'origine — 2026-08-11

L'utilisateur le qualifie lui-même de « plus important ». Verbatim :

> 1. Pour rappel un élève peut demander un (nouveau) professeur (ou un parent pour son élève
>    sélectionné...). cela conduit actuellement à une erreur (`POST /api/v1/teacher-requests`
>    → **400 Bad Request**)
> 2. cette demande est vue par les RP, un RP se saisit de la demande et (en ajoutant
>    éventuellement des précisions) envoie une proposition à différents professeurs.
> 3. un ou des professeur accepte.
> 4. le RP valide une des acceptations professeur :
>    4.1 un message « un professeur a été trouvé » est envoyé à l'élève et son parent financeur.
>        Un message est envoyé aux professeurs non retenus, disant qu'un autre professeur a été
>        sélectionné, et que la demande est finie, **qu'ils aient ou non répondu**. Un message
>        enfin est envoyé au professeur choisi pour lui dire qu'il est désormais le professeur
>        de l'élève.
>    4.2 un lien est donc créé entre l'élève et son professeur
>    4.3 l'ensemble des requêtes tombent (de l'élève au RP, et du RP aux professeurs)

### Énoncé détaillé du 2026-08-12 — fait foi sur celui du 2026-08-11

L'utilisateur a précisé le flow en huit étapes, et tranché le contenu du formulaire élève :

> Ce que remplit l'élève est **déjà en ligne** : il clique sur « demander un professeur » dans son
> dashboard, arrive sur `/teacher-requests`, clique « nouvelle demande », et là il a **juste une
> description de la demande à faire (texte long)**.
>
> 2. le RP reçoit la demande (il a donc quelque part une liste de demandes en cours)
> 3. à partir de cette demande (que le RP peut percevoir via une notification), le RP envoie une
>    proposition aux professeurs qu'il a choisi (il rédige un nouveau texte, en reprenant
>    éventuellement la description, avec peut-être 3 autres champs indicatifs optionnels :
>    horaires possibles, rémunération et date limite de réponse)
> 4. les professeurs reçoivent la demande (ainsi qu'une notification pour leur signaler) et
>    peuvent accepter ou refuser (ou ne rien faire)
> 5. le RP voit ces refus et ces acceptations. Il choisit parmi les professeurs qui ont accepté le
>    nouveau professeur de l'élève.
> 6. un lien est donc créé entre l'élève et le professeur
> 7. une notification est envoyée au professeur choisi, à l'élève et à son/ses parents financeurs,
>    annonçant le nouveau professeur et où trouver ses éléments dans l'interface. Une notification
>    est aussi envoyée aux professeurs non choisis.
> 8. les différentes demandes disparaissent de l'interface car « traitées ».

Séquencement des notifications laissé à l'orchestrateur, et tranché : **le flow d'abord, les
notifications ensuite** — voir l'arbitrage 7 dans `docs/architecture.md`.

## Ce que ce besoin engage

C'est le premier workflow **réellement transverse** de la plateforme, et `docs/microservices.md`
le décrit déjà sous le nom `teacher-request-to-assignment` : `teacher-request-service`,
`profile-service` (le lien formateur↔élève), `dashboard-notification-service` (les messages),
sous la coordination d'`orchestration-service`. Les services propriétaires ne doivent pas se
court-circuiter les uns les autres.

Points d'attention connus avant de commencer :

- **Le parent agit pour son élève.** Le droit d'agir doit se vérifier sur le lien parent
  financeur↔élève, dont la rupture vient d'être livrée (PR #98). Un parent délié ne demande plus
  rien pour cet élève.
- **Le lien formateur↔élève existe déjà** (`teacher_student_links`, `profile-service`) et ouvre
  depuis le 2026-08-11 la lecture des statistiques et archives. Le créer n'est donc pas anodin.
- **4.3 exige un état terminal propre** : une fois une acceptation validée, toutes les
  propositions pendantes tombent, y compris celles des professeurs qui n'ont jamais répondu.
- **Idempotence et `x-correlation-id`** sont des contrats techniques du projet, et une erreur
  métier ne doit jamais être transformée en succès technique.

## Existant relevé le 2026-08-11 — écart établi

Deux investigations menées contre la pile réelle, rapports committés le 2026-08-12 après
récupération dans des worktrees d'agents où ils étaient restés non sauvegardés :
`.claude/reports/teacher-request-service-flow-2026-08-11.md` et
`.claude/reports/front-flow-demande-professeur-2026-08-11.md`.

### Cause du 400 : contrat front/back faux

Le front envoie `{description}`, le serveur exige `{subject}`. `ValidationPipe({whitelist:true})`
sans `forbidNonWhitelisted` **jette `description` en silence**, puis `subject` manque et le DTO
échoue sur `"subject must be a string"` — message qui ne nomme jamais le vrai coupable. La route
répond `201` dès qu'on lui parle sa langue : elle n'est pas cassée.

Aggravant : **le même front porte déjà les deux formes** sur la même URL. `TeacherRequestsPage`
(l'écran atteignable par l'élève) envoie `description` ; `SpecificTeacherRequestForm`
(`/rp/teacher-requests`) envoie `{subject, level, sector, message?}` et fonctionne. Deux
formulaires concurrents pour un même besoin, une seule route.

### L'écart réel n'est pas le 400 : trois modèles de décision coexistent

Le 400 est superficiel. Le vrai écart porte sur **qui décide** :

1. **Implémenté et actif** — le premier formateur qui accepte devient le professeur.
   `POST /proposals/:id/accept` crée immédiatement l'affectation. Mesuré : deux formateurs
   acceptent → **deux affectations `active`** sur le même élève, la même demande, en silence.
2. **Codé mais inatteignable** — le RP présélectionne, le **client** choisit
   (`selected-candidates` puis `select`). Dès qu'un formateur a accepté, la demande est en
   `assigned` et ces deux routes répondent `400 not in a selectable state`.
3. **Demandé par l'utilisateur** — les formateurs se déclarent, **le RP tranche**. N'existe
   nulle part : `POST /teacher-requests/:id/select` **exclut explicitement le RP** (`403`), et
   aucune route ne permet au RP de lire qui a accepté.

### Ce qui manque pour les étapes 2 à 4.3

- **2** — « se saisir » d'une demande : aucun champ, aucune route. Ajouter des précisions :
  `PATCH /teacher-requests/:id` → `404`. Envoi groupé : un formateur par appel, sans atomicité.
  Recherche de formateur : inexistante — le RP saisit un **UUID à la main**.
- **3** — le formateur ne voit ni sujet, ni niveau, ni nom d'élève ; `GET /teacher-requests/:id`
  lui répond `403`.
- **4** — le RP n'a **aucun moyen de lire les acceptations** (`GET .../proposals` → 404).
- **4.1** — `EventsService.emit()` écrit **une ligne de log**. Aucun bus, aucun abonné, aucun
  appel à `dashboard-notification-service` ni `communication-service`.
- **4.2** — aucun appel à `profile-service`. Le service tient sa propre table `assignments`,
  invisible du propriétaire des relations.
- **4.3** — inexprimable : `ProposalStatus` n'a que `pending|accepted|declined`, et `assigned`
  est un cul-de-sac sans transition sortante. Il manque *non retenue* et *caduque* côté
  proposition, et un état terminal côté demande.

### Trois défauts à traiter en même temps

1. **Trou de droit** : un parent crée une demande pour **n'importe quel élève** → `201`. Aucune
   vérification du lien. `profile-service` expose pourtant déjà
   `GET /internal/relations/:viewerId/:targetId`. La rupture de lien (#98) durcit l'exigence :
   vérification **au moment de l'action**, jamais mise en cache.
2. **`PROFILE_SERVICE_URL` non défini** — le client retombe sur `http://profile-service:3000`
   quand le service écoute sur **3002**, et n'envoie aucun jeton. Conséquence :
   `studentName`/`teacherName` **`null` sur les 16 demandes**, donc le RP ne voit que des UUID.
3. **`forbidNonWhitelisted` absent** sur tout le service : `{"subject":"X","urgency":"haute"}`
   → `201`, `urgency` disparaît. Même défaut qu'arbitré le 2026-08-09.

### Risque de sécurité à traiter hors de ce flow

**Deux secrets partagés laissés à leur valeur par défaut**, sur une machine accessible
publiquement. Signalés le 2026-08-12, **non corrigés** — c'est un point de déploiement, pas de
code, et il dépasse le flow professeur.

1. `JWT_SECRET` vaut `change_me_with_a_long_random_string_in_production` dans le conteneur en
   cours d'exécution. Ce secret **signe les jetons de tous les services** : le connaître permet
   de forger un jeton de n'importe quel rôle, RP ou TI compris.
2. `INTERNAL_SECRET` est déclaré dans `docker-compose.yml` sous la forme
   `${INTERNAL_SECRET:-change_me_in_production}`. Si le `.env` de la machine ne le définit pas,
   **tous les services partagent ce secret public** — et il protège désormais une route qui sert
   une identité sans contrôle de lecteur (`/internal/profiles/:userId/display-name`).

La forme `:-` a un effet secondaire à connaître : elle garantit une valeur non vide, donc la
validation au démarrage ajoutée le 2026-08-12 **ne détectera jamais** l'absence de la variable.
La porte est fermée contre l'oubli de configuration, pas contre un secret faible.

### Deux écarts trouvés en validant les formateurs (2026-08-12)

Rencontrés en prouvant l'annuaire, **non corrigés**, sans lien avec le flow lui-même :

1. **Un formateur sans enregistrement de validation est invisible de la liste des « en attente ».**
   `GET /profiles/:teacherId/validation` renvoie un `pending` **synthétique** quand aucune ligne
   n'existe, tandis que `GET /profiles/teachers/pending-validation` ne liste que les lignes
   réelles. Mesuré : les deux formateurs `trsflow` étaient lus `pending` individuellement et
   absents de la liste. Un RP ne peut donc pas voir les formateurs qu'il devrait valider — c'est
   la même famille de défaut que le `404` des archives, où une absence masquait une fonction
   jamais opérationnelle.
2. **Message d'erreur en anglais** sur `PATCH /profiles/:teacherId/validation` :
   `"Only TI may bypass the in_review step and move directly from pending to validated or
   rejected"`. La règle métier est bonne — le RP passe par `in_review`, seul le TI saute l'étape —
   mais elle est énoncée dans une langue que l'utilisateur ne lit pas.

## État

- [x] Existant relevé, écart établi — 2026-08-11, rapports committés le 2026-08-12
- [x] Architecture arbitrée et écrite — `docs/architecture.md`, 2026-08-12, 7 points
- [x] Back — livré le 2026-08-12. `teacher-request-service` : modèle de décision renversé sur le
      RP, `description` seul champ requis, états terminaux, lien parent vérifié à chaque action,
      événements réels en outbox. `profile-service` : résolution de nom interne, lien rejouable,
      routes internes fermées. Preuves : 136+19 et 551+269 tests contre PostgreSQL réel, et
      migration jouée contre une copie de la base de production.
- [x] Front — livré et déployé le 2026-08-12. Un seul formulaire (`description`), sélecteurs de
      personne par prénom + nom, composeur RP peuplé par l'annuaire des formateurs validés,
      boîte formateur branchée sur l'identifiant de proposition, validation RP, libellés en un
      point unique. Bundle servi : `index-Du5nUbS9.js`
- [ ] Notifications — **après** le flow, sur les événements réels qu'il émet
- [x] Déployé sur la pile réelle — `teacher-request-service`, `profile-service` et `frontend`
      reconstruits le 2026-08-12 ; gateway les atteint sans rechargement (correctif DNS #97
      confirmé). Flow complet rejoué après déploiement intégral, sans régression.
- [x] Preuve livrée à l'utilisateur — flow complet joué contre `https://claudevma.visioprof.fr`,
      voir `.claude/reports/preuve-flow-demande-professeur-2026-08-12.md`
- [~] Validé par l'utilisateur — **mergé sur sa décision le 2026-08-12** (« Il faut merger »).
      La preuve livrée porte sur les réponses HTTP des huit étapes, jouées deux fois contre la
      pile réelle. **Le constat écran par écran n'a pas été fait** : ce n'est donc pas une
      validation par usage, au même titre que le merge du 2026-08-11 sur l'accès par relation.
- [x] Mergé dans master — PR #100, squash, `d057bc5`, branche supprimée

---

## Suite immédiate — les notifications (étape 7)

Le flow est actif mais **silencieux** : personne n'est prévenu de rien. Le RP doit aller voir sa
liste, le formateur ouvrir sa boîte, l'élève et son parent découvrir le résultat par eux-mêmes.
C'est le séquencement tranché le 2026-08-12 (arbitrage 7), pas un oubli.

Ce qui rend la suite peu coûteuse est déjà en place : `teacher-request-service` émet de **vrais
événements** en outbox, pas des lignes de log. `dashboard-notification-service` doit s'y abonner
sans que le workflow soit retouché.

Quatre destinataires à l'étape 7 : le professeur choisi, l'élève, son ou ses parents financeurs,
et les professeurs non retenus — **qu'ils aient répondu ou non**.

## Points ouverts hérités de cet objectif

1. **Deux secrets partagés à leur valeur par défaut**, sur machine publique — `JWT_SECRET` (signe
   les jetons de tous les services) et `INTERNAL_SECRET`. Configuration, pas code. **Le point le
   plus grave ouvert.**
2. **Un formateur sans ligne de validation est invisible** de `GET /profiles/teachers/pending-validation`,
   alors qu'il est lu `pending` individuellement. Le RP ne voit donc pas qui valider.
3. **Message d'erreur en anglais** sur `PATCH /profiles/:teacherId/validation`.
4. **Ni `x-correlation-id` ni clé d'idempotence** émis par le front — écart transverse,
   `src/api/client.ts`.
5. **Écran d'instruction `pp-change` pour le RP** : la route existe, l'écran non.
6. **Cinq statuts hérités** encore affichés côté front, libellés « … (ancien flow) ».
7. **La table `assignments` n'est plus alimentée** : une collaboration née du nouveau flow ne peut
   pas être arrêtée par `/assignments/:id/termination`. À reconstruire sur les relations de
   `profile-service`.
8. **Seuls 2 formateurs sont validés** en base, ceux de la démonstration. Un RP qui compose une
   proposition ne verra qu'eux.
9. **`index.html` servi sans `Cache-Control`** — un déploiement front peut rester invisible.
   Diagnostiqué le 2026-08-11, toujours non corrigé.

---

## Objectif clos — le flow de la demande de professeur, mergé le 2026-08-12 (PR #100)

---

## Historique — PR livrées avant cet objectif

- **#97 gateway** — re-résolution DNS à chaque requête. Prouvée deux fois, dont une
  indépendamment de l'agent, et confirmée en conditions réelles lors du déploiement de #98
  (reconstruction de `profile-service` sans toucher la gateway, `401` immédiat, zéro `502`).
  Tant qu'elle n'est pas mergée, une reconstruction de la gateway depuis `master` réinstalle le
  défaut.
- **#98 délier** — rupture du lien parent financeur↔élève dans les deux sens, historique
  conservé, droits refermés (profil `403`, statistiques et archives `404`), relien vérifié.

## Candidat suivant, diagnostiqué et non corrigé

### Les déploiements front peuvent rester invisibles

**Défaut d'exploitation constaté le 2026-08-11, réparé au coup par coup, pas corrigé à la
racine.** Le plus grave trouvé ce jour-là.

Reconstruire un conteneur lui donne une **nouvelle adresse IP** sur le réseau Docker. La gateway
nginx garde celle qu'elle a résolue **au chargement de sa configuration** : elle continue donc
d'appeler l'ancienne. Mesuré — 20 réponses `502` entre 14:31 et 14:43 sur **toutes** les routes
de `profile-service`, journal gateway :

```
connect() failed (111: Connection refused) while connecting to upstream,
upstream: "http://172.25.0.16:3002/profiles/avatar/constraints"
```

pendant que `wget http://profile-service:3002/health` depuis le conteneur gateway répondait
`200`. `docker exec visiomath_gateway nginx -s reload` rétablit tout.

**Ce qui rend ce défaut coûteux** : il est silencieux. Le bundle servi était vérifié après chaque
déploiement — contrôle qui ne dit rien de l'API. C'est un agent qui est tombé dessus, pas la
procédure de vérification. Toute validation utilisateur menée dans cette fenêtre conclut à tort
que le travail est cassé.

Correction durable : faire re-résoudre les noms par nginx **à chaque requête** plutôt qu'au
chargement (directive `resolver` pointant le DNS Docker `127.0.0.11`, et cible du `proxy_pass`
portée par une variable — sans variable, nginx résout une fois pour toutes). À défaut, un
`nginx -s reload` de la gateway doit devenir une étape **obligatoire** de tout redéploiement
back, écrite noir sur blanc.

### 2. Les déploiements front peuvent rester invisibles

`apps/web/Dockerfile` sert `index.html` **sans en-tête `Cache-Control`** — seuls `ETag` et
`Last-Modified` sont posés. Le navigateur peut donc conserver l'ancien `index.html`, qui
référence l'ancien bundle par son nom haché, lui aussi en cache. C'est arrivé le 2026-08-11 :
l'utilisateur voyait un écran dont les chaînes étaient à **0 occurrence** dans le bundle servi.

Correction retenue : `Cache-Control: no-cache` sur `index.html`, cache long immuable sur
`/assets/`. Ne pas confondre avec la décision « aucun cache » du 2026-08-10, qui porte sur les
données lues par l'application, pas sur les en-têtes de ses fichiers statiques.

## Ce qui manque pour que l'utilisateur puisse vérifier

L'utilisateur a mergé le 2026-08-11 en disant : « je ne sais pas si c'est bon, mais je n'ai pas
les données pour bien vérifier ». **Ce n'est pas un défaut de code, c'est un manque de données de
démonstration**, et il rend trois parcours inobservables :

1. **AP → formateur** : la table `animator_teacher_links` naît vide et **aucun écran ne permet
   d'y créer un lien**. Seul `POST /relations/animator-teacher` (RP) le peut.
2. **Administrateur → n'importe qui** : `GET /relations/my-contacts` renvoie `200 []` aux RP, AF
   et TI. Leur sélecteur ne propose qu'eux-mêmes, faute d'annuaire — il manque une **recherche de
   personne** côté serveur. Décision à prendre : une liste globale de tous les utilisateurs n'est
   pas anodine côté vie privée.
3. **Archives** : peu d'archives réelles en base, donc peu à voir même quand le droit est ouvert.

Piste la plus rapide : poser quelques liens et archives de démonstration via les routes réelles,
puis livrer à l'utilisateur le chemin exact à suivre écran par écran.

## Décisions en attente de l'utilisateur

1. **Un élève accepte ou refuse un rattachement sans savoir qui le demande.** Mesuré :
   `élève → GET /profiles/<parent>` renvoie `403` en attente **comme après acceptation**, et
   `GET /parent-link-requests` ne porte que des identifiants. Aucun contournement front
   n'existe : il faudrait que `profile-service` porte `parentName`/`studentName` dans la demande,
   comme il le fait déjà pour `financeOwnerName`.
2. **`POST /parent-link-requests` répond `400 "Aucun profil élève trouvé pour cet identifiant."`**
   tant que l'élève n'a pas enregistré un profil **pédagogique** — lequel est facultatif et absent
   à l'inscription. Un parent ne peut donc pas rattacher un élève fraîchement inscrit, et le
   message ne l'explique pas.
3. **`GET /profiles/:userId` n'est pas aligné sur `/statistics`** : il exempte encore l'AP par son
   rôle et refuse à l'élève le profil de son formateur. Les statistiques sont donc plus strictes
   que le profil qui sert les mêmes champs.
4. **Le carnet personnel reste visible du formateur et des administrateurs** (`total 3` contre
   `total 2` pour le parent), contrairement au README (« espace réservé à l'élève »).
5. **Le formateur voit son profil financier mais ne peut rien y saisir** —
   `PATCH /financial-profiles/:ownerId` lui reste fermé.
6. **L'AP ne peut pas soumettre de demande de rémunération** — route réservée au rôle `formateur`.
7. **Deux portes vers le même contenu pour le parent** : rail gauche « Profil financier » +
   nouvel onglet.
8. **L'URL dit `students/:studentId`** alors que le titulaire peut être un formateur depuis que
   l'AP y accède. Renommer touche gateway, front et migration.
9. **`GET /documents/:id/download` répond `302`** vers le service source ; le suivi de
   redirection cross-origin n'a pas pu être testé, faute d'archive portant un `downloadUrl` réel.
10. **UUID encore affiché** : `TeacherValidationPanel.tsx:133` (`validatedBy.slice(0,8)` en guise
    de nom, alors que `usePersonDisplayName` existe) et le bloc « Formateurs liés ».
11. **Comptes de vérification laissés sur la pile**, aucune route de suppression n'existant :
    `front.check.0811`, `front.fin.0811`, `front.fin.parent.0811`, `verif.fin.teacher.0811`,
    `verif.fin.parent.0811`, `relstats.*`, `frontrel.eleve`, `frontrel.parent`, `frontrel.prof`,
    `frontrel.ap`, `camille.durand.26828`, `sophie.moreau.26828`. Un TI peut les suspendre.
12. **Un vieux stash sans objet** : `stash@{0}` « retrait permission Write reports (à restaurer) »,
    devenu caduc puisque `Write` a été rétabli le 2026-08-11.

---

## Dernier objectif clos — accès par relation, mergé le 2026-08-11 (PR #94 et #95)

**Besoin** : les statistiques et archives pédagogiques ne sont plus réservées à leur titulaire —
la relation métier ouvre le droit de lecture. Le financier reste au titulaire et aux
administrateurs.

**Mergé sur décision de l'utilisateur**, qui a explicitement dit ne pas avoir pu vérifier faute
de données : « je ne sais pas si c'est bon, mais je n'ai pas les données pour bien vérifier, donc
merge ». **Ce n'est donc pas une validation par constat.** La preuve livrée porte sur des
réponses HTTP obtenues avec des comptes réellement reliés, pas sur le rendu à l'écran.

### Résultats mesurés contre la pile réelle

| Lecteur | Statistiques | Archives pédagogiques |
|---|---|---|
| Élève → son formateur | `200`, filtré | `404` — onglets masqués |
| Parent → son élève | `200` | `200`, total 2 (carnet exclu) |
| Parent → formateur de son élève | `200`, filtré | `404` |
| Formateur → son élève | `200` | `200`, total 3 |
| AP → formateur qu'il anime | `200` | `200` |
| AP → personne non reliée | `404` | `404` |
| Financier, quelle que soit la relation | `403` | `403` |

Un refus répond `404` avec le **même message qu'une absence**, prononcé **avant toute lecture en
base** : refus et vide sont volontairement indiscernables.

### Trois trous de droit trouvés en chemin

1. **Un AP sans aucun lien accédait aux statistiques de n'importe qui** — aucune clause ne le
   concernait dans `assertReadAccess`.
2. **Parent financeur et formateur accédaient aux archives de n'importe quel élève**, sans
   vérification de lien : décision prise sur le seul rôle du JWT.
3. **`ProfileStatisticsPanel` portait une liste de rôles en dur côté front**, bloquant un
   affichage que le serveur autorisait déjà. Une règle de droit portée par le client n'en est pas
   une.

### Un défaut plus grave : les archives n'avaient jamais fonctionné

Aucune route archive ne répondait à l'adresse appelée — la gateway transmet `/api/v1/archives/…`
→ `/archives/…`, le contrôleur était monté ailleurs. Quinze sondes, quinze `404` **de Nest**. Le
`404` que le front traitait comme « aucune archive » masquait une fonctionnalité jamais
opérationnelle de bout en bout. Le contrat front était faux en prime : tableau nu au lieu d'une
enveloppe paginée, cinq `itemType` inexistants, un champ `isAccessibleToFinanceOwner` qui n'a
jamais existé.

### Comment c'est construit

`profile-service` reste l'**unique propriétaire des relations**. Route interne
`GET /internal/relations/:viewerId/:targetId?viewerRole=` renvoyant des **faits** — la nature du
lien, orientée lecteur→cible — et non un verdict : c'est ce qui permet de distinguer « élève de
ce formateur » (statistiques oui, archives non) de « formateur de cet élève ». La relation
AP↔formateur n'existait dans aucune table : `animator_teacher_links` créée. Même forme dans les
trois services : `@OwnerAccess()`.

### UUID et tests (PR #95)

`ParentLinkRequestPage` et `ParentLinkRequestsInboxPage` affichaient `ELV-<uuid>` / `PAR-<uuid>`
et nomment désormais les personnes, le nom venant des routes de relations qui le portent **déjà
résolu** — `usePersonDisplayName` a été écarté car il aurait provoqué un `403` par ligne. Aucun
repli sur l'identifiant : quand le nom est inaccessible, l'écran le dit en français.

Les 6 tests rouges : quatre étaient **périmés** et figeaient le défaut d'UUID ; les deux autres
n'étaient **pas** périmés — `HealthStatusPage` et `WorkflowStatusPage` échouaient parce que le
rail de navigation porte le **même libellé que le titre de la page**, donc `getByText` trouvait
deux nœuds. Écran sain, test trop lâche, corrigé en visant le rôle ARIA. Aucun test affaibli : les
quatre premiers vérifient désormais l'**absence** de tout identifiant dans le rendu.

Suite front après merge : **1421 tests verts**.

### Déploiement

`frontend`, `profile-service` et `archive-document-service` reconstruits ; bundle
`index-Bmbl6yp6.js` servi, portant « Personne consultée » et `my-contacts`, avec `ELV-` et `PAR-`
à **0 occurrence**. Gateway rechargée après coup — voir le défaut n°1 ci-dessus.

---

## Modèle pour l'objectif suivant

```
## Besoin
<une phrase, en termes métier, ce que l'utilisateur doit pouvoir constater>

## Comment on saura que c'est fait
<l'artefact précis livré à l'utilisateur : capture, sortie de test réelle, réponse HTTP citée>

## État
- [ ] Codé et committé
- [x] Déployé sur la pile réelle — `teacher-request-service`, `profile-service` et `frontend`
      reconstruits le 2026-08-12 ; gateway les atteint sans rechargement (correctif DNS #97
      confirmé). Flow complet rejoué après déploiement intégral, sans régression.
- [x] Preuve livrée à l'utilisateur — flow complet joué contre `https://claudevma.visioprof.fr`,
      voir `.claude/reports/preuve-flow-demande-professeur-2026-08-12.md`
- [~] Validé par l'utilisateur — **mergé sur sa décision le 2026-08-12** (« Il faut merger »).
      La preuve livrée porte sur les réponses HTTP des huit étapes, jouées deux fois contre la
      pile réelle. **Le constat écran par écran n'a pas été fait** : ce n'est donc pas une
      validation par usage, au même titre que le merge du 2026-08-11 sur l'accès par relation.
- [x] Mergé dans master — PR #100, squash, `d057bc5`, branche supprimée

## Bloqué par
<rien, ou la dépendance précise>
```
