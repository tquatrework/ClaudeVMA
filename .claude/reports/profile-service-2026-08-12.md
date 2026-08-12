# profile-service — 2026-08-12

Branche : `feat/flow-demande-professeur` (poussée sur `origin`).
Périmètre : les deux besoins remontés par `teacher-request-service` pour le flow
« demande de professeur » — résolution de nom entre services, et création du lien élève↔formateur.

---

## Réponse directe à la question posée

> « Le contrat de création de relation attendu par `teacher-request-service` correspond-il au tien ? »

**Oui pour le nom et pour la forme. Non pour la politique d'erreur — et c'est chez lui qu'il faut
corriger, sans urgence.**

| | Ce qu'attend l'appelant | Ce que j'expose | Verdict |
|---|---|---|---|
| Chemin | `POST /internal/create-teacher-student-relation` | idem | ✅ |
| En-têtes | `X-Internal-Secret`, `x-correlation-id`, `content-type` | idem (le `x-correlation-id` est accepté, non requis) | ✅ |
| Corps | `{teacherId, studentId, isPrincipalTeacher}` | idem — UUID tous deux, `isPrincipalTeacher` optionnel, `false` par défaut | ✅ |
| Réponse succès | `201 {teacherId, studentId, isPrincipalTeacher}` | **201 création / 200 rejeu**, même corps | ⚠️ voir ci-dessous |
| Doublon | `409`, **traité comme un succès** | plus de `409` sur un rejeu à l'identique | ⚠️ à corriger chez lui |

`isPrincipalTeacher` est bien accepté à la création : confirmé.

### Ce qu'il faut corriger chez `teacher-request-service`

Le client teste `response.status === 409` et **retourne comme si tout allait bien**. Ce branchement
était un contournement légitime tant que la route n'était pas idempotente — elle l'est désormais.

1. **Aucun changement n'est urgent** : le client teste `response.ok`, qui couvre `200` comme `201`.
   Rien ne casse.
2. **La branche `409 → succès` doit disparaître.** Elle est devenue inatteignable sur un rejeu, et
   surtout elle est maintenant **dangereuse** : le seul `409` que je renvoie encore signale un
   **vrai conflit** — le lien existe avec un statut de professeur principal **différent** de celui
   demandé. L'avaler ferait croire au RP que sa validation a désigné un professeur principal alors
   qu'elle n'a rien changé. Ce cas doit remonter comme un échec, au même titre qu'un `500`.

Extrait concerné, `services/teacher-request-service/src/teacher-request/clients/profile-service.client.ts` :

```ts
if (response.status === 409) {
  this.logger.log(`Lien eleve↔formateur deja existant (${link.teacherId} ↔ ${link.studentId})`);
  return;   // ← à supprimer : un 409 est désormais un vrai conflit
}
```

### Point de contrat qui manque, et qui est de son côté

`POST /internal/create-teacher-student-relation` **ne transporte pas l'identité du RP qui valide**.
L'événement `TeacherLinkedToStudent` que je publie porte donc `actorId: null`, alors que le chemin
humain (`POST /relations/teacher-student`) porte l'acteur. Un lien qui ouvre des droits de lecture
réels mériterait de savoir **qui** l'a décidé. Correctif sans rupture : un champ optionnel
`validatedBy` dans le DTO, rempli par `teacher-request-service`. Consigné en point ouvert ; je ne
l'ai pas ajouté unilatéralement, il n'y a pas d'appelant pour le remplir aujourd'hui.

---

## 1. Résolution de nom — routes créées

### `GET /internal/profiles/:userId/display-name`

```
GET /internal/profiles/:userId/display-name
Headers : X-Internal-Secret (requis), x-correlation-id (accepté, propagé)

200 {userId, firstName, lastName}   // valeurs string | null
400 userId non-UUID
401 secret absent ou invalide
404 userId inconnu de identity-access-service
500 compte connu MAIS sans profil administratif (incohérence de données)
```

Sans lecteur, sans filtrage champ par champ, volontairement.

**La contrainte est écrite noir sur blanc à quatre endroits**, et tenue par deux tests :

