# Front — file de validation des nouveaux formateurs (RP)

**Date** : 2026-08-12
**Branche** : `feat/validation-nouveaux-professeurs`
**Périmètre** : `apps/web/` uniquement

---

## Statut

✅ Livré et vérifié contre la pile réelle.

Le RP dispose d'une file listant les formateurs en attente d'examen, avec les trois
transitions, le commentaire optionnel, l'accès à la fiche complète et la pagination. Elle est
atteignable depuis le rail, depuis le tableau de bord et depuis l'autre file du plan de travail.

Un défaut bloquant a été trouvé et corrigé au passage : **le corps envoyé par le front à
`PATCH /profiles/:teacherId/validation` était refusé en `400`**. La validation d'un formateur
était donc inopérante depuis l'écran, quel que soit le chemin emprunté.

---

## Ce qui a été construit

### 1. La file — `/rp/teacher-validations`

Nouvelle page `TeacherValidationQueuePage`, **RP seul** (le TI est exclu côté serveur : il peut
trancher un dossier depuis la fiche, mais ne dispose pas de la file).

Branchée sur `GET /profiles/teachers/pending-validation`, dont le contrat avait changé :

| | Ce que le front croyait | Ce que le serveur renvoie |
|---|---|---|
| Enveloppe | tableau nu | `{data, page, limit, total, totalPages}` |
| Identifiant | `teacherId` | `userId` |
| Date | `createdAt` | `pendingSince` |
| `id` | présent | supprimé |
| — | — | `levels` / `subjects` ajoutés |

Chaque ligne affiche : prénom + nom, niveaux et matières, date d'inscription formatée, badge
d'état, lien « Voir la fiche » vers `/profiles/:userId`, et les actions autorisées.

### 2. Les actions, sans jamais proposer un refus

Depuis `pending`, le RP ne voit que **« Prendre en charge »**. Valider ou refuser d'emblée est
réservé au TI et recevrait `403` : la règle projet interdit d'afficher une entrée qui mène à un
écran interdit. Elle est portée en un seul endroit (`canTakeChargeFromState` /
`canDecideFromState`) et sert la file **et** la fiche — un même dossier ne peut donc pas offrir
deux jeux d'actions selon l'écran.

Depuis `in_review` : « Valider », « Refuser », et un commentaire dépliable (≤ 2000 caractères).

### 3. L'état appartient à la page

La réponse du `PATCH` remonte à `usePendingTeacherValidations`. Une ligne validée ou refusée
quitte la file sur place ; une prise en charge change l'état de la ligne sans la retirer.
**Aucun rechargement complet** — recharger effacerait la position de lecture du RP au milieu
d'une file de dix-sept dossiers. Vérifié par test : `fetchPendingTeachers` reste appelée une
seule fois après deux transitions successives.

### 4. Le lien avec la seconde file — choix et motif

**Choix retenu : deux entrées de rail voisines dans un groupe « À traiter », plus un bandeau
« Plan de travail » présent sur les deux pages.** Pas une page unique à deux sections.

Motif : les deux files n'ont ni la même source (`profile-service` / `teacher-request-service`),
ni la même pagination, ni le même rythme de traitement. Les fusionner obligerait à charger les
deux pour en consulter une, ce que la règle de chargement au niveau de la page (2026-08-10)
déconseille — et les états de pagination des deux listes cohabiteraient mal dans une page.

La parenté reste visible sans duplication : la liste des files est déclarée **une seule fois**
(`RP_WORK_QUEUES` dans `navigationConfig.ts`) et alimente à la fois le rail, le bandeau et
l'ordre des cartes du tableau de bord. Le rail RP passe donc de :

```
Gestion    → Demandes professeurs, Comptes, Délégations
Validation → Contenus à valider, Demandes rattachement
```

à :

```
À traiter  → Nouveaux formateurs, Demandes professeurs     ← le plan de travail
Gestion    → Comptes, Délégations
Validation → Contenus à valider, Demandes rattachement
```

Le tableau de bord RP annonce en plus « Nouveaux formateurs à examiner » avec son compteur, en
tête des actions, et la statistique rapide « Formateurs à examiner » remplace un « Formateurs
actifs » qui affichait `—` depuis toujours.

---

## Le défaut trouvé : la validation était cassée, silencieusement

Mesuré contre la pile réelle avant toute modification :

```
PATCH /api/v1/profiles/38132407-…/validation
corps envoyé par le front :  {"validationStatus":"in_review"}
→ 400 {"message":["property validationStatus should not exist",
        "Le statut doit être l'un des suivants : pending, in_review, validated, rejected."]}
```

Le serveur attend `{status, comment?}` et répond
`{id, teacherId, status, validatedBy, validatorRole, comment, createdAt, updatedAt}`.

Aucun test ne le voyait : ils vérifiaient que le front envoyait bien le corps erroné. Le type
`TeacherValidationStatus`, le payload, le hook et le composant portaient tous le mauvais nom.
Corrigé partout, avec les noms du serveur (règle « un seul nom par donnée »).

