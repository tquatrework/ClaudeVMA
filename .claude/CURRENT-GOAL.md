# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin

Deux demandes de l'utilisateur du **2026-08-11**, après sa validation de la permanence côté
élève (« cela fonctionne, pour les élèves au moins ») :

**1. Étendre la vérification de permanence aux autres rôles.** Parent, formateur, AP et RP
doivent être traités exactement comme l'élève : une donnée enregistrée reste affichée, un
changement d'onglet ne la fait pas disparaître. À vérifier écran par écran, pas à supposer
depuis le fait que le mécanisme est générique.

**2. Corriger le contenu des formulaires de l'élève** — cinq modifications :

| # | Bloc | Demande |
|---|---|---|
| 1 | administratif | **ajouter l'email** (existe sans doute déjà à l'inscription, mais n'est pas affiché) |
| 2 | administratif | **supprimer « Département »** |
| 3 | pédagogique | **ajouter « Établissement »** |
| 4 | pédagogique | **séparer en deux champs : « Contexte familial » et « Contexte scolaire »** |
| 5 | pédagogique | **ajouter « Matériel »** (lieu des cours, équipement) |

L'utilisateur demande en fin de travail la **liste des fichiers et dossiers touchés**, front et
back.

## Point d'architecture soulevé par la demande 1 — email

`email` appartient à **`identity-access-service`**, pas à `profile-service` : c'est une donnée du
compte (`{id, loginIdentifier, email, role}`), au même titre que `loginIdentifier`, et
l'arbitrage du 2026-08-08 a acté que les deux ne sont pas un doublon. **Ajouter une colonne
`email` à `profile-service` recréerait le problème d'appartenance déjà tranché pour
`firstName`/`lastName`/`phone`.** L'affichage doit donc lire le compte, pas dupliquer le champ.

## Comment on saura que c'est fait

Sur `https://claudevma.visioprof.fr`, parcours joué contre la pile réelle, capture ou réponse
HTTP citée :

1. le formulaire administratif d'un élève affiche son email et **ne comporte plus** de
   « Département » ;
2. le formulaire pédagogique porte « Établissement », « Contexte familial », « Contexte
   scolaire » et « Matériel », chacun enregistrable et **rémanent** au changement d'onglet ;
3. un compte de chaque autre rôle — parent, formateur, AP, RP — enregistre une donnée, change
   d'onglet, revient : la valeur tient.

Ni tests verts, ni PR ouverte ne valent preuve.

## État au 2026-08-11

- [x] **Back codé, migré, déployé** — `visiomath_profile` reconstruit. `schoolName` (200),
      `familyContext` / `schoolContext` / `equipment` (2000, texte long), tous **hors socle** de
      visibilité (`self` par défaut). `department` et `context` supprimés : les envoyer renvoie
      `400 property … should not exist`. Migration sans perte : 5 → 5 lignes pédagogiques,
      24 → 24 administratives, `pg_dump` pris avant.
- [x] **Donnée ambiguë tranchée par l'utilisateur** — l'ancien `context` valait
      `"une jumelle\nlycée des Graves"`. Sur sa demande, `UPDATE 1` dans une transaction :
      `schoolName = 'lycée des Graves'`, `familyContext = 'une jumelle'`.
- [x] **Front codé** — les 4 champs, `department` et `context` retirés, e-mail affiché.
- [x] **Permanence des autres rôles : vérifiée, aucun correctif nécessaire.** Le mécanisme
      d'appartenance de l'état à la page couvrait déjà parent, formateur, AP et RP. 18 cas
      ajoutés dans `apps/web/test/pages/ProfileRemanenceByRole.test.tsx`, chacun vérifiant
      quatre propriétés : réponse serveur réaffichée (le serveur simulé répond volontairement
      autre chose que la saisie), aller-retour d'onglet sans perte, `GET /profiles/:userId`
      appelé **une seule fois**, saisie conservée avec message français en cas de refus.
      Il manquait la vérification, pas le correctif.