- `src/internal/display-name.ts` — le fichier de contrat s'ouvre sur l'interdiction ;
- `src/internal/internal.controller.ts` — TSDoc de la route + `@ApiOperation` ;
- `src/internal/internal.service.ts` — TSDoc de la méthode ;
- `docs/routes.md` — ligne du tableau.

Les deux tests (unitaire et e2e) comparent la **liste exacte des clés** de la réponse à
`['firstName', 'lastName', 'userId']`. Ajouter un champ casse la suite immédiatement — c'est
l'objet du garde-fou, pas un effet de bord.

### `POST /internal/profiles/display-names`

```
POST /internal/profiles/display-names
Body : {userIds: string[]}   // UUID, 200 maximum

200 {displayNames: [{userId, firstName, lastName}]}
400 liste vide, au-delà du plafond, ou identifiant non-UUID
401 secret absent ou invalide
```

Trois choix, tous délibérés :

1. **`POST` pour une lecture, donc `200` explicite.** Le corps porte la liste, qu'une query string
   ne transporte pas sans limite de longueur. Aucune ressource n'est créée : répondre `201` aurait
   été un mensonge.
2. **Plafond déclaré (200 identifiants).** Une liste non bornée transformerait un appel
   interservices en requête SQL arbitrairement large. La règle du 2026-08-10 sur les plafonds
   cachés vaut au-delà des envois de fichiers.
3. **Un `userId` sans profil est absent de la réponse, il ne fait pas échouer le lot.** Un
   identifiant douteux ne doit pas priver l'appelant des N−1 autres noms. L'anomalie n'est pas
   silencieuse : un log serveur nomme les identifiants omis.

Une seule requête SQL quel que soit N (`AdministrativeProfileLookupService.findNamesByUserIds`,
qui servait déjà les listes de relations). Ordre d'entrée conservé, doublons réduits à une entrée.

### Traitement de l'absence de profil administratif

J'ai repris la discipline établie le 2026-08-07 pour `GET /profiles/:userId` plutôt que de répondre
un `404` commode :

- `userId` inconnu de `identity-access-service` → **404** ;
- compte **connu** sans profil administratif → **500**, l'incohérence reste visible et n'est ni
  réparée à la volée ni masquée par un nom vide ;
- `identity-access-service` injoignable → **500** également, **jamais 404** : une panne ne doit pas
  faire passer tous les profils de la plateforme pour supprimés.

L'appel sortant n'a lieu **que** sur ce chemin d'erreur. Le cas nominal ne sort pas du service.

---

## 2. Lien élève↔formateur — idempotence

`RelationsService.createTeacherStudentLinkForSystem` devient `ensureTeacherStudentLinkForSystem` et
renvoie `{link, isCreated}`. Le nom dit maintenant ce que la méthode fait.

- **Rejeu à l'identique → `200`**, le lien existant est renvoyé tel quel. Pas de second lien, pas
  d'erreur, pas de nouvel événement.
- **Création → `201`.**
- **`409` conservé sur le seul cas qui n'est pas un rejeu** : lien existant avec un
  `isPrincipalTeacher` différent. Répondre `200` en ignorant le champ reviendrait à l'accepter puis
  le jeter en silence — le défaut fermé par le corollaire du 2026-08-09. Ce cas était **déjà** un
  `409` avant cette session : aucun comportement ne régresse, la sémantique devient honnête.

Le code de statut est posé via `@Res({ passthrough: true })`. Ce mécanisme dépend du comportement de
Nest, il ne se prouve donc pas en test unitaire : **il est vérifié en e2e contre une vraie
application Nest**, avec la vérification qu'un seul lien existe en base après deux appels.

### Rappel de cohérence — ce que j'ai trouvé au passage

**Le chemin système ne publiait aucun événement.** `createTeacherStudentLinkForSystem` avait été
écrit pour l'onboarding, où le lien formateur↔élève n'existe pas encore ; le commentaire disait
explicitement « without a role check **or event publication** ». Le chemin humain
(`linkTeacherToStudent`) publiait, lui, `TeacherLinkedToStudent`.

Depuis l'arbitrage du 2026-08-12, **le lien du flow naît de cette route** et non plus d'une action
RP directe. Laisser le chemin système muet aurait rendu toute création invisible à
`dashboard-notification-service` le jour où il s'y abonne — exactement la contrepartie « non
négociable » du point 7 de l'arbitrage. L'événement est désormais publié dans les deux cas, avec la
même charge utile (`actorId: null` sur le chemin système, voir le point ouvert plus haut).

