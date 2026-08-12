# Front — flow « demande de professeur » réaligné sur le back refondu

Date : 2026-08-12 · Branche : `feat/flow-demande-professeur` · Périmètre : `apps/web/` uniquement.
Cible de vérification : `https://claudevma.visioprof.fr` (pile réelle).

**Statut : ⚠️** — les 8 étapes du flow sont branchées et **prouvées contre la pile réelle**, sauf
l'annuaire des professeurs de l'étape 3, qui **n'existe pas côté serveur**. Ce point est détaillé
en § 6 ; c'est le seul blocage.

---

## 1. Ce qui a été fait, point par point du brief

| Point du brief | État | Où |
|---|---|---|
| **A** — types alignés sur les réponses réelles | ✅ | `src/types/teacherRequests.ts` réécrit |
| **B** — un seul formulaire de demande | ✅ | `SpecificTeacherRequestForm` et `TeacherRequestPage` supprimés |
| **C** — sélecteur d'élève pour le parent | ✅ | `StudentSelectField` + `GET /relations/my-contacts` |
| **C** — composition de proposition par le RP | ⚠️ | écrit et testé, **annuaire serveur manquant** |
| **C** — lecture des réponses par le RP | ✅ | `GET /teacher-requests/:id/proposals` |
| **C** — validation par le RP | ✅ | `POST /teacher-requests/:id/validate` |
| **C** — boîte de réception formateur + rail | ✅ | `TeacherProposalInbox`, rail « Propositions reçues » |
| **D** — routes supprimées retirées | ✅ | `select`, `stop-request`, `addTeacherCandidate`, `/requests` |
| **D** — `{teacherId}` → `{teacherIds}` | ✅ | `sendTeacherProposals` |
| **D** — corps de `pp-change` corrigé | ✅ | `{studentId, currentPpTeacherId?, description}` |
| **E** — aucun UUID affiché ni saisi | ✅ | 7 emplacements fautifs traités |
| **E** — libellés français en un point unique | ✅ | `src/utils/teacherRequestLabels.ts` |
| **E** — messages d'erreur du serveur affichés | ✅ | `getErrorMessage` partout, + garde anglaise fermée |
| **E** — chargement au niveau de la page | ✅ | 3 chargements concurrents → 1 |
| **E** — pas d'entrée menant à un écran interdit | ✅ | annuler/supprimer réservés au RP |
| **E** — entrée de navigation pour l'élève | ✅ | `TOP_NAV_CONFIG.demandes` |

---

## 2. Preuve contre la pile réelle

Les **URL et les corps exacts** émis par `src/api/teacherRequests.ts` ont été rejoués avec les
comptes `trsflow.*`. Ce n'est pas une simulation : c'est le contrat du front, envoyé au serveur.

### Étapes 1 et 2 — l'élève demande, le RP voit

```
POST /api/v1/teacher-requests   {"description":"Preuve front 2026-08-12 : je bloque sur les integrales par parties."}
→ 201  id=980f6d8b-…  status=pending  studentName="Lea Bertrand"

GET  /api/v1/teacher-requests?scope=open        (élève) → 200, la demande y figure
GET  /api/v1/teacher-requests?scope=open        (RP)    → 200
     {"studentName":"Lea Bertrand","status":"pending","acceptedProposalCount":0,"pendingProposalCount":0}
```

### Étape 3 — envoi groupé à deux formateurs

```
POST /api/v1/teacher-requests/980f6d8b-…/proposals
{"teacherIds":["<Nadia>","<Yanis>"],
 "message":"Eleve de terminale, integrales par parties. Disponible ?",
 "availabilityNote":"Mardi ou jeudi apres 17h",
 "compensationNote":"45 EUR de l heure",
 "responseDeadline":"2026-08-25"}
→ 201  deux propositions, status=pending, teacherName résolu ("Nadia Lambert", "Yanis Roche")
```

`teacherIds` **au pluriel** : le front envoyait `{teacherId}`, un candidat à la fois.

### Étape 4 — le formateur répond, sur l'identifiant de la **proposition**

