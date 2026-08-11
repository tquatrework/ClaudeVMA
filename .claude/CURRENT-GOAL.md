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