Pour le reste, rien ne court-circuite les règles existantes : la route passe par `RelationsService`,
propriétaire de la donnée ; rien n'écrit `teacher_student_links` en dehors de lui ; le lien créé est
strictement le même objet que celui du chemin humain, donc les droits qu'il ouvre (statistiques,
archives pédagogiques, `my-contacts`, `GET /internal/relations/...`) sont les mêmes.

---

## 3. Tests

| Suite | Avant | Après |
|---|---|---|
| Unitaires | 500 / 18 suites | **538 / 18 suites, tous verts** |
| E2E `internal` | 40 | **57, tous verts** |
| E2E complet | — | **269 verts / 270**, 1 rouge **préexistant** |

Cas d'erreur couverts pour chaque route ajoutée, comme demandé : secret absent, secret invalide,
JWT présenté à la place du secret, `userId` inconnu, compte sans profil administratif,
`identity-access-service` injoignable, non-UUID, liste vide, lot au-delà du plafond, rejeu,
conflit de professeur principal.

**L'échec e2e est antérieur à cette session** : « [PROF-BR-010] Un administrateur financier peut
ajouter une note interne » attend `201`, reçoit `403`. Il est **laissé en échec à dessein** depuis
une session précédente, en attente d'un arbitrage (`NOTES_WRITE_ROLES` ne contient que RP et AP,
alors que `docs/acceptance-criteria.md:37` annonce l'AF). Vérifié en rejouant le test sur l'arbre
pré-session : même échec, à l'identique. Je ne l'ai pas touché.

---

## 4. Documentation

- `docs/routes.md` — les deux nouvelles routes, la politique `201/200/409` de la création de lien,
  et la mise à jour du tableau « ce que `teacher-request-service` demande à `profile-service` », qui
  annonçait encore la route de nom comme « à créer ».
- `docs/services/profile-service.md` — décision **C18** (contexte, fichiers touchés, décisions,
  vérification), entrées `candidateApis`, et mise à jour du point ouvert sur l'idempotence des
  méthodes `*ForSystem`, désormais **partiellement** résolu.

### Signalement d'authentification, comme demandé

Les routes ajoutées sont protégées par `X-Internal-Secret` et **ne sont pas exposées par
`api-gateway`** — l'arbitrage l'exige, et c'est leur seconde protection.

⚠️ **Comportement préexistant à connaître** : `InternalGuard` (`src/internal/internal.guard.ts`),
si `INTERNAL_SECRET` **n'est pas configuré**, journalise un avertissement puis **laisse passer**.
Toutes les routes `/internal/*` sont alors **sans authentification**. Ce n'est pas nouveau et je ne
l'ai pas modifié — mais la surface exposée par ce défaut vient de s'élargir à la résolution de nom,
d'où le signalement explicite ici et dans `docs/routes.md`. À traiter comme un durcissement de
déploiement (secret obligatoire au démarrage), pas comme un correctif de cette session.

---

## 5. Ce qui reste

1. **Preuve contre la pile réelle non produite.** Le conteneur `visiomath_profile` n'a pas été
   reconstruit — hors périmètre d'un agent de service. Tant que l'image ne l'est pas,
   `https://claudevma.visioprof.fr` ne porte pas ce code. Les tests e2e tournent contre une vraie
   base PostgreSQL, ce qui n'est pas la même chose qu'une preuve contre la pile déployée.
2. **`teacher-request-service` doit retirer sa branche `409 → succès`** (voir plus haut).
3. **`actorId: null`** sur l'événement du chemin système, faute d'un champ transportant le RP.
4. **`POST /internal/link-parent` et `POST /internal/link-coordinator` répondent toujours `409` sur
   doublon.** Les aligner sur le même modèle est le geste évident ; non fait ici pour ne pas
   modifier des routes hors du périmètre demandé.
5. **Aucune limite de débit** sur la résolution de nom. Protégée par le secret et non exposée par la
   gateway, mais elle permet, pour qui détient le secret, d'énumérer des noms. À reconsidérer si le
   secret devait être partagé plus largement.