```
GET /api/v1/teacher-requests?scope=open   (formateur) → 200
    id        = 338d5b72-dbef-4378-a656-da54fd492f3c   ← la PROPOSITION
    requestId = 980f6d8b-749e-4239-86b9-d66e9c612553   ← la DEMANDE
```

C'est exactement le défaut corrigé : l'ancienne inbox ne trouvait jamais de `candidateId` et se
repliait sur `requestId`, postant donc sur `/proposals/<requestId>/accept`.

```
POST /api/v1/proposals/338d5b72-…/accept   → 201  status=accepted  requestStatus=redirected
POST /api/v1/proposals/3c8af36d-…/decline  → 201  status=declined
```

### Étape 5 — le RP lit les réponses

```
GET /api/v1/teacher-requests/980f6d8b-…/proposals   (RP) → 200
    Nadia Lambert   accepted
    Yanis Roche     declined
```

### Étape 6 — le RP tranche, y compris le cas d'erreur

```
POST /api/v1/teacher-requests/980f6d8b-…/validate  {"proposalId":"338d5b72-…","isPrincipalTeacher":false}
→ 409 {"message":"Un lien existe deja entre cet eleve et ce formateur, avec un statut de
        professeur principal different de celui demande. Verifiez qui est le professeur
        principal de cet eleve avant de valider."}
```

Nadia était déjà professeur principal de Lea : le `409` documenté est **réel**, et c'est ce
message français que l'écran affiche — pas un « Une erreur est survenue » générique.

```
POST /api/v1/teacher-requests/980f6d8b-…/validate  {"proposalId":"338d5b72-…","isPrincipalTeacher":true}
→ 201  status=closed  chosenTeacherName="Nadia Lambert"  closedAt=2026-08-12T12:32:49.805Z
```

### Étape 8 — les demandes traitées disparaissent

```
élève scope=open   → 0 occurrence
RP    scope=open   → 0 occurrence
élève scope=closed → 1 occurrence
```

### Filtrage UI — confirmé par le serveur

```
élève PATCH /api/v1/teacher-requests/…/status     → 403
élève DELETE /api/v1/teacher-requests/…           → 403
élève GET   /api/v1/teacher-requests/…/proposals  → 403
```

Ces trois actions ne sont donc affichées **qu'au RP**. Le bouton « Annuler la demande » était
montré à l'élève alors que la route lui répond `403`.

### Parent — sélecteur d'élève et pp-change

```
GET /api/v1/relations/my-contacts   (parent) → 200
    Lea Bertrand    ['finance_owner_of_student']
    Nadia Lambert   ['finance_owner_of_student_of_teacher']
    Yanis Roche     ['finance_owner_of_student_of_teacher']

POST /api/v1/teacher-requests           {"description":"…","studentId":"<Lea>"}          → 201
POST /api/v1/teacher-requests/pp-change {"studentId":"<Lea>","currentPpTeacherId":"<Nadia>","description":"…"} → 201  type=pp_change
```

Le parent obtient donc ses élèves **et** les professeurs de chaque élève sans qu'un seul UUID
n'apparaisse à l'écran.

### Ce que le front envoyait avant est prouvé cassé

```
POST /api/v1/teacher-requests/pp-change  {"currentTeacherId":…,"requestedTeacherId":…,"reason":…}
→ 400 ["Le champ « currentTeacherId » n'est pas attendu par cette route.",
       "Le champ « requestedTeacherId » n'est pas attendu par cette route.",
       "Le champ « reason » n'est pas attendu par cette route.",
       "La description est obligatoire.", …]

POST /api/v1/teacher-requests/980f6d8b-…/select  → 404 "Cannot POST /requests/…/select"
```

---

## 3. Fichiers

### Créés

