# Relevé — Flow « demande de professeur » côté front

Date : 2026-08-11
Périmètre : `apps/web/` uniquement. **Aucune modification de code.** Relevé + reproduction contre la
pile réelle (`https://claudevma.visioprof.fr`).

Statut global : ⚠️ — le 400 est reproduit et expliqué ; le flow métier attendu (étapes 2 à 4) n'est
couvert qu'en partie, et la partie couverte l'est avec des écrans qui demandent des UUID à
l'utilisateur.

---

## A. Le payload exact envoyé sur `POST /api/v1/teacher-requests`

### A.1 — Il y a **deux** écrans qui postent sur cette même URL, avec **deux corps différents**

| # | Route React | Page | Composant | Hook | Fonction API | Corps envoyé |
|---|---|---|---|---|---|---|
| 1 | `/teacher-requests` | `TeacherRequestsPage.tsx` | formulaire inline dans la page | `useTeacherRequests` | `createTeacherRequest` | `{description, studentId?}` |
| 2 | `/rp/teacher-requests` | `TeacherRequestPage.tsx` | `SpecificTeacherRequestForm` | `useSpecificTeacherRequestSubmit` | `createSpecificTeacherRequest` | `{subject, level, sector, message?, studentId?}` |

Fichiers :
- `/home/debian/Documents/claudeVMA/apps/web/src/pages/TeacherRequestsPage.tsx` (l. 40-55)
- `/home/debian/Documents/claudeVMA/apps/web/src/hooks/teacher-requests/useTeacherRequests.ts` (l. 49-65)
- `/home/debian/Documents/claudeVMA/apps/web/src/api/teacherRequests.ts` (l. 57-62 et l. 159-164)
- `/home/debian/Documents/claudeVMA/apps/web/src/components/teacher-requests/SpecificTeacherRequestForm.tsx` (l. 37-57)
- `/home/debian/Documents/claudeVMA/apps/web/src/hooks/teacher-requests/useSpecificTeacherRequestSubmit.ts`

Les deux fonctions du helper visent littéralement `apiClient.post('/teacher-requests', payload)` :
même URL, deux DTO. C'est déjà une anomalie en soi — une route, un contrat.

### A.2 — Corps exact, champ par champ, du chemin qui échoue (`/teacher-requests`)

```json
{ "description": "<textarea 'Description' de la page, .trim()>",
  "studentId":   "<input texte 'ID de l'élève (optionnel)', .trim(), omis si vide>" }
```

| Champ | Source | Obligatoire côté front | Remarque |
|---|---|---|---|
| `description` | `<textarea>` de `TeacherRequestsPage` (état local `newDescription`) | oui (`required`, plus garde `if (!newDescription.trim()) return`) | **Champ inconnu du serveur** |
| `studentId` | `<input type="text" placeholder="UUID de l'élève concerné">`, affiché **seulement si `hasRole('responsable_pedagogique')`** | non | Saisie manuelle d'un UUID |

### A.3 — Corps exact du chemin qui fonctionne (`/rp/teacher-requests`)

```json
{ "subject": "…", "level": "…", "sector": "…", "message": "…", "studentId": "…" }
```

`subject`/`level`/`sector` sont trois `<input type="text">` libres marqués obligatoires côté front ;
`message` et `studentId` ne sont ajoutés au corps que non vides. `studentId` n'est affiché que si
`isParentFinanceur || isResponsablePedagogique`, sous le libellé « ID de l'élève », placeholder
« UUID de l'élève concerné ».

### A.4 — En-têtes réellement émis

`apps/web/src/api/client.ts` est le seul point d'assemblage des en-têtes :

