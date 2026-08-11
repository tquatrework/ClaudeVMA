# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Aucun objectif en cours

Le précédent est mergé. La prochaine demande de l'utilisateur ouvre le suivant.

## Deux candidats prêts, par ordre d'urgence

### 1. Chaque redéploiement d'un service back casse l'application en silence

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