### Deux autres écarts corrigés dans la foulée

- **`TeacherValidationPanel.tsx:133` affichait `validatedBy.slice(0, 8)`** — un fragment d'UUID
  en guise de nom. Remplacé par `usePersonDisplayName` ; quand le nom n'est pas résolvable,
  l'écran affiche « Un responsable », jamais un identifiant de repli.
- **Les libellés d'état étaient recopiés dans le composant.** Sortis dans
  `utils/teacherValidationLabels.ts`, sur le modèle de `teacherRequestLabels.ts`.
- **`TeacherValidationPanel` vivait dans `src/pages/`** sans être monté par le routeur, contre la
  convention du projet. Déplacé dans `src/components/profile/`, avec son test.

---

## Vérification contre la pile réelle

`https://claudevma.visioprof.fr`, compte RP `trsflow.rp.0811`, jeton lu dans `access_token`.

**1. La file n'est pas vide — 17 formateurs réels**

```
GET /api/v1/profiles/teachers/pending-validation?page=1&limit=3
→ 200
{"data":[
   {"userId":"38132407-…","firstName":"prof","lastName":"lycee",
    "levels":null,"subjects":null,"pendingSince":"2026-08-12T15:20:17.694Z"},
   {"userId":"c5027520-…","firstName":"formateur","lastName":"test",
    "levels":null,"subjects":null,"pendingSince":"2026-08-12T15:20:17.703Z"},
   {"userId":"ab8408f8-…","firstName":"prof","lastName":"college",
    "levels":["collège"],"subjects":["mathématiques et physique"],
    "pendingSince":"2026-08-12T15:20:17.708Z"}],
 "page":1,"limit":3,"total":17,"totalPages":6}
```

Les deux cas cohabitent bien en base : `levels`/`subjects` à `null` (non renseigné) et remplis.
L'écran affiche « Niveaux et matières non renseignés » pour le premier, « Niveaux : collège ·
Matières : mathématiques et physique » pour le troisième. Jamais le mot « null ».

**2. Le cycle complet, avec les corps que le front envoie désormais**

```
PATCH /profiles/38132407-…/validation  {"status":"in_review"}
→ 200 {"status":"in_review","validatedBy":"c4219392-…",
       "validatorRole":"responsable_pedagogique"}

PATCH /profiles/38132407-…/validation
      {"status":"validated","comment":"Dossier conforme - verifie depuis la file RP le 2026-08-12"}
→ 200 {"status":"validated","comment":"Dossier conforme - verifie depuis la file RP le 2026-08-12"}
```

**3. La file retombe, et le formateur passe dans les validés**

```
GET /profiles/teachers/pending-validation  → total 17 → 16
GET /profiles/teachers/validated           → total 4 : Theo Chainon, Nadia Lambert,
                                                        Yanis Roche, prof lycee
```

**4. Les refus, en français, affichés tels quels**

```
PATCH /profiles/…/validation  {"status":"validated"}   (RP, depuis pending)
→ 403 "Seul le technicien informatique peut sauter l'étape « en cours d'examen » et passer
       directement de « en attente » à « validé » ou « refusé ». Le responsable pédagogique
       doit d'abord prendre le dossier en charge."

GET /profiles/teachers/pending-validation?limit=101
→ 400 "Le nombre de formateurs par page ne peut pas dépasser 100. Demandez les pages
       suivantes pour obtenir la suite de la liste."
```

C'est précisément l'action que l'écran **ne propose pas** : un RP devant un dossier `pending` ne
voit que « Prendre en charge ».

**5. La pagination**

```
GET /profiles/teachers/pending-validation?page=2&limit=10
→ 200 {"page":2,"totalPages":2}  — 6 lignes
```

---

## Fichiers

### Créés

| Fichier | Rôle |
|---|---|
| `apps/web/src/pages/TeacherValidationQueuePage.tsx` | La file, `/rp/teacher-validations` (101 lignes) |
| `apps/web/src/components/teacher-requests/PendingTeacherCard.tsx` | Une ligne de file (152 lignes) |
| `apps/web/src/components/teacher-requests/RpWorkQueueNav.tsx` | Bandeau « Plan de travail » (50 lignes) |
| `apps/web/src/hooks/teacher-requests/usePendingTeacherValidations.ts` | File paginée, propriétaire de l'état (89 lignes) |
| `apps/web/src/hooks/teacher-requests/useTeacherValidationActions.ts` | Les trois transitions, sans lecture (110 lignes) |
| `apps/web/src/hooks/dashboard/usePendingTeacherValidationCount.ts` | Compteur du tableau de bord (35 lignes) |
| `apps/web/src/utils/teacherValidationLabels.ts` | Libellés FR, couleurs, transitions autorisées (60 lignes) |
| `apps/web/test/pendingTeachers.api.test.ts` | Contrat API (9 cas) |
| `apps/web/test/pages/TeacherValidationQueuePage.test.tsx` | Comportement de la file (17 cas) |