- [x] **Front déployé** — bundle `index--GUGb3O2.js` servi publiquement, portant `schoolName`,
      `familyContext`, `schoolContext`, `equipment` et leurs libellés français ; `department`
      **absent** (0 occurrence).
- [x] **Validé par l'utilisateur** — 2026-08-11, après son test manuel sur la pile réelle
      (« très bien, c'est bon »).
- [ ] Mergé dans master — PR #92, **retenue à sa demande** : deux changements d'écran à livrer
      avant le merge, ci-dessous.

## Deux changements demandés avant le merge — 2026-08-11

Verbatim de l'utilisateur :

> 1. les statistiques pédagogiques doivent aller dans Stats/Archives (et pas dans le profil)
> 2. le profil financier (qui apparait dans le profil administratif avec un bouton gérer, doit
>    en fait être un troisième onglet : profil financier, aussi bien pour les parents que pour
>    les formateurs.

Les deux relèvent du **placement des écrans**, pas du contenu des données : rien à changer côté
services. Ils restent sur la branche `feat/champs-profils-eleve`, puisque l'utilisateur les veut
avant le merge — une branche par besoin métier, pas une par lot.

Contrainte qui s'applique aux deux : le profil financier devenant un onglet de la fiche, il entre
dans le périmètre de la règle de permanence. Son état doit appartenir à la page, l'onglet reste
monté une fois activé, et la réponse d'écriture est réaffichée telle que le serveur la renvoie.

Conséquence sur un point déjà signalé : `FinancialProfilePage.tsx:178` affiche « Identifiant
propriétaire » sous forme d'UUID au parent, au formateur, à l'AP et au RP. Déplacer cet écran
dans la fiche de profil rend ce défaut plus visible ; il est corrigé au passage, puisqu'on
touche précisément ce code — la règle « aucun UUID à l'écran, sauf AF » est générale.

### État au 2026-08-11 — livré et déployé, en attente du test utilisateur

- [x] **Statistiques pédagogiques sorties du profil.** La destination existait déjà : l'entrée
      de navigation « Stats / Archives » (`TOP_NAV_CONFIG`, id `archives`) mène à `/archives`,
      dont le **premier onglet** rendait déjà `ProfileStatisticsPanel`. La fiche de profil en
      portait un **second exemplaire** — c'est celui-là qui est retiré. Aucun fichier supprimé,
      rien de dupliqué.
- [x] **Profil financier devenu un onglet**, après « Profil pédagogique ». Le bouton « Gérer »
      a disparu du profil administratif. Effet de bord corrigé : « Gérer » s'affichait au
      formateur et à l'AP alors que `/finance` leur est fermée — il les menait à `/forbidden`.
      L'onglet n'emprunte aucune route.
- [x] **UUID « Identifiant propriétaire » corrigé** — nom du titulaire via `usePersonDisplayName`,
      référence technique réservée à l'AF. Vérifié absent du bundle servi (0 occurrence).
- [x] **Blocage back levé.** `finance-credit-service` refusait le rôle `formateur` sur son
      **propre** profil financier (`403 Insufficient role`), le `RolesGuard` filtrant sur une
      liste de rôles **avant** le contrôle de propriété. Les trois routes de lecture par
      propriétaire portent désormais `@OwnerAccess()` : le contrôle porte sur la propriété, pas
      sur une liste qui oublie un rôle à chaque évolution — `animateur_pedagogique` est couvert
      par construction. Formateur sur son propre id : `404` (profil à créer) au lieu de `403`,
      archives `200 []`. Sur un tiers : toujours `403`. Écriture inchangée.
      Défaut corrigé au passage : `findByOwnerId` levait le `404` **avant** le contrôle de
      permission, révélant l'existence d'un profil à un appelant non autorisé.
- [x] **Déployé** — `frontend` et `finance-credit-service` reconstruits depuis la branche.
      Bundle servi `index-CtxbcIKG.js` : « Profil financier » présent, « Identifiant
      propriétaire » absent. Conteneur finance `healthy`, image porteuse du correctif.
- [ ] **Validé par l'utilisateur**

### Décisions qui lui reviennent, remontées et non prises

1. **L'AP n'a plus aucun chemin vers les statistiques.** `TOP_NAV_CONFIG` affiche « Stats /
   Archives » à l'`animateur_pedagogique`, mais `routeAccessMap.ts` et la route `/archives` ne
   le listent pas : l'entrée le mène à `/forbidden`. Anomalie **préexistante**, devenue
   conséquente maintenant que les statistiques ne sont plus dans le profil. Côté serveur,
   `/profiles/:id/statistics` lui est ouvert, les archives pédagogiques non. Ouvrir la route ou
   retirer l'entrée : décision utilisateur.
2. **Le formateur voit son profil financier mais ne peut rien y saisir.**
   `PATCH /financial-profiles/:ownerId` lui reste fermé, alors que la spec du service lui promet
   l'écriture sur son profil (coordonnées bancaires, tarifs). Non tranché, non ouvert.
3. **L'`animateur_pedagogique` ne peut pas soumettre de demande de rémunération** —
   `POST /teacher-payment-requests` reste réservé au rôle `formateur`.
4. **Deux portes vers le même contenu pour le parent** : le rail gauche garde une entrée
   « Profil financier » → `/finance`, en plus du nouvel onglet. Ce n'est pas le doublon visé par
   la demande, donc laissé en l'état.
5. **Cinq comptes de vérification laissés sur la pile** : `front.check.0811`, `front.fin.0811`,
   `front.fin.parent.0811`, `verif.fin.teacher.0811`, `verif.fin.parent.0811`. Aucune route de
   suppression n'existe ; un TI peut les suspendre.

## E-mail : arbitrage rendu, à confirmer

Provenance : la **session authentifiée**. `POST /auth/login` (201) et `GET /auth/me` (200)
renvoient déjà `{id, loginIdentifier, email, role, validationStatus, emailVerified}`. Aucun
appel supplémentaire, **aucun champ demandé à `profile-service`** — l'arbitrage du 2026-08-08
est tenu.

Deux choix retenus, tous deux fondés sur des réponses réelles :

1. **Lecture seule.** Aucune route ne modifie l'e-mail d'un compte : `PUT /accounts/:id` → `404`,
   et `PUT /profiles/:id/administrative {email}` → `400 property email should not exist`. Un
   champ de saisie aurait accepté une frappe pour la jeter — le défaut que ce projet corrige
   depuis des jours.
2. **Son propre profil seulement.** `GET /accounts/:id` par le titulaire lui-même → `403
   Insufficient role` (route réservée TI/RP/AF), et `GET /profiles/:userId` ne renvoie pas
   l'e-mail. Le front n'a donc **aucune source** pour l'e-mail d'un tiers. S'y ajoute que
   `email` n'est **pas au catalogue de visibilité** : son titulaire ne pourrait pas le masquer.
   Faute de pouvoir le protéger, on ne l'expose pas.

**À trancher par l'utilisateur s'il le souhaite** : ouvrir l'e-mail d'un tiers au RP/TI/AF
supposerait un appel à `GET /accounts/:accountId` et l'entrée d'`email` au catalogue de
visibilité. Non fait.

## Effet de bord constaté le 2026-08-11 — les agents ne peuvent plus écrire leur rapport

Le retrait de `Write(.claude/reports/**)` (commit `0b10e76`, PR #91) empêche la **création** d'un
rapport : `Edit` exige un fichier existant. L'agent front n'a donc pas pu déposer le sien et a
rendu ses conclusions directement. À arbitrer : rétablir `Write` sur ce dossier, ou acter que les
rapports vivent désormais dans `docs/services/<service>.md`.

## Reste à traiter, hors objectif courant

- **UUID encore affichés**, en contradiction avec la règle « aucun UUID à l'écran sauf AF » :
  `FinancialProfilePage.tsx:178` (« Identifiant propriétaire ») visible du parent, du formateur,
  de l'AP et du RP ; `TeacherValidationPanel.tsx:133` (`validatedBy.slice(0,8)` en guise de nom,
  alors que `usePersonDisplayName` existe) ; et celui déjà connu dans « Formateurs liés ».
- **Compte de vérification laissé sur la pile** : `front.check.0811`, rôle élève, créé pour
  obtenir les réponses HTTP citées. Aucune route de suppression n'existe ; un TI peut le
  suspendre.
- **6 tests front en échec, préexistants et sans lien** : `ParentLinkRequestsInboxPage` (3) et
  `ParentLinkRequestPage` (1) attendent encore un `parentId` brut à l'écran — l'interface a cessé
  d'afficher les UUID, ce sont les **tests** qui sont périmés ; `WorkflowStatusPage` (1) et
  `HealthStatusPage` (1).

## Objectif précédent, clos le 2026-08-11

Permanence des champs côté élève : **validé par l'utilisateur** après son propre test manuel sur
la pile réelle. Lots #87 (mauvais niveau, annulé), #88 (appartenance d'état, onglets gardés
montés), #89 (généralisation à tous les champs) mergés ; front reconstruit et déployé le
2026-08-11, bundle `index-D5m4QIQi.js` servi publiquement, marqueurs `onAdministrativeSaved` /
`onPedagogicalSaved` présents alors qu'ils étaient absents du bundle précédent.

## Cause tranchée — erreur d'appartenance d'état, pas de fraîcheur

Trois lots successifs, dont le premier a corrigé au mauvais niveau :

- **#87** — relecture backend à chaque clic de menu. Masquait le symptôme au prix d'une requête
  par clic. **Annulé** par le lot suivant.
- **#88** — vraie cause : `ProfileAvatarField` détenait seul l'`avatarUrl` renvoyée par l'envoi,
  et `TabPanel` rendant `null` sur un onglet inactif, le composant était démonté et la valeur
  perdue. La page détient désormais la donnée ; un onglet est monté à sa première activation
  puis **reste monté**, masqué en CSS (`hidden` + `aria-hidden`).
- **#89** — généralisation à **tous les champs** : les trois écritures de profil jetaient la
  réponse du serveur et ne lisaient que le code de succès. La réponse est maintenant fusionnée
  **bloc par bloc** dans l'état détenu par la page, sans nouvelle requête. Même défaut corrigé
  sur les commentaires d'enregistrement vidéo, qui fabriquaient la ligne au lieu de lire le 201.

Règle inscrite dans `docs/architecture.md` (« Chargement des données et état des écrans »), avec
la formulation erronée du 2026-08-10 explicitement annulée et conservée, et le corollaire 3bis :
**on réaffiche la réponse reçue, jamais le corps envoyé** — les réponses d'écriture sont plates
(`{userId, ...champs}`), `GET /profiles/:userId` renvoie une enveloppe, d'où la fusion bloc par
bloc et jamais par écrasement.

## État

- [x] Codé et committé — PR #87, #88, #89, toutes mergées dans `master`
- [ ] **Déployé sur la pile réelle — NON.** Constaté le 2026-08-11 : l'image
      `claudevma-frontend` a été construite le 2026-08-10 à 22:18 UTC, soit **31 min avant** le
      merge de #89 (22:49 UTC). Vérifié sur le bundle réellement servi
      (`assets/index-k0kEqqbm.js`) : `aria-controls` (marqueur de #88) est **présent**, mais
      `onSaved` / `onAdministrativeSaved` / `onPedagogicalSaved` (marqueurs de #89) sont
      **absents** — les noms de propriétés ne sont pas manglés dans ce bundle (`avatarUrl`,
      `hiddenFields`, `filledBy` s'y retrouvent), le contrôle est donc concluant.
      Conséquence en ligne aujourd'hui : la photo et le changement d'onglet sont corrigés, mais
      **les autres champs enregistrés affichent encore les valeurs d'avant l'écriture**.
- [ ] Preuve livrée à l'utilisateur
- [ ] Validé par l'utilisateur

## Prochaine action

Reconstruire et relancer le conteneur `frontend` depuis `master`, puis jouer le parcours
ci-dessus. La reconstruction coupe brièvement l'accès au site : **à faire valider par
l'utilisateur avant**, demandé le 2026-08-11, réponse non reçue à ce jour.

## Reste à traiter, hors objectif courant

- **Un UUID s'affiche encore** dans le bloc « Formateurs liés » de la fiche profil
  (`36c4b5b8-ac5…`), en contradiction avec la règle « aucun UUID à l'écran, sauf AF ».
  Repéré le 2026-08-09, **non corrigé**.
- **Redimensionnement de la photo dans le navigateur avant envoi** : supprimerait l'échec à
  1 Mo au lieu de l'expliquer (~150 Ko pour une photo de 5 Mo). Le HEIC des iPhone resterait
  refusé. Choix produit non tranché.

---

## Dernier objectif clos — photo de profil, mergé le 2026-08-10 (PR #86)

**Besoin** : voir et changer sa photo de profil, gérée par l'application elle-même.

**Arbitrage rendu et inscrit dans `docs/architecture.md`** : volume Docker nommé
(`claudevma_media_data`, monté sur `/app/storage/media`), porté par `profile-service`, servi par
une **route authentifiée appliquant le filtrage de visibilité** — un fichier servi en statique
par nginx court-circuiterait ce filtrage. Un média masqué renvoie **404**, jamais 403. MinIO
écarté (disproportionné), `archive-document-service` écarté (une archive se conserve, une photo
se remplace). Le front ne connaît **jamais** un chemin de fichier, seulement une route.

**Preuve livrée le 2026-08-10**, jouée contre `https://claudevma.visioprof.fr`, donc à travers
`nginx-global` puis `api-gateway` : JPEG 1600×1200 porteur d'EXIF `Artist`/GPS ressort en
**WebP 512×512 de 548 octets, EXIF absent** ; formateur lié lit (`200`) mais ne peut ni remplacer
ni supprimer (`403` en français) ; SVG refusé (`400`) ; `avatarUrl` glissé dans
`PUT /administrative` refusé (`400`) ; remplacement → jeton `?v=` changé et **un seul fichier**
sur le volume ; suppression → `204`, relecture `404`, `avatarUrl: null`, zéro fichier ; photo
passée en « moi seul » → formateur `404` sur les octets et `avatarUrl` **absent** du bloc, nommé
dans `hiddenFields`.

**Plafond de 1 Mo — assumé et annoncé.** On ne touche pas à `nginx-global` pour l'instant : sa
reconstruction interromprait tous les sites hébergés. Limite applicative à **1 000 000 octets**
(sens SI), ~48 Ko sous le 1 Mio de nginx, pour que le refus vienne toujours de l'application avec
un message français. Trois plafonds étaient empilés ; celui d'`api-gateway` (1 Mio par défaut,
non déclaré) a été découvert et porté à `10m` avec un `error_page 413` répondant en JSON.
`GET /profiles/avatar/constraints` permet au front de lire la limite au lieu de la coder en dur.
**Quand `nginx-global` sera relevé** (`client_max_body_size 10m;` dans le **seul** bloc `server`
de `claudevma.visioprof.fr`, jamais au niveau `http`), il suffira de relever
`MEDIA_MAX_UPLOAD_BYTES`. L'ordre est impératif : proxy d'abord, application ensuite.

**Deux leçons à ne pas reperdre :**
1. Un `Content-Type: application/json` posé **par défaut sur l'instance axios** casse
   silencieusement tout envoi de fichier : axios 1.7.2 convertit alors le `FormData` en JSON et
   le fichier est perdu à l'émission. Corrigé **au centre** (`client.ts` retire l'en-tête dès que
   le corps est un `FormData`), pas chez chaque appelant. Un test de régression vérifie le
   Content-Type **réellement émis**, jusqu'à `XMLHttpRequest`.
2. « Les PNG ne sont pas acceptés » était un **plafond de taille** qui refusait sans se nommer,
   par une page HTML nginx sans un mot de français. Le PNG est le plus exposé parce qu'il est
   sans perte. Un plafond qui ne se nomme pas sera toujours attribué à autre chose que lui-même.

**Validation utilisateur** : il a choisi de tester lui-même, à la main, après le merge — fait le
2026-08-10.

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
