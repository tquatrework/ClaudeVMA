# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin

Une donnée enregistrée depuis une page de profil doit **rester affichée**. Ni un changement
d'onglet, ni l'ouverture d'un panneau ne doivent faire réapparaître les valeurs d'avant
l'enregistrement. L'utilisateur doit voir à l'écran ce que le serveur a réellement enregistré —
y compris les champs que le serveur pose lui-même et que le client ne connaît pas
(`filledBy`, `filledAt`, `avatarUrl`).

Le besoin vaut pour les deux blocs, **administratif et pédagogique**, ainsi que pour la
prescription. Il a été révélé par la photo de profil, mais il ne lui est pas propre.

## Comment on saura que c'est fait

Sur `https://claudevma.visioprof.fr`, parcours joué contre la pile réelle :

1. un élève enregistre un champ du profil administratif, passe sur un autre onglet, revient →
   la valeur enregistrée est toujours là, **sans rechargement de page** ;
2. même chose sur le profil pédagogique ;
3. un RP rédige la prescription → `filledBy` et `filledAt` s'affichent **immédiatement**, ce qui
   prouve que l'écran lit la réponse du serveur et non le corps qu'il vient d'envoyer ;
4. la photo envoyée reste visible au retour sur son onglet.

Ni tests verts, ni PR ouverte ne valent preuve.

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