- `Content-Type: application/json` (défaut de l'instance axios) ;
- `Authorization: Bearer <access_token>` (intercepteur, jeton lu dans `localStorage`) ;
- **aucun `x-correlation-id`** — le front n'en génère nulle part (`grep` : la chaîne n'apparaît que
  dans `api/orchestration.ts` comme *champ de corps* et dans l'écran d'admin qui recherche un
  historique d'événements) ;
- **aucune clé d'idempotence** — `idempotencyKey` n'existe côté front que comme champ de corps de
  `dispatchCommand` (orchestration) et comme champ *lu* dans une archive.

Le contrat technique global (`docs/microservices.md`) exige pourtant la propagation de
`x-correlation-id` sur tous les appels. Écart transverse, pas propre à ce flow.

### A.5 — Reproduction contre la pile réelle (2026-08-11, compte élève créé pour le diagnostic)

Compte de diagnostic : `diag.eleve.1786486537`, rôle `eleve`, `validationStatus: active`.

**Corps de `TeacherRequestsPage` → 400 :**

```
POST https://claudevma.visioprof.fr/api/v1/teacher-requests
{"description":"Besoin de soutien en maths"}
→ 400 {"message":["subject must be a string"],"error":"Bad Request","statusCode":400}
```

**Corps de `SpecificTeacherRequestForm` → 201 :**

```
POST https://claudevma.visioprof.fr/api/v1/teacher-requests
{"subject":"Algebre","level":"Terminale","sector":"Generale","message":"Besoin de soutien"}
→ 201 {"id":"c4fcaae5-…","requesterId":"9c7b7836-…","requesterRole":"eleve",
       "studentId":"9c7b7836-…","subject":"Algebre","level":"Terminale","sector":"Generale",
       "message":"Besoin de soutien","status":"pending","type":"specific",
       "currentPpTeacherId":null,"selectedTeacherIds":null,"chosenTeacherId":null,
       "createdAt":"2026-08-11T22:15:49.605Z","updatedAt":"2026-08-11T22:15:49.605Z"}
```

**Cause du 400 : le serveur exige `subject` (string) ; `description` n'existe pas dans son DTO.**
Ce n'est pas un problème de route, de gateway ni d'authentification.

Trois constats supplémentaires vérifiés sur la pile réelle :

1. **`sector` n'est pas obligatoire côté serveur** (`{"subject","level"}` seuls → `201`, `sector:null`),
   alors que le front le marque `*` obligatoire et bloque la soumission sans lui.
2. **Un champ inconnu est absorbé en silence** : `{"subject","level","sector","description":"CHAMP
   PARASITE"}` → `201`, et `description` n'apparaît nulle part dans la réponse. C'est exactement le
   défaut fermé par l'arbitrage du 2026-08-09 (« aucune route ne doit accepter puis ignorer un
   champ »). C'est aussi ce qui rend le 400 actuel *bavard sur le champ manquant mais muet sur le
   champ de trop*.
3. **`studentId` envoyé par un élève est ignoré et forcé au demandeur** : corps avec
   `studentId:"11111111-2222-…"` → réponse `studentId` = l'id du compte appelant. Sûr, mais
   silencieux.

### A.6 — Pourquoi le bug n'a pas été vu

`apps/web/test/pages/TeacherRequestStudentJourney.test.tsx` (l. 300-303) **assert** que le front
poste `{description: 'Aide en analyse niveau terminale'}`. La suite simule intégralement le réseau :
le test est vert et fige le corps erroné. Conformément à la règle projet, ce vert ne vaut pas
validation — seule la reproduction ci-dessus fait foi.

### A.7 — Qui atterrit sur quelle page

| Point d'entrée | Fichier | Destination | Résultat |
|---|---|---|---|
| Dashboard élève, bouton « Demander un professeur » | `pages/EleveDashboardPage.tsx` l. 128-133 | `/teacher-requests` | **400** |
| `ContactsPage`, encart « Nouvelle demande » (élève/parent) | `pages/ContactsPage.tsx` l. 127 | `/teacher-requests` | **400** |
| `ContactsPage`, encart « Nouvelle demande » (RP) | `pages/ContactsPage.tsx` l. 127 | `/rp/teacher-requests` | 201 |
| Rail gauche RP « Demandes professeurs » | `navigation/navigationConfig.ts` l. 202 | `/rp/teacher-requests` | 201 |
| Rail gauche formateur « Demandes prof. » | `navigation/navigationConfig.ts` l. 179 | `/teacher-requests` | liste seule |
| Top nav « Demandes » (parent, RP) | `navigation/navigationConfig.ts` l. 64-69 | `/teacher-requests` | **400** pour le parent |