### Modifiés

- `src/api/profile.ts` — `fetchPendingTeachers`, et les deux appels de validation rapatriés
  depuis `teacherRequests.ts` (ce sont des routes `profile-service`).
- `src/api/teacherRequests.ts` — bloc de validation retiré.
- `src/types/profile.ts` — `TeacherValidationState`, `TeacherValidationRecord`,
  `PendingTeacher`, `TEACHER_VALIDATION_COMMENT_MAX_LENGTH` ; contrat corrigé.
- `src/navigation/navigationConfig.ts` — `RP_WORK_QUEUES`, groupe de rail « À traiter ».
- `src/hooks/teacher-requests/useTeacherValidation.ts` — délègue aux actions partagées.
- `src/components/profile/TeacherValidationPanel.tsx` — déplacé, contrat corrigé, UUID retiré.
- `src/pages/TeacherRequestsPage.tsx`, `src/pages/RpDashboardPage.tsx`, `src/App.tsx`.
- Tests : `ProfileRemanenceByRole`, `RpDashboardPage`, `TeacherValidationPanel` (déplacé).

---

## Vérifications

| Contrôle | Résultat |
|---|---|
| `tsc --noEmit` | ✅ 0 erreur |
| `vite build` | ✅ succès |
| Suite complète | ✅ **1527 tests, 128 fichiers, 0 échec** |
| Fichiers > 300 lignes ajoutés | aucun (le plus gros : 152 lignes) |
| UUID affichés | aucun — `expectNoTechnicalIdentifier` sur la file, y compris sans prénom ni nom |

Rappel du projet : la suite front **simule tout le réseau**. Ce sont les appels réels cités
ci-dessus qui font foi.

### Couverture demandée

| Cas | Test |
|---|---|
| Liste peuplée | `affiche les formateurs en attente avec leur nom et leur expertise` |
| Liste vide | `affiche un état vide explicite quand personne n'attend` |
| `null` sur `levels`/`subjects` | `n'affiche jamais « null » pour des niveaux ou matières non renseignés` |
| `[]` distingué de `null` | `traite une liste vide enregistrée comme un non-renseigné à l'écran` |
| `403` | `affiche le message du serveur quand la file est refusée en 403` + sur la décision |
| Pagination | `pagine la file et demande la page suivante au serveur`, `ne pagine pas quand tout tient sur une page` |
| Action interdite non proposée | `n'offre pas au RP la validation directe depuis « en attente »` (file) et `depuis « en attente », n'offre que la prise en charge` (fiche) |
| Pas de rechargement | `retire la ligne validée sans relire toute la file` |

---

## Blocages et risques résiduels

1. **Aucune capture d'écran.** La vérification porte sur les appels réels et sur le vrai code du
   front en test. Le rendu de `/rp/teacher-validations` dans un navigateur reste à constater par
   l'utilisateur — la machine est distante, sans navigateur accessible ici.

2. **Le compte RP de test n'a ni prénom ni nom** (`GET /profiles/c4219392-…` →
   `firstName: null`). Le panneau de fiche affiche donc « Un responsable » comme validateur.
   C'est le repli prévu et il est correct, mais le cas nominal — un validateur nommé — n'est
   couvert que par les tests.

3. **Aucune file « traités ».** Le RP ne peut pas revoir ce qu'il a décidé : il faut passer par
   la fiche du formateur. Une file symétrique de l'onglet « Traitées » des demandes serait le
   prolongement naturel — non demandé ici.

4. **Le TI n'a pas de file.** `GET /profiles/teachers/pending-validation` est RP seul, par
   contrat serveur. Le TI peut trancher un dossier depuis la fiche, mais ne peut pas balayer
   les dossiers. À rouvrir si le besoin apparaît.

5. **Pas de recherche de personne.** Le RP a droit aux fiches de tous, élèves comme formateurs
   (arbitrage du 2026-08-07), mais il n'atteint une fiche que depuis une file ou un contact.
   Point ouvert nommé par l'arbitrage du 2026-08-12, hors périmètre de ce lot.

6. **Défaut XML préexistant** dans `docs/services/frontend-react-app.md` : un `<tabId>` non
   échappé ligne 967 rend le fichier non parsable en XML strict. Antérieur à cette session, non
   corrigé pour ne pas mélanger les sujets — la section ajoutée est bien formée, vérifiée
   isolément.

7. **L'UX sera retravaillée**, comme annoncé. Les points les plus perfectibles : la file est une
   liste plate sans tri ni filtre (17 dossiers aujourd'hui, ce sera insuffisant à 100), et le
   commentaire de refus n'est pas obligatoire dans la file alors qu'il l'est dans la fiche —
   le serveur ne l'exige pas, mais l'incohérence entre les deux écrans mérite un arbitrage.