| Fichier | Rôle |
|---|---|
| `src/utils/teacherRequestLabels.ts` | Point **unique** statut → libellé français + couleur |
| `src/utils/contactSelectors.ts` | `selectFinancedStudents`, `selectTeachersOfStudent` (purs) |
| `src/hooks/teacher-requests/useTeacherRequestList.ts` | Liste + création, un chargement par portée |
| `src/hooks/teacher-requests/useTeacherProposalInbox.ts` | Boîte de réception formateur |
| `src/hooks/teacher-requests/useSelectableTeachers.ts` | Annuaire formateurs — **documente le manque** |
| `src/components/teacher-requests/TeacherRequestForm.tsx` | Le formulaire unique (`description`) |
| `src/components/teacher-requests/StudentSelectField.tsx` | Choix d'un élève par prénom + nom |
| `src/components/teacher-requests/TeacherRequestCard.tsx` | Ligne de liste, titrée par `studentName` |
| `src/components/teacher-requests/TeacherProposalInbox.tsx` | Étape 4 |
| `src/components/teacher-requests/TeacherProposalComposer.tsx` | Étape 3 (sélection multiple) |
| `src/components/teacher-requests/TeacherProposalList.tsx` | Étapes 5 et 6 |
| `test/teacherRequests.api.test.ts` | **Contrat HTTP** : URL et corps des 8 étapes |
| `test/utils/teacherRequestLabels.test.ts` | Complétude des libellés |
| `test/utils/contactSelectors.test.ts` | Sélections sur `my-contacts` |

### Supprimés

`src/pages/TeacherRequestPage.tsx` · `SpecificTeacherRequestForm.tsx` ·
`RpTeacherSearchWorkspace.tsx` · `TeacherCandidatesView.tsx` · `TeacherRequestInbox.tsx` ·
`StopCollaborationRequestForm.tsx` · six hooks (`useSpecificTeacherRequestSubmit`,
`useTeacherCandidates`, `useRpTeacherSearchWorkspace`, `useTeacherRequestInbox`,
`useTeacherRequests`, `useTeacherRequestSummaries`, `useStopCollaborationRequest`) ·
`test/pages/TeacherRequestPage.test.tsx` · `test/pages/TeacherRequestStudentJourney.test.tsx`.

### Réécrits

`src/api/teacherRequests.ts` · `src/types/teacherRequests.ts` ·
`src/pages/TeacherRequestsPage.tsx` · `src/pages/TeacherRequestDetailPage.tsx` ·
`src/components/teacher-requests/ChangePrincipalTeacherDialog.tsx` ·
`src/hooks/teacher-requests/useTeacherRequestDetail.ts` ·
`src/hooks/teacher-requests/useChangePrincipalTeacherRequest.ts` ·
`src/hooks/dashboard/usePendingTeacherRequestCount.ts` · `src/utils/apiError.ts` ·
`src/navigation/navigationConfig.ts` · `src/navigation/routeAccessMap.ts` · `src/App.tsx` ·
`src/pages/ContactsPage.tsx` · `src/pages/RpDashboardPage.tsx`.

---

## 4. Tests — et pourquoi certains étaient à corriger, pas à contourner

**`TeacherRequestStudentJourney.test.tsx` figeait le contrat erroné.** Il vérifiait qu'on postait
`{description}` seul sur `/teacher-requests` — vrai — mais laissait passer sans un mot les six
autres appels du flow, dont trois visaient des routes supprimées. Il est remplacé par
`test/teacherRequests.api.test.ts`, qui vérifie URL **et** corps des 8 étapes, plus l'absence des
helpers du modèle abandonné.

Point de méthode qui vaut pour la suite : **les tests de page mockent `src/api/teacherRequests`,
ils ne peuvent donc pas voir une URL fausse.** Un seul fichier vérifie les URL — c'est celui-là.
Sans lui, `/teacher-requests/requests` serait passé vert.

`RpDashboardPage.test.tsx` : le compteur filtrait `status === 'pending'` côté front, ce qui
masquait les demandes déjà proposées (`redirected`) alors que le RP doit encore les trancher. Il
suit désormais `scope=open`, la portée du serveur.

```
Suite complète : 124 fichiers, 1473 tests, 0 échec
tsc --noEmit    : 0 erreur
vite build      : succès
```

> Ces tests simulent tout le réseau : **ils ne valent pas validation** sur ce projet. C'est le § 2
> qui fait foi.

---

## 5. Taille des fichiers

Aucun fichier du flow ne dépasse 300 lignes. Deux dépassent le seuil de vigilance de 250 :