**L'élève n'a aucune entrée de navigation vers les demandes** : `TOP_NAV_CONFIG.demandes` porte
`allowedRoles: ['parent_financeur', 'responsable_pedagogique']`, et `RAIL_GROUPS_BY_ROLE.eleve` n'a
pas d'item « Demandes ». Il n'y accède que par le bouton du dashboard — qui mène à l'écran cassé.
`.claude/design/front-design.md` l. 52 prévoit pourtant « Demandes — affiché pour les rôles impliqués
dans le workflow professeur (élève, parent, RP) ».

---

## B. Inventaire des écrans, mis en regard des étapes 1 à 4

### Étape 1 — l'élève (ou le parent) demande un professeur

| Écran attendu | État | Fichier | Route |
|---|---|---|---|
| Demande élève | ⚠️ **existe en double, la version atteignable est cassée** | `pages/TeacherRequestsPage.tsx` (400) et `pages/TeacherRequestPage.tsx` + `components/teacher-requests/SpecificTeacherRequestForm.tsx` (201) | `/teacher-requests` et `/rp/teacher-requests` |
| Demande parent **avec sélection de l'élève** | ❌ **n'existe pas** | — | — |

Détail parent : il n'y a **aucun sélecteur d'élève**. Le parent reçoit un `<input type="text">
placeholder « UUID de l'élève concerné »`, dans les deux variantes de formulaire. Le pattern
multi-élèves (liste déroulante prénom + nom) existe ailleurs dans le front — `hooks/relations/useMyContacts.ts`
sur `GET /relations/my-contacts`, utilisé par `pages/MyStudentsPage.tsx` et
`pages/PedagogicalArchivePage.tsx` — mais n'est **pas** branché ici.

Autre écart : sur `/teacher-requests`, le champ élève n'est affiché que pour le RP
(`hasRole('responsable_pedagogique')`), donc **un parent ne peut même pas désigner son élève** sur
cet écran ; sur `/rp/teacher-requests` il l'est pour parent et RP.

### Étape 2 — le RP voit la demande, s'en saisit, ajoute des précisions, propose à des professeurs

| Écran attendu | État | Fichier | Route |
|---|---|---|---|
| Boîte de réception RP | ⚠️ **partiel** — liste filtrée `pending`/`candidates_selected`, sans prise en charge ni tri ni filtre | `components/teacher-requests/RpTeacherSearchWorkspace.tsx` + `hooks/teacher-requests/useRpTeacherSearchWorkspace.ts` | `/rp/teacher-requests` |
| « S'en saisir » (assignation du RP à la demande) | ❌ **n'existe pas** | — | — |
| Ajouter des précisions à la demande (édition RP) | ❌ **n'existe pas** — aucun formulaire d'édition, seul `PATCH /teacher-requests/:id/status` existe | — | — |
| Redirection vers **plusieurs** professeurs | ⚠️ **partiel et inutilisable** — un candidat à la fois, désigné par **UUID saisi à la main**, aucune recherche de formateur | `components/teacher-requests/TeacherCandidatesView.tsx` l. 137-172 | `/teacher-requests/:requestId` |
| Recherche de professeur (niveau, disponibilités, points) | ❌ **n'existe pas** — malgré le nom `RpTeacherSearchWorkspace`, le composant ne contient aucune recherche | — | — |

`RpTeacherSearchWorkspace` est une simple liste ; le lien « Voir toutes les demandes → » qu'il
affiche pointe vers `/teacher-requests`, c'est-à-dire l'écran cassé.

### Étape 3 — un ou des professeurs acceptent

