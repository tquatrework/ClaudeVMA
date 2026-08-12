# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin — 2026-08-11 — le flow de la demande de professeur

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

`JWT_SECRET` vaut `change_me_with_a_long_random_string_in_production` dans le conteneur en cours
d'exécution, sur une machine **accessible publiquement**. Ce secret signe les jetons de **tous**
les services. Signalé le 2026-08-12, non corrigé.

## État

- [x] Existant relevé, écart établi — 2026-08-11, rapports committés le 2026-08-12
- [ ] Architecture arbitrée et écrite
- [ ] Back
- [ ] Front
- [ ] Déployé sur la pile réelle
- [ ] Preuve livrée à l'utilisateur
- [ ] Validé par l'utilisateur
- [ ] Mergé dans master

---

## Deux PR livrées, prouvées, en attente de merge

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
- [ ] Déployé sur la pile réelle
- [ ] Preuve livrée à l'utilisateur
- [ ] Validé par l'utilisateur
- [ ] Mergé dans master

## Bloqué par
<rien, ou la dépendance précise>
```