| Fichier | Lignes | Justification |
|---|---|---|
| `src/pages/TeacherRequestsPage.tsx` | 282 | Porte deux sections de rôle nettement séparées (`TeacherInboxSection`, `TeacherRequestsSection`), chacune sous 140 lignes, plus `ScopeTabs`. Les sortir en fichiers séparerait la page de son état de portée (`scope`), qui leur est commun et que la page possède. À extraire si une troisième section apparaît. |
| `src/hooks/teacher-requests/useTeacherRequestDetail.ts` | 225 | Quatre écritures (proposer, valider, changer le statut, supprimer) sur **la même** ressource, partageant l'état et les messages de la page. Les séparer multiplierait les propriétaires d'un même état — précisément le défaut fermé par l'arbitrage du 2026-08-10. |

Ensuite : `TeacherProposalComposer` 225 · `src/api/teacherRequests.ts` 194 ·
`TeacherRequestDetailPage` 199 · `TeacherProposalInbox` 184.

---

## 6. Blocage — l'annuaire des professeurs n'existe pas

**Aucune route ne permet au RP de lister les formateurs de la plateforme.** Vérifié le
2026-08-12 avec le jeton de `trsflow.rp.0811` :

| Appel | Réponse | Lecture |
|---|---|---|
| `GET /profiles/teachers/pending-validation` | `200 []` | Ne liste que les formateurs **en attente de validation**, c'est-à-dire précisément ceux qu'on ne propose pas |
| `GET /accounts` · `GET /accounts?role=formateur` | `403` | Fermé au RP |
| `GET /relations/my-contacts` | `200 []` | Le RP n'est relié à personne |
| `GET /profiles/teachers` · `/teachers` · `/profiles/search?role=` | `400` / `404` | N'existent pas |

Conséquence : **l'étape 3 reste inutilisable** tant que cette route n'existe pas. Le composeur est
écrit et testé pour une sélection multiple par cases à cocher ; il affiche aujourd'hui « La liste
des professeurs n'est pas encore disponible » et n'offre **aucun champ de repli** — faire saisir
un UUID est interdit par l'arbitrage du 2026-08-09, et c'est ce qui rendait l'étape inutilisable
en pratique de toute façon.

**Ce qui manque, précisément** : une route de listage des formateurs **validés**, accessible au
RP, renvoyant `{userId, firstName, lastName}`. Le socle suffit — c'est déjà ce que
`GET /relations/my-contacts` fait pour les contacts. Le hook `useSelectableTeachers` porte le
constat en commentaire et se remplace en une seule fonction, sans toucher au composeur.

Le brief supposait que le RP pouvait déjà choisir des formateurs sans saisir d'UUID. Le serveur
dit le contraire : conformément à la consigne, je le signale plutôt que de deviner.

---

## 7. Autres points ouverts

- **`pp-change` n'a pas d'écran propre.** La demande créée (`type: "pp_change"`) apparaît dans les
  mêmes listes que les demandes ordinaires, sans rien qui la distingue, et le RP n'a pas d'écran
  pour l'instruire. Le flow arbitré le 2026-08-12 ne couvre pas ce cas.
- **Cinq statuts hérités** (`assigned`, `accepted`, `candidates_published`,
  `candidates_selected`, `candidate_chosen`) sont encore portés par des lignes en base et
  apparaissent à l'écran. Ils sont libellés « … (ancien flow) » plutôt que masqués : une demande
  qui existe doit se voir.
- **Ni `x-correlation-id` ni `Idempotency-Key`** ne sont émis par le front, ici comme ailleurs.
  Le serveur les accepte sur toutes les routes du flow. Écart transverse, non traité dans ce lot :
  il relève de `src/api/client.ts`, seul point d'assemblage des en-têtes.
- **Le RP ne peut pas créer de demande** depuis le front, alors que le serveur l'y autorise —
  faute d'annuaire d'élèves, et parce que le flow ne le prévoit pas. Décision assumée, à rouvrir
  si le besoin apparaît.

## 8. Traces laissées sur la pile réelle

Sur `trsflow.eleve.0811` : une demande clôturée (Nadia Lambert, professeur principal), une
demande `pending` créée par le parent, une demande `pp_change`. S'ajoutent aux traces des
vérifications précédentes.