| Écran attendu | État | Fichier | Route |
|---|---|---|---|
| Boîte de réception formateur | ⚠️ **partiel** | `components/teacher-requests/TeacherRequestInbox.tsx` + `hooks/.../useTeacherRequestInbox.ts` | `/rp/teacher-requests` (rôle formateur) |
| Acceptation formateur depuis le détail | ⚠️ **partiel** | `components/teacher-requests/TeacherCandidatesView.tsx` l. 221-238 | `/teacher-requests/:requestId` |

Réserves sur l'inbox formateur :
- elle appelle `GET /teacher-requests` **sans filtre** et ne garde que `pending`/`candidates_selected` :
  elle n'a aucun moyen de savoir si le formateur connecté est réellement candidat — le champ
  `candidateId` qu'elle utilise n'existe pas dans la réponse serveur observée ;
- le repli du hook est explicite : « `candidateId` est l'ID de la proposition quand disponible ;
  **repli sur `requestId` sinon** » — donc l'acceptation part sur
  `POST /proposals/<requestId>/accept`, un identifiant qui n'est pas celui d'une proposition ;
- le rail gauche formateur pointe vers `/teacher-requests` (`TeacherRequestsPage`), **où l'inbox
  n'est pas montée** : le formateur voit une liste, jamais ses boutons Accepter/Refuser.

### Étape 4 — le RP valide une acceptation, notifie, crée le lien, clôt les demandes pendantes

| Écran attendu | État |
|---|---|
| Validation d'une acceptation **par le RP** | ❌ **n'existe pas** — le bouton « Choisir » est réservé à `isClient` (élève/parent), pas au RP (`TeacherCandidatesView.tsx` l. 249-257) |
| Messages à l'élève / parent / professeurs non retenus / professeur choisi | ❌ aucune trace côté front |
| Création du lien élève↔professeur | ❌ aucun appel `POST /relations/teacher-student` dans ce flow |
| Chute des demandes pendantes | ❌ aucun traitement |

Le front implémente donc une **étape 4 différente de celle demandée** : c'est le client qui choisit
le formateur, pas le RP qui valide. Écart de règle métier, pas de simple écran manquant.

