# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin — 2026-08-18 — calendrier de disponibilités lié à la visio

Demande explicite de l'utilisateur, 4 points, planifiée via `/plan` puis approuvée avec 3
précisions. Plan complet : `/home/debian/.claude/plans/ok-il-faut-passer-structured-cherny.md`
(contexte, état du code réel vérifié par exploration, approche point par point, décisions
d'architecture tranchées avec l'utilisateur, fichiers critiques, vérification attendue).

1. Élèves et formateurs éditent leurs créneaux de disponibilité/indisponibilité (créer,
   redimensionner, supprimer), récurrence hebdomadaire jusqu'à une date de fin.
2. Calendrier d'un tiers lié visible en busy/free uniquement (jamais le contenu, sauf si
   directement concerné) : élève ← parents financeurs + professeurs actifs + RP (tous) ;
   professeur ← élève/parent liés + AP liés + RP (tous).
3. Un professeur propose un créneau de cours à son élève (accepte/refuse) ; RP/AP proposent des
   créneaux aux professeurs (RP : tous : AP : ceux qu'il anime).
4. Le créneau accepté doit ouvrir une visio — **LiveKit auto-hébergé retenu** (portable vers une
   autre machine plus tard, connexion par config uniquement, jamais un nom de service Docker en
   dur — précision de l'utilisateur, approuvée).

Précisions de l'utilisateur à l'approbation (2026-08-18) :
- Tests unitaires obligatoires sur tout nouveau développement (règle déjà en vigueur), mais
  validation finale toujours par test personnel de l'utilisateur ou preuve/captures fournies —
  les tests verts seuls ne suffisent jamais.
- Bouton "Supprimer" une activité (actuellement mort, route jamais existée) : la route est
  ajoutée, pas le bouton retiré.

Ordre de livraison retenu, une branche par étape :
1. `feat/calendrier-disponibilites` — CRUD créneaux + récurrence (point 1)
2. `feat/calendrier-visibilite-relation` — busy/free par relation (point 2)
3. `feat/calendrier-proposition-creneau` — proposer/accepter/refuser (point 3) + assainissement
   `api/calendar.ts` + route DELETE activité
4. Intégration LiveKit (point 4)

### État

- [x] Exploration (2 agents) + conception (1 agent Plan) — état du code réel établi, plan écrit
- [x] Plan approuvé par l'utilisateur, avec 3 précisions (ci-dessus)
- [x] Point 1 — CRUD disponibilités + récurrence. Backend : mécanisme de migrations créé (absent
      jusqu'ici), entité étendue (`recurrenceEndDate`, `kind`), 3 routes CRUD, bug `@Roles` corrigé
      (AP retiré, **ELEVE ajouté** — élève bloqué en 403 avant même ce chantier), fonction pure
      `expandSlotToOccurrences`. 121 tests unitaires + 49 e2e, migration vérifiée réellement
      (up/down/re-run + comparaison schéma réel). Front : onglet "Mes disponibilités" dans
      `/calendar`, grille Tailwind faite main (clic-cellule/clic-bloc), `date-fns`, 55 tests.
      Déployé sur la pile réelle, routes confirmées mappées au démarrage du service. **Preuve HTTP
      obtenue par l'orchestrateur** contre `https://claudevma.visioprof.fr` (compte élève réel) :
      `POST` créneau récurrent avec date de fin → `201` ; `PATCH` redimensionnement → `200` ;
      `PATCH recurrenceEndDate:null` (repasse en illimité) → `200` ; `GET` reflète les changements ;
      `DELETE` → `204` ; `GET` confirme la disparition. **Preuve à l'écran obtenue** : 2 bugs réels
      trouvés et corrigés en route par `front-tester`/`front-developper` (route de lecture
      inexistante ; formulaire envoyant heure seule + enums majuscules au lieu du format ISO/
      minuscules exigé par le serveur) — ni contournés ni masqués. Test e2e
      `apps/web/e2e/proof-calendar-disponibilites.spec.ts` rejoué avec succès contre la pile réelle
      (création, redimensionnement, suppression, capture envoyée à l'utilisateur). **Validé par
      l'utilisateur (« ok, continue ») et mergé dans master — PR #123, squash `0dec9eb`, branche
      supprimée. `calendar-service` et `frontend` redéployés depuis `master` (état durable), sains,
      gateway rechargée. 3 branches distantes zombies nettoyées au passage (contenu déjà mergé via
      PR #120, jamais supprimées de `origin` — seules les copies locales l'avaient été) :
      `docs/investigation-confidentialite-consentements`, `fix/front-visibilite-defauts-role`,
      `fix/profile-service-visibilite-defauts-role`.**
- [x] Point 2 — visibilité busy/free par relation. Backend + front livrés (239+26 tests, puis
      +182/+70 e2e après correctif). Bug réel trouvé par l'orchestrateur en HTTP contre la pile
      réelle (titulaire n'ayant jamais ouvert son calendrier bloquait tout le monde, `ownerRole`
      dépendait d'une ligne `Calendar` créée paresseusement) — corrigé via un nouveau
      `IdentityAccessClient` qui résout le rôle indépendamment de toute lecture préalable.
      **Preuve HTTP complète obtenue par l'orchestrateur** contre `https://claudevma.visioprof.fr`,
      comptes neufs (élève+parent liés via inscription, formateur, tiers), relation
      élève↔formateur posée via la route interne, **aucun appel préalable à `GET /calendars/:id`** :
      parent lié → élève jamais ouvert : `200` ; formateur lié → élève : `200` ; élève → son
      formateur jamais ouvert : `200` ; parent → formateur de son enfant (relation indirecte) :
      `200` ; tiers non lié → élève : `403` ; tiers non lié → formateur : `403`. Contenu vérifié :
      un créneau créé par l'élève apparaît dans `availableWindows` du parent **sans aucun autre
      détail** (pas d'id, titre, participants). **Pas de preuve écran** — le composant
      `LinkedCalendarView` n'a volontairement aucun point de montage dans la navigation, prévu avec
      le point 3 (intégré au flux de proposition de créneau). En attente de validation utilisateur
      avant merge (préciser si la preuve écran doit attendre le point 3 ou être montée
      temporairement maintenant).
      Branche `feat/calendrier-visibilite-relation`, prête à merger.
- [ ] Point 3 — proposition/acceptation de créneau
- [ ] Point 4 — intégration LiveKit
- [ ] Preuve livrée à l'utilisateur pour chaque point
- [ ] Validé par l'utilisateur

---

## Besoin — 2026-08-18 — le parent financeur doit être notifié de la demande de son élève

Demande explicite de l'utilisateur, immédiatement après validation et merge du sujet précédent
(visibilité champ par champ / consentements, ci-dessous, clos). Le parent financeur d'un élève qui
crée une demande de professeur doit recevoir **deux notifications** :
1. Que son élève **a fait une demande** de professeur.
2. Qu'**un professeur a été trouvé** pour cette demande.

Rappel de l'arbitrage déjà rendu le 2026-08-14 sur le système de notifications
(`docs/architecture.md`, point 8 « Recipients par événement ») :
- `TeacherRequestCreated` → **rôle RP uniquement** aujourd'hui. **Le parent financeur n'y figure
  pas** — c'est le trou à combler pour le point 1 ci-dessus.
- `TeacherAssigned` → déjà documenté comme notifiant **le formateur choisi, l'élève, et le ou les
  parents financeurs** — donc le point 2 ci-dessus est censé être **déjà couvert**. À vérifier
  contre la pile réelle avant de considérer ce point acquis (le point 8 était une décision
  d'architecture, pas forcément revérifié en usage réel pour le destinataire parent
  spécifiquement).

Piste connue : `dashboard-notification-service` résout déjà les parents financeurs d'un élève via
la route interne `GET /internal/relations/finance-owners/:studentId`
(`profile-service`), utilisée pour `TeacherAssigned`. Le même mécanisme devrait suffire à ajouter
les parents financeurs comme destinataires de `TeacherRequestCreated`, sans changement de contrat
sur `teacher-request-service` si `studentId` est déjà présent dans le payload de cet événement (à
vérifier — trois autres événements en manquaient, corrigés le 2026-08-14, `TeacherRequestCreated`
n'était pas dans cette liste donc probablement déjà bon, mais à confirmer, pas supposer).

### Comment on saura que c'est fait

Réponse HTTP citée (ou capture de la cloche de notification) contre `https://claudevma.visioprof.fr`
montrant qu'un parent financeur reçoit bien une notification à la création de la demande de son
élève, et une seconde à l'affectation d'un professeur.

### État

- [x] Investigation — `studentId` était déjà présent dans le payload `TeacherRequestCreated`,
      aucun changement requis côté `teacher-request-service`. Le helper
      `ProfileServiceClient.getFinanceOwners` était déjà réutilisable (partagé par
      `handleTeacherAssigned`/`handleMainTeacherAssigned`/`handleTeacherRequestStatusUpdated`),
      aucune logique dupliquée.
- [x] `TeacherAssigned` → parent financeur : re-vérifié par `dashboard-notification-service`
      (événement réel publié sur le flux Redis), fonctionnait déjà correctement, rien changé.
- [x] `TeacherRequestCreated` → parent financeur ajouté comme destinataire, **en plus** du rôle
      RP existant (jamais à la place). Commit `7b31c1c`
      (`feat/notif-parent-demande-professeur`, poussé). 96/96 tests unitaires verts.
- [x] Libellé front vérifié — `teacher_request_created` : « Nouvelle demande de professeur pour
      {élève} », déjà neutre, fonctionne tel quel pour un parent. **Point ouvert, non bloquant** :
      à reformuler explicitement pour un parent (« votre enfant a demandé... ») seulement si
      l'utilisateur le souhaite — décision produit, pas un défaut.
- [x] Déployé sur la pile réelle — `dashboard-notification-service` reconstruit et redéployé
      depuis `feat/notif-parent-demande-professeur`, sain, gateway rechargée.
- [x] Preuve livrée à l'utilisateur — **preuve HTTP obtenue directement par l'orchestrateur**
      (pas seulement par le sous-agent), élève + parent financeur créés et liés via
      `POST /accounts/students` (`parentAccountMode: "new"`) : `unread-count` du parent passe de
      `{"count":0}` à `{"count":1}` après `POST /teacher-requests` par l'élève ;
      `GET /notifications` du parent montre `{"type":"teacher_request_created",
      "metadata":{"studentName":"NotifP Eleve", ...}}`. Réponses citées ci-dessous.
- [x] Validé par l'utilisateur — 2026-08-18 (« ok merge »)
- [x] Mergé dans master — PR #121, squash `49b80d0`, branche supprimée. `dashboard-notification-service`
      reconstruit et redéployé depuis `master` (état durable), sain, gateway rechargée.

#### Preuve HTTP citée (2026-08-18, contre `https://claudevma.visioprof.fr`, orchestrateur)

```
GET /notifications/unread-count (parent, avant)  → 200 {"count":0}
POST /teacher-requests (élève, description libre) → 201 {id, studentId, status:"pending", ...}
GET /notifications/unread-count (parent, après)  → 200 {"count":1}
GET /notifications (parent) → 200 {"data":[{
  "type":"teacher_request_created",
  "metadata":{"studentId":"...","studentName":"NotifP Eleve","requesterRole":"eleve", ...},
  "isRead":false
}], "meta":{"total":1, ...}}
```

---

## Besoin — 2026-08-17 — où sont les consentements légaux (RGPD/CGU/marketing) côté front ?

Question de l'utilisateur, pas encore une tâche de correction : il pensait que « Profil /
Confidentialité » affichait les signatures légales de l'inscription (RGPD, droit à l'image,
marketing), mais ce menu mène en réalité à `/visibilite`, qui gère la visibilité champ par champ
du profil — un sujet différent. Il note aussi que la règle générale déjà posée sur la visibilité
champ par champ (`docs/architecture.md`) ne serait pas respectée par cet écran.

Investigation faite côté orchestrateur (`docs/routes.md`, identity-access-service) : les routes
`GET /consents` (état courant), `GET /consents/history` (journal), `POST /consents`,
`POST /consents/:type/withdraw` existent déjà côté backend. **Seuls 3 types existent : `rgpd`,
`cgu`, `marketing` — aucun « droit à l'image » distinct côté backend.**

Investigation front déléguée (lecture seule, pas de correctif) : où mène réellement « Profil /
Confidentialité » aujourd'hui, existe-t-il un écran affichant `GET /consents` ailleurs, le
formulaire d'inscription mentionne-t-il un « droit à l'image » nulle part présent en base, et que
fait réellement l'écran `/visibilite`.

### État

- [x] Investigation front reçue : écran `/consents` existe déjà (fonctionnel) mais **invisible**
      — dans aucun menu, seul point d'entrée une bannière visible uniquement compte `pending`.
      « Profil/Confidentialité » ne mène qu'à `/visibilite` (visibilité champ par champ), aucun
      rapport avec les consentements. « Droit à l'image » n'existe nulle part (ni backend, ni
      texte du formulaire d'inscription) — attente de l'utilisateur sans base dans le code.
- [x] Réponse donnée à l'utilisateur — 2026-08-17

### Suite — arbitrage rendu par l'utilisateur sur la visibilité champ par champ (2026-08-17)

En réponse à la question sur la règle non respectée, l'utilisateur a précisé un arbitrage complet
sur les défauts de visibilité et le périmètre administrable, **consigné dans
`docs/architecture.md`** (section « Defauts de visibilite champ par champ... ») :
1. `loginIdentifier` (pseudo) jamais masquable, sert de repli.
2. Prénom/nom partagés à tous par défaut ; si masqués, repli sur le pseudo **partout** où un nom
   serait affiché — jamais un vide, jamais un UUID.
3. Tous les autres champs partagés par défaut aux seuls contacts liés (remplace l'ancien socle
   qui incluait aussi photo/niveau/matières).
4. Seuls les champs du rôle réel de l'utilisateur sont administrables par lui — **bug confirmé** :
   `/visibilite` montre aujourd'hui les deux blocs pédagogiques (élève ET formateur) sans filtrer
   par rôle du titulaire.

**Périmètre retenu par l'utilisateur (2026-08-17)**, après signalement que le repli nom→pseudo
(point 2) était potentiellement large : **le point 2 est reporté**, pas implémenté maintenant.
À la place :
- **Prénom et nom ne doivent plus du tout être réglables** dans `/visibilite` — retirés de
  l'écran, et le serveur doit les traiter comme toujours visibles à tous, quoi qu'il arrive
  (aucun repli sur le pseudo à construire pour l'instant, puisqu'ils ne peuvent plus être masqués
  du tout).
- **Le reste est à mettre à jour** : points 3 (tous les autres champs par défaut aux seuls
  contacts liés) et 4 (un utilisateur n'administre que les champs de son propre rôle — corriger
  le bug `/visibilite` qui montre les deux blocs pédagogiques).

Deux chantiers : `profile-service` (défauts des autres champs, catalogue filtré par rôle,
prénom/nom jamais masquables même via l'API), `front-developper` (retirer prénom/nom de l'écran
`/visibilite`, filtrer les champs affichés par rôle réel du titulaire).

### État

- [x] Implémenté côté `profile-service` — branche `fix/profile-service-visibilite-defauts-role`
      (poussée sur `origin`, non mergée), vérifiée par un agent dédié : firstName/lastName sortis
      du catalogue et toujours visibles (`PUT` avec ces noms → `400`), tous les autres champs par
      défaut `linked` calculé à la lecture (pas de migration), catalogue `GET .../field-visibility`
      filtré par le rôle réel du titulaire. 659/659 tests unitaires verts, 363/364 e2e verts (1
      échec préexistant sans rapport). Rapport : `.claude/reports/profile-service-2026-08-18.md`.
- [x] Implémenté côté front — branche `fix/front-visibilite-defauts-role` (poussée sur `origin`,
      non mergée) : prénom/nom retirés de l'écran `/visibilite` (aucune option, jamais envoyés en
      `PUT`), bug des deux blocs pédagogiques corrigé (filtrage par le rôle réel du titulaire via
      `resolvePedagogicalProfileKind`, déjà utilisé ailleurs dans le front pour le même problème).
      1581 tests front verts (2 échecs préexistants sans rapport).
- [x] Déployé sur la pile réelle — **déploiement de vérification, pas encore mergé dans `master`**
      (règle du projet : jamais de merge sans validation explicite). Orchestrateur : branche locale
      temporaire `verify/visibilite-defauts-role` (non poussée) fusionnant les deux branches
      ci-dessus + `docs/investigation-confidentialite-consentements`, sans conflit ; `profile-service`
      et `frontend` reconstruits et redéployés, gateway rechargée, bundle servi confirmé
      (`assets/index-DT-pCUIW.js`).
- [x] Preuve livrée à l'utilisateur — **preuve HTTP** contre la pile réelle, comptes élève et
      formateur créés via les vraies routes d'inscription (réponses citées ci-dessous), **et
      preuve à l'écran** : test e2e Playwright réel (aucun mock) contre
      `https://claudevma.visioprof.fr`, 2/2 verts, committé
      `apps/web/e2e/proof-field-visibility-defaults-role.spec.ts` sur
      `fix/front-visibilite-defauts-role`. Captures envoyées à l'utilisateur : élève (aucun
      réglage prénom/nom, seul le bloc « Profil pédagogique — élève ») et formateur (aucun
      réglage prénom/nom, seul le bloc « Profil pédagogique — formateur »).
- [ ] Validé par l'utilisateur

### Retour utilisateur sur la preuve (2026-08-18) — deux points, pas une validation

Après avoir vu la preuve (captures publiées en Artifact, `SendUserFile` ne s'affichant pas dans son
client), l'utilisateur a demandé deux ajustements — donc **pas encore une validation**.

**Point 1 — conserver prénom/nom à l'écran, grisés.** Revirement partiel sur le choix du
2026-08-17 : au lieu de les retirer entièrement de `/visibilite`, les afficher mais **grisés,
verrouillés sur « Tous les membres »**, aucun autre choix possible, jamais envoyés dans le `PUT`
(le backend les refuse toujours en `400` — comportement backend inchangé, uniquement l'affichage
front qui change).

- [x] Implémenté — `fix/front-visibilite-defauts-role`, commit `37a94d3`, poussé. Lignes
      `firstName`/`lastName` codées en dur côté front (`LOCKED_FIELD_ENTRIES`, backend ne les
      renvoie plus du tout), grisées, verrouillées sur le libellé existant de `all` (« Tous les
      membres », réutilisé, pas dupliqué), légende « Toujours visible, non modifiable », aucun
      input actif, strictement exclues du payload `PUT`. Nouveau flag `isLocked?` sur
      `FieldVisibilityEntry`. 25/25 tests du composant verts, 1581/1583 sur la suite complète (2
      échecs préexistants sans rapport, `EleveDashboardPage.test.tsx`).
- [ ] Preuve contre la pile réelle (capture) — pas encore faite pour cette révision spécifique.

**Point 2 — où voir les acceptations RGPD/CGU/marketing : placement décidé par l'utilisateur.**
Rappel du constat du 2026-08-17 : l'écran `/consents` existe et fonctionne (`GET /consents`,
historique inclus) mais n'est visible nulle part — ni menu du haut, ni rail gauche, seule une
bannière visible en compte `pending`. Précision apportée le 2026-08-18 : **aucun « droit à
l'image » distinct n'existe côté backend ni dans le texte du formulaire d'inscription** — seuls
`rgpd`, `cgu`, `marketing` existent. À vérifier par l'utilisateur si c'est un oubli d'implémentation
ou si c'était voulu comme inclus dans `cgu`.

**Décision de l'utilisateur (2026-08-18)**, dans l'onglet **« Confidentialité »** déjà existant sur
la page de profil (pas un ajout de menu du haut ni de rail gauche — la règle permanente sur les
menus ne s'applique donc pas ici) :
- Les **3 consentements** (rgpd, cgu, marketing) apparaissent **en haut** de cet onglet.
- La tuile actuelle « Confidentialité » de cet onglet (contenu actuel : les réglages de visibilité
  champ par champ, ex-`/visibilite`) devient **« Détails »** et passe **en dessous** des
  consentements.

- [x] Implémenté côté front — `fix/front-visibilite-defauts-role`, commit `101aaa1`, poussé.
      `ProfileConsentsSection` (nouveau) réutilise le mécanisme `/consents` existant
      (`useConsents`, `ConsentCard`, `ConsentWithdrawalDialog`) sans dupliquer d'appel API,
      affiché uniquement sur son propre profil (`GET /consents` ne renvoie que les consentements
      de l'appelant). Tuile visibilité renommée « Confidentialité » → « Détails », repositionnée
      en dessous. Retrait proposé uniquement pour `marketing`. 1591/1593 tests verts (2 échecs
      préexistants sans rapport, `EleveDashboardPage.test.tsx`).
- [x] Déployé sur la pile réelle — déploiement de vérification (même principe que précédemment,
      pas encore mergé dans `master`) : branche locale `verify/visibilite-defauts-role` refaite à
      partir de `origin/master` + les trois branches, sans conflit ; `frontend` reconstruit et
      redéployé, bundle servi confirmé `assets/index-sbHSCu-z.js`, gateway rechargée.
- [x] Preuve livrée à l'utilisateur — test e2e Playwright réel contre la pile réelle, 2/2 verts,
      committé `apps/web/e2e/proof-visibility-locked-names-and-consents-tab.spec.ts` sur
      `fix/front-visibilite-defauts-role` (commit `ed70d1d`). Captures rejouées par l'orchestrateur
      (le worktree de l'agent avait été nettoyé automatiquement avant récupération) et publiées
      dans l'Artifact déjà partagé avec l'utilisateur (mis à jour en place, même URL) : prénom/nom
      grisés verrouillés sur « Tous les membres » (Pièce 3), onglet Confidentialité avec
      consentements en tête et tuile « Détails » en dessous, retrait réservé au marketing
      (Pièce 4).
- [x] Validé par l'utilisateur — 2026-08-18 (« Très bien merge »)
- [x] Mergé dans master — PR #120, squash `f7b30e2`, branche supprimée. Les trois branches
      (`fix/profile-service-visibilite-defauts-role`, `fix/front-visibilite-defauts-role`,
      `docs/investigation-confidentialite-consentements`) consolidées localement dans
      `fix/visibilite-champ-par-champ` avant PR, sans conflit. `profile-service` et `frontend`
      reconstruits et redéployés depuis `master` (état durable), bundle `index-sbHSCu-z.js`
      confirmé, gateway rechargée, les deux services sains.

#### Preuve HTTP citée (2026-08-18, contre `https://claudevma.visioprof.fr`)

`GET /profiles/:userId/field-visibility` (élève) → `200`, aucun `firstName`/`lastName`, tous les
champs `defaultAudience: "linked"`, uniquement `block: "pedagogical-student"` côté pédagogique.
Même route (formateur) → `200`, uniquement `block: "pedagogical-teacher"`.

`PUT /profiles/:userId/field-visibility` `{"fields":[{"fieldName":"firstName","audience":"self"}]}`
→ `400 {"message":"Unknown profile field(s): firstName. Accepted field names: addressLine1, ...
(sans firstName ni lastName)"}`. Même résultat pour `lastName`.

---

## Besoin — 2026-08-17 — « Demande en cours » sur le dashboard élève pendant une demande active

Demande explicite de l'utilisateur, troisième état du dashboard élève (après « pas de
professeur » et « professeur assigné », livrés plus tôt aujourd'hui) : **pendant qu'une demande
de professeur est en cours de traitement** (soumise par l'élève, pas encore résolue par une
affectation), le bouton **« Demander un professeur »** ne doit plus s'afficher — remplacé par un
message **« Demande en cours »**.

À déterminer côté front : comment savoir qu'une demande est « en cours » (par opposition à
close/résolue) — probablement via le statut de la demande de l'élève auprès de
`teacher-request-service` (`pending`/`redirected` vs `closed`/`assigned`/etc., cf.
`docs/routes.md` section teacher-request-service). Ne pas deviner l'état à partir d'autre chose
que la vraie donnée de statut.

### Comment on saura que c'est fait

Capture d'écran du dashboard d'un élève ayant une demande de professeur active (non résolue),
sur `https://claudevma.visioprof.fr`, montrant « Demande en cours » et l'absence du bouton
« Demander un professeur ».

### État

- [ ] Localiser la donnée de statut de la demande active de l'élève
- [ ] Implémenter le troisième état du dashboard
- [ ] Déployé sur la pile réelle (fusionné dans `master` avant tout autre déploiement, pour
      éviter la régression rencontrée plus tôt aujourd'hui)
- [ ] Preuve livrée à l'utilisateur
- [ ] Validé par l'utilisateur

---

## Besoin — 2026-08-17 — déplacer « Demandes » du menu du haut vers le rail gauche élève

Demande explicite de l'utilisateur (conforme à la règle permanente sur les menus — approbation
obtenue ici) : l'entrée **« Demandes »** du menu du haut, côté élève, doit être retirée du menu
du haut et ajoutée au rail latéral gauche sous le nom **« Demandes professeurs »**, positionnée
**juste sous « Visio »**.

### Comment on saura que c'est fait

Capture d'écran du dashboard élève sur `https://claudevma.visioprof.fr` montrant : absence de
« Demandes » dans le menu du haut, présence de « Demandes professeurs » dans le rail gauche juste
sous « Visio ».

### État

- [ ] Localiser l'entrée « Demandes » du menu du haut élève et le rail gauche élève
- [ ] Déplacer et renommer
- [ ] Déployé sur la pile réelle
- [ ] Preuve livrée à l'utilisateur
- [ ] Validé par l'utilisateur

---

## Besoin — 2026-08-17 — distinguer deux libellés pour un professeur non retenu

Demande explicite de l'utilisateur, correction sur les notifications du flow demande de
professeur : pour un formateur dont la candidature n'est pas retenue, le message doit distinguer
deux cas au lieu d'un seul libellé générique :

1. **« Un autre professeur a été retenu pour {élève} »** — quand le RP a choisi un autre
   formateur (cas `TeacherProposalNotSelected` déjà arbitré le 2026-08-14).
2. **« Vous n'avez pas été retenu pour {élève} »** — quand le RP a expressément refusé ce
   formateur, sans qu'un autre ait forcément été choisi.

Investigation faite par l'orchestrateur avant délégation (`docs/routes.md`, section
teacher-request-service) : le backend distingue **déjà** ces deux cas, sans changement
nécessaire. À la clôture d'une demande (`POST /requests/:id/validate`), les candidatures non
retenues se répartissent en deux états distincts, déjà notifiés séparément au formateur
concerné (arbitrage du 2026-08-14, point 8) :
- `not_selected` (le formateur avait **accepté**, un autre a été choisi) → événement
  `TeacherProposalNotSelected` → **« Un autre professeur a été retenu pour {élève} »**.
- `expired` (le formateur n'avait **jamais répondu**) → événement `TeacherProposalExpired` →
  **« Vous n'avez pas été retenu pour {élève} »**.
Il ne s'agit donc que d'un correctif de libellés front sur deux types déjà distincts — pas d'un
changement backend. À vérifier côté front : `notificationLabels.ts` porte-t-il aujourd'hui un
libellé unique ou incorrect pour l'un des deux ?

### Comment on saura que c'est fait

Réponse HTTP ou capture montrant les deux libellés corrects selon le cas réel, contre
`https://claudevma.visioprof.fr`.

### État

- [x] Confirmé : pas de changement backend nécessaire, deux types déjà distincts
- [x] Implémenté — `notificationLabels.ts` : `teacher_proposal_not_selected` et
      `teacher_proposal_expired` portaient déjà deux libellés différents l'un de l'autre, mais
      aucun ne correspondait au texte demandé (« {formateur} n'a pas été retenu... » /
      « La proposition ... est restée sans réponse »). Corrigés vers le texte exact demandé.
      Vérifié aussi `TeacherProposalInbox.tsx`/`TeacherProposalList.tsx` (badges de statut RP et
      formateur) : déjà cohérents, non touchés.
- [x] Déployé sur la pile réelle — `frontend` reconstruit, bundle `index-4qciq3ro.js`, les deux
      libellés exacts vérifiés présents dans le bundle servi.
- [x] Preuve livrée à l'utilisateur — vérification directe du bundle servi (les deux phrases
      exactes présentes à l'octet). Pas de rejeu du scénario complet contre la pile réelle
      (identifiants RP de test absents de ce worktree) — repli sur tests unitaire/composant
      ciblés (`notificationLabels.test.ts`, `NotificationBell.test.tsx`), signalé comme tel.
- [x] Validé par l'utilisateur — 2026-08-17, corrigé et redéployé conjointement avec le
      dashboard élève après une confusion de déploiement (voir ci-dessous)

---

## Besoin — 2026-08-17 — le dashboard élève doit refléter le professeur assigné

Demande explicite de l'utilisateur, suite du flow demande de professeur : une fois qu'un
professeur a été choisi pour l'élève (`TeacherAssigned`), son écran d'accueil doit changer.

1. Tuile **« Mon professeur »** : afficher la photo de profil du professeur, son prénom et son
   nom.
2. Tuile **« Prochains cours »** : si aucun cours à venir, afficher « Vous n'avez pas de prochain
   cours » avec un bouton — **le bouton est affiché mais sa fonctionnalité réelle (contacter le
   professeur) sera implémentée plus tard, avec la messagerie**. Ne pas construire de faux
   parcours de contact maintenant, juste préparer la place.
3. Le bouton **« Demander un professeur »** doit disparaître une fois qu'un professeur est
   assigné (il n'a plus de sens).
4. Garder un bouton **« Changer de professeur »** dans la tuile « Mon professeur », qui mène à
   l'écran des demandes de professeur (`/teacher-requests`).

Ceci concerne des tuiles du dashboard, pas le menu du haut ni le rail gauche — la règle
permanente ci-dessous sur les menus ne s'applique pas ici, mais reste en vigueur pour toute
navigation.

### Comment on saura que c'est fait

Capture d'écran du dashboard d'un élève ayant un professeur assigné, sur
`https://claudevma.visioprof.fr`, montrant les 4 points ci-dessus.

### État

- [x] Localisée : `GET /relations/teacher-student/:studentId` (`profile-service`), déjà
      accessible à l'élève, renvoie `teacherName` déjà résolu (préfère la relation
      `isPrincipalTeacher`). Changement de source par rapport à l'existant : le dashboard
      utilisait jusqu'ici `GET /contacts` (`communication-service`), non lié à l'affectation
      pédagogique réelle créée par le RP.
- [x] Implémenté — `useAssignedTeacher` (nouveau hook), `useReadOnlyAvatar` (nouveau hook,
      `GET /profiles/:teacherId/avatar`), tuiles « Mon professeur » / « Prochain cours »
      modifiées dans `EleveDashboardPage.tsx`, bouton « Demander un professeur » conditionné à
      l'absence de professeur assigné, bouton « Changer de professeur » ajouté.
- [x] Déployé sur la pile réelle — `frontend` reconstruit, bundle `index-iGnwmnj5.js`.
- [x] Preuve livrée à l'utilisateur — capture d'écran envoyée, test Playwright
      `apps/web/e2e/proof-dashboard-eleve-professeur-assigne.spec.ts` contre
      `https://claudevma.visioprof.fr` avec élève + formateur + relation créés via les vraies
      routes (inscription, avatar, RP).
- [x] Validé par l'utilisateur — 2026-08-17. **Régression de déploiement signalée par
      l'utilisateur** : cette branche n'avait jamais été fusionnée dans `master`, et un
      déploiement ultérieur depuis une autre branche non fusionnée (libellés de notification,
      basée sur `master` sans ce travail) a écrasé l'affichage sur la pile réelle — l'utilisateur
      a revu « Demander un professeur » réapparaître. Corrigé en fusionnant les deux branches
      dans `master` et en redéployant depuis `master`. Leçon retenue : ne plus déployer de
      branche non fusionnée comme état durable de la pile réelle, seulement pour vérification
      ponctuelle immédiatement suivie d'une fusion.

**Écart backend découvert en chemin, hors périmètre de cette tâche** : `GET /profiles/:teacherId/avatar`
répond `403` à l'élève même avec une relation active (« An élève may only view their own
profile ») — recoupe le point ouvert déjà noté dans `docs/architecture.md` (« Décisions en
attente », point 3 : `GET /profiles/:userId` pas aligné sur `/statistics`). Le front dégrade
proprement vers un avatar d'initiales, jamais d'UUID ni d'erreur visible — mais la vraie photo
du professeur ne s'affichera pas tant que ce point n'est pas corrigé côté `profile-service`.

---

## RÈGLE PERMANENTE — 2026-08-17 — pas de changement de menu sans approbation

L'utilisateur a explicitement demandé : ne plus ajouter d'élément au menu du haut ni au rail
latéral gauche sans son approbation préalable explicite. Il tient à sa structure de navigation
initiale. Voir mémoire `feedback-no-menu-changes-without-approval`. Cette règle s'applique à
toute délégation future à `front-developper` : proposer, ne pas ajouter directement.

## Besoin — 2026-08-17 — réorganisation du rail gauche formateur (COURS / SUIVI)

Demande explicite de l'utilisateur (donc conforme à la règle permanente posée le 2026-08-17 sur
les menus — approbation explicite obtenue ici) :

1. Dans le groupe **COURS** du rail gauche formateur, l'entrée **« Demandes ouvertes »** fait
   doublon avec « Propositions reçues » du groupe SUIVI, sans que l'utilisateur sache à quoi elle
   correspond. Supprimer « Demandes ouvertes » et la remplacer, dans le groupe COURS, par
   **« Propositions reçues »** (même destination que l'entrée SUIVI existante).
2. Conséquence dans le groupe **SUIVI** : il ne doit plus rester que « Cahier de texte » et
   « Mes élèves » (l'entrée « Propositions reçues » déménage vers COURS). Inverser leur ordre :
   **« Mes élèves » d'abord, puis « Cahier de texte »**.

### Comment on saura que c'est fait

Capture d'écran du rail gauche formateur sur `https://claudevma.visioprof.fr` montrant : COURS
avec « Propositions reçues » (plus de « Demandes ouvertes ») et SUIVI avec « Mes élèves » puis
« Cahier de texte », dans cet ordre.

### État

- [x] Localiser les entrées dans la config de navigation front
- [x] Appliquer les changements (COURS et SUIVI)
- [x] Déployé sur la pile réelle (rebuild + redémarrage `visiomath_frontend`)
- [x] Preuve livrée à l'utilisateur (capture d'écran, compte formateur de test)
- [x] Validé par l'utilisateur — 2026-08-17 (« ok merge »)

Fichier modifié : `apps/web/src/navigation/navigationConfig.ts`. Mergé dans `master` — PR #115.

---

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
- [x] Validé par l'utilisateur — 2026-08-17 (« ok merge »)

Mergé dans `master` — PR #114.

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