Écrans annexes présents, hors du flow décrit :
`ChangePrincipalTeacherDialog` (changement de PP, `POST /teacher-requests/pp-change`),
`StopCollaborationRequestForm` (`POST /teacher-collaborations/:id/stop-request`),
`TeacherValidationPanel` (validation d'un formateur, `PATCH /profiles/:teacherId/validation`),
`AgreementsPage` (accord utilisateur, via orchestration).

### B.bis — Ce que la pile réelle répond sur chaque route du flow

Testé le 2026-08-11 avec le jeton du compte élève de diagnostic :

| Appel front | Réponse réelle | Lecture |
|---|---|---|
| `GET /teacher-requests` | `200` tableau nu | OK ; la réponse porte `studentName`/`teacherName` (ici `null`) |
| `GET /teacher-requests/:id` | `200` | **Aucune clé `candidates`** dans la réponse |
| `POST /teacher-requests` `{description}` | `400 subject must be a string` | Le bug signalé |
| `POST /teacher-requests` `{subject,level,sector}` | `201` | Le chemin qui marche |
| `POST /teacher-requests/:id/proposals` | `403 role` | La route **existe** (non documentée) |
| `POST /teacher-requests/:id/select` | `400 Request is not in a selectable state (current: pending)` | La route **existe** |
| `POST /proposals/:id/accept` | `403 role` | La route **existe** |
| `POST /teacher-requests/pp-change` | `403 role` | La route **existe** |
| `POST /teacher-collaborations/:id/stop-request` | `404` **HTML nginx** | **La gateway ne connaît pas ce préfixe** — l'écran d'arrêt de collaboration ne peut pas fonctionner |
| `PATCH /teacher-requests/:id/status` `{status:"cancelled"}` | `403 role` | L'élève **ne peut pas** annuler sa propre demande, alors que le bouton « Annuler la demande » lui est affiché (`TeacherRequestDetailPage.tsx` l. 211-221) |
| `GET /requests` | `200`, **même contenu** que `GET /teacher-requests` | Deux URL pour la même donnée |

---

## C. Types TypeScript et clients d'API

### C.1 — Où c'est défini

| Élément | Fichier |
|---|---|
| Helper HTTP | `apps/web/src/api/teacherRequests.ts` (222 l.) |
| Types partagés | `apps/web/src/types/teacherRequests.ts` (113 l.) |
| `TeacherCandidate` | **déclaré dans un composant**, `components/teacher-requests/TeacherCandidatesView.tsx` l. 13-20, puis **importé par `types/teacherRequests.ts` et par `api/teacherRequests.ts`** — inversion de dépendance contraire à la règle « types partagés dans `src/types/` » |

### C.2 — Écarts de nommage front ↔ serveur (règle : un seul nom par donnée, partout)

Réponse réelle du serveur :

```
{id, requesterId, requesterRole, studentId, subject, level, sector, message, status,
 type, currentPpTeacherId, selectedTeacherIds, chosenTeacherId, studentName, teacherName,
 createdAt, updatedAt}
```

| Nom côté front | Nom côté serveur | Verdict |
|---|---|---|
| `description` (`TeacherRequestSummary`, `TeacherRequestDetail`, `CreateTeacherRequestPayload`) | **aucun** ; le contenu libre s'appelle `message` | ❌ **nom inventé**. En lecture il vaut toujours `undefined` — les trois listes affichent donc systématiquement une demande sans texte. En écriture il provoque le 400. |
| `TeacherRequestDetail.teacherId` | `chosenTeacherId` | ❌ nom divergent |
| `TeacherRequestDetail.candidates` | absent de la réponse | ❌ champ imaginaire |
| `TeacherRequestDetail.collaborationId` | absent de la réponse | ❌ champ imaginaire (et sa route associée renvoie 404 nginx) |
| `TeacherRequestSummary.candidatesCount` | absent de la réponse | ❌ champ imaginaire ; le compteur « n candidats » du workspace RP ne s'affiche jamais |
| — | `requesterId`, `requesterRole`, `type`, `currentPpTeacherId`, `selectedTeacherIds` | non déclarés côté front |
| `studentName` | `studentName` | ✅ existe côté serveur ; **utilisé seulement par `TeacherRequestsPage`**, ignoré par `TeacherRequestPage`, `RpTeacherSearchWorkspace`, `TeacherRequestDetailPage` |
| `teacherName` | `teacherName` | ✅ existe côté serveur ; **jamais utilisé** par le front |
| `TeacherRequestStatus` = `pending\|accepted\|declined\|cancelled\|candidates_selected` | statuts documentés : `pending\|accepted\|declined\|cancelled` | ⚠️ `candidates_selected` non documenté ; `TeacherRequestDetail.status` est typé `string`, `TeacherRequestSummary.status` est typé strict — deux typages pour la même donnée |

### C.3 — Écarts d'URL

| Fonction | URL appelée | Documenté ? |
|---|---|---|
| `fetchTeacherRequestsForDashboard` | `/requests` | ⚠️ Fonctionne, mais c'est un **second nom pour la même ressource** que `/teacher-requests`. `docs/routes.md` documente la section teacher-request-service avec des chemins `/requests` tout en annonçant le préfixe gateway `/api/v1/teacher-requests` : la doc elle-même porte les deux noms. À résorber, pas à documenter. |
| `addTeacherCandidate` | `/teacher-requests/:id/proposals` | ❌ absent de `docs/routes.md` (existe côté serveur) |
| `respondToTeacherProposal` | `/proposals/:id/accept\|decline` | ❌ absent de `docs/routes.md` (existe côté serveur) |
| `selectTeacherCandidate` | `/teacher-requests/:id/select` | ❌ absent de `docs/routes.md` (existe côté serveur) |
| `createPpChangeRequest` | `/teacher-requests/pp-change` | ❌ absent de `docs/routes.md` (existe côté serveur) |
| `requestCollaborationStop` | `/teacher-collaborations/:id/stop-request` | ❌ absent de `docs/routes.md` **et** absent de la gateway → `404` HTML |
| `fetchTeacherValidationStatus` / `updateTeacherValidationStatus` | `/profiles/:teacherId/validation` | ✅ documenté (profile-service) |

Les commentaires en tête de `api/teacherRequests.ts` signalent déjà la plupart de ces écarts et
indiquent qu'ils ont été « préservés tels quels » lors d'un lot de restructuration. Ils sont donc
connus, non traités.

---

## D. Points de contact avec les règles projet

### D.1 — « Aucun UUID affiché ni saisi par un utilisateur » (arbitrage 2026-08-09)

Violations, toutes dans le flow :

| Emplacement | Ce que l'utilisateur voit |
|---|---|
| `TeacherRequestsPage.tsx` l. 104-113 | Champ « ID de l'élève (optionnel) », placeholder « UUID de l'élève concerné » |
| `SpecificTeacherRequestForm.tsx` l. 81-94 | Idem, pour parent **et** RP |
| `TeacherCandidatesView.tsx` l. 139-151 | Champ « ID du formateur * », placeholder « UUID du formateur à proposer » — le RP doit connaître l'UUID du professeur qu'il veut solliciter |
| `ChangePrincipalTeacherDialog.tsx` | Deux champs d'UUID de formateur (actuel / souhaité) |
| `TeacherRequestsPage.tsx` l. 203, 215 · `TeacherRequestPage.tsx` l. 204, 221 · `RpTeacherSearchWorkspace.tsx` l. 73, 77 · `TeacherRequestInbox.tsx` l. 93 | « Demande #c4fcaae5 », « Élève : 9c7b7836… » — UUID tronqués comme libellé principal |
| `TeacherRequestDetailPage.tsx` l. 157, 181-188 | UUID complet de la demande, de l'élève, du formateur et de la collaboration, en `font-mono` |
| `TeacherCandidatesView.tsx` l. 193 | « Formateur 3f2a1b9c… » en repli de `teacherName` |

Le serveur renvoie pourtant `studentName` et `teacherName` sur `GET /teacher-requests`, et
`GET /relations/my-contacts` fournit prénom + nom + nature du lien sans exposer d'UUID. La matière
existe, elle n'est pas consommée.

### D.2 — « Tout ce que l'utilisateur lit est en français, en un point unique » (règle 2026-08-09)

La table `status → libellé` est **recopiée cinq fois**, avec deux contenus différents :

| Fichier | Contient `candidates_selected` ? |
|---|---|
| `pages/TeacherRequestPage.tsx` l. 26-40 | oui |
| `pages/TeacherRequestsPage.tsx` l. 8-20 | **non** |
| `pages/TeacherRequestDetailPage.tsx` l. 23-37 | oui |
| `components/teacher-requests/RpTeacherSearchWorkspace.tsx` l. 12-26 | oui |
| `components/teacher-requests/TeacherCandidatesView.tsx` l. 208-244 | libellés en dur dans le JSX |

Conséquence concrète : sur `/teacher-requests`, une demande `candidates_selected` affiche un badge
**vide** (`STATUS_LABELS[status]` → `undefined`, et `STATUS_COLORS[status]` → classe vide), alors que
les autres écrans affichent « Candidats sélectionnés ». Un point unique existe déjà pour un cas
comparable : `utils/archiveLabels.ts`.

Autre écart de langue : `useTeacherRequests`/`useTeacherRequestSummaries`/`useTeacherRequestInbox`
**écrasent** le message du serveur par « Impossible de charger les demandes » ou « Accès refusé »,
tandis que `useSpecificTeacherRequestSubmit` et `useTeacherCandidates` **affichent brut**
`response.data.message`, qui est en anglais (« You do not have the required role for this action »,
« subject must be a string »). Deux politiques opposées dans le même flow.

### D.3 — « Le chargement se fait au niveau de la page ; la réponse du serveur remonte au
propriétaire de l'état » (règle 2026-08-10)

- ⚠️ **Le chargement n'est pas au niveau de la page.** `TeacherRequestPage` charge la liste via
  `useTeacherRequestSummaries`, **et** `RpTeacherSearchWorkspace` recharge la même
  `GET /teacher-requests` de son côté, **et** `TeacherRequestInbox` la recharge une troisième fois.
  Pour un RP, la même requête part deux fois au montage ; les trois normalisations de la réponse sont
  écrites trois fois, avec des règles différentes (`useTeacherRequests` jette l'enveloppe
  `{data:[…]}` et renvoie `[]`, les deux autres l'acceptent).
- ✅ **La réponse d'écriture remonte bien** : `createSpecificTeacherRequest` renvoie l'objet créé, que
  `SpecificTeacherRequestForm` passe à `onSuccess`, que la page pousse dans `addRequestLocally`. Idem
  pour `updateStatus` dans `useTeacherRequestDetail`. Pas de rechargement après écriture — conforme.
- ⚠️ Mais l'objet remonté est ensuite lu à travers un type qui ne correspond pas au serveur
  (`request.description` toujours `undefined`) : la demande tout juste créée s'affiche donc sans son
  texte, sous un titre « Demande #c4fcaae5 ».

### D.4 — « Ne jamais afficher une entrée qui mènerait à un écran interdit »

- Le bouton « Annuler la demande » est affiché à l'élève et au parent (`isClient && status ===
  'pending'`) alors que `PATCH /teacher-requests/:id/status` leur répond `403`.
- Le bouton « Supprimer définitivement » est affiché à `eleve`, `parent_financeur`,
  `responsable_pedagogique`, `technicien_informatique` sans vérification côté serveur connue.
- Inversement, l'élève n'a **aucune** entrée de navigation vers `/teacher-requests` alors que le
  design la prévoit.

### D.5 — Factorisation / taille

Aucun fichier du flow ne dépasse 300 lignes (max : `TeacherRequestDetailPage.tsx`, 278 l. ;
`TeacherCandidatesView.tsx`, 266 l. — les deux au-dessus du seuil de vigilance de 250 l.).
Les duplications réelles sont ailleurs : trois pages pour un même domaine
(`TeacherRequestsPage`/`TeacherRequestPage`/`TeacherRequestDetailPage`), cinq tables de libellés,
trois normalisations de la même réponse, quatre copies de `extractMessage`.

---

## E. Synthèse pour arbitrage

1. **Le 400 est un contrat de champ, pas une route** : le serveur veut `subject`/`level`/`sector?`/
   `message?`, le front atteignable envoie `description`. Deux formulaires concurrents postent sur la
   même URL avec deux DTO ; il faut trancher lequel est le formulaire de demande, et le nom du champ
   de texte libre (`message` côté serveur aujourd'hui).
2. **Le flow métier décrit n'est pas celui codé** : côté front, c'est le **client** qui choisit le
   formateur parmi les candidats ; l'énoncé veut que ce soit le **RP** qui valide une acceptation,
   puis notifie les quatre parties, crée le lien élève↔professeur et fasse tomber les demandes
   pendantes. Rien de cette étape 4 n'existe.
3. **Le RP ne dispose d'aucun outil de recherche de professeur** : il doit saisir un UUID à la main,
   un candidat à la fois. C'est le point qui rend l'étape 2 inutilisable en pratique.
4. **Le parent n'a pas de sélecteur d'élève** ; le mécanisme existe déjà ailleurs
   (`GET /relations/my-contacts`).
5. **Quatre routes utilisées par le front sont absentes de `docs/routes.md`** (proposals, accept,
   select, pp-change) alors qu'elles existent côté serveur, et **une est absente de la gateway**
   (`/teacher-collaborations/…` → 404 nginx).
6. **Ni `x-correlation-id` ni clé d'idempotence** ne sont émis par le front, sur ce flow comme sur
   tous les autres.

## F. Traces laissées sur la pile réelle

Le diagnostic a créé un compte élève (`diag.eleve.1786486537`,
`diag.eleve.1786486537@example.com`, id `9c7b7836-0fd6-4648-ab6b-ee6bcae0f4ee`) et **quatre
demandes professeur** en statut `pending` rattachées à ce compte. À purger si la base de
démonstration doit rester propre.
