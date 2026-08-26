# pedagogical-log-service — 2026-08-26 — Liens et pièces jointes sur le cahier de texte

## Contexte

Implémentation de l'arbitrage d'architecture rendu par l'orchestrateur le 2026-08-26
(`docs/architecture.md`, section "Liens et pièces jointes sur une entrée de cahier de texte, et
paramètres système associés"). Périmètre de ce sous-agent : tout sauf le réglage TI de la photo de
profil, délégué séparément à `profile-service` (voir branche `feat/profile-service-media-settings`,
non lue par ce sous-agent, conforme à la règle "ne jamais lire le code source d'un autre service").

Branche utilisée : `feat/cahier-de-texte-liens-pieces-jointes`, déjà créée par l'orchestrateur
(commit `3599b77`, arbitrage + `CURRENT-GOAL.md`) et poussée sur `origin` avant le début de ce
travail. Ce worktree isolé ne pouvait pas faire `git checkout` sur cette branche (déjà extraite
ailleurs) : le travail a été fait sur la branche propre au worktree, fast-forwardée depuis
`3599b77`, puis le commit final a été poussé directement sur
`origin/feat/cahier-de-texte-liens-pieces-jointes` (fast-forward propre, `3599b77..0168b90`).

## 1. Champ `resourceLinks`

Nouveau champ `resourceLinks: [{label, url}]` porté directement par `PedagogicalLogPage`, distinct
de `linkedResources` (déjà présent, réservé à une référence interne future de
`content-catalog-service`, non touché).

- `url` : `@IsUrl({require_protocol: true, protocols: ['http', 'https']})` — refuse toute URL
  relative ou tout protocole non http(s) (ex. `javascript:`).
- `label` : requis, non vide, 200 caractères max.
- Tableau plafonné à 10 éléments (`ArrayMaxSize`).
- Écriture réservée au formateur auteur titulaire de la relation — **exactement** le même chemin
  que `sessionSummary`/`homework` (aucune nouvelle règle d'autorisation, juste un champ
  supplémentaire sur le DTO et l'entité existants).

Fichiers : `src/pedagogical-log/dto/resource-link.dto.ts` (nouveau),
`src/pedagogical-log/dto/create-log.dto.ts` / `update-log.dto.ts` (champ ajouté),
`src/pedagogical-log/entities/pedagogical-log.entity.ts` (colonne `resource_links`),
`src/pedagogical-log/pedagogical-log.service.ts` (`create()` transmet le champ).

## 2. Pièces jointes — `PedagogicalLogAttachment`

Nouveau module `src/attachments/` :

- **Entité** `PedagogicalLogAttachment` (`src/attachments/entities/pedagogical-log-attachment.entity.ts`)
  — `logEntryId` (FK `ON DELETE CASCADE` vers `pedagogical_logs`), `originalFilename`,
  `storedFilename` (UUID généré serveur), `mimeType`, `sizeBytes`, `uploadedBy`, `createdAt`.
- **Détection de type** (`src/attachments/attachment-mime-detector.ts`) — `file-type@16.5.4`
  (dernière version CommonJS avant le passage à l'ESM pur en v17+, compatible avec ce projet en
  `module: commonjs`). Liste blanche : PDF, JPEG/PNG/WebP/GIF, DOCX/XLSX/PPTX (détectés
  individuellement), DOC/XLS/PPT (détectés génériquement `application/x-cfb` — la signature seule
  ne distingue pas lequel des trois), texte/CSV (heuristique, aucune signature binaire n'existe
  pour ces formats). **SVG explicitement refusé**, y compris précédé d'une déclaration
  `<?xml ...?>` — bug trouvé et corrigé en cours de session : `file-type` détecte lui-même une
  déclaration XML comme `application/xml` avant qu'on ait pu sniffer le SVG, la vérification
  explicite du tag a donc été déplacée **avant** l'appel à `fromBuffer()`.
- **Stockage** (`src/attachments/attachment-storage.service.ts`) — volume Docker nommé dédié
  `pedagogical_log_media` (`PEDAGOGICAL_LOG_MEDIA_PATH`), jamais le volume `media_data` de
  `profile-service`. Nom de fichier stocké = UUID généré serveur.
- **Service/contrôleur** — `POST`/`GET`/`GET :attachmentId`/`DELETE` sous
  `/logs/:id/attachments`, préfixe déjà proxié par api-gateway (aucun nouveau préfixe gateway
  nécessaire). Écriture (POST/DELETE) déléguée à une **nouvelle méthode publique**
  `PedagogicalLogService.getEntryForWrite()`, extraction (sans modification) du régime déjà
  appliqué par `update()` — `update()`/`remove()` restent inchangés, 0 régression sur les 120
  tests hérités. Lecture (GET liste/téléchargement) déléguée à `PedagogicalLogService.findOne()`
  existante — revérifiée à **chaque** téléchargement, ne fait jamais confiance à la seule présence
  de `attachmentId` dans l'URL.
- **Plafonds** — deux niveaux (`maxFileBytes`, `maxTotalBytesPerEntry`), lus depuis les réglages
  TI (point 3), vérifiés **après** lecture complète du fichier par multer (pas de refus en
  streaming, à la différence de l'avatar de `profile-service` dont le plafond est une valeur
  d'environnement statique) — compromis documenté et assumé, aux valeurs par défaut aucun envoi
  n'approche les plafonds réseau (`nginx-global` 1 Mio, `api-gateway` 10 Mio). `413` structuré,
  même style que l'avatar : `{statusCode, error, code, message, maxUploadBytes, receivedBytes,
  requestBodyBytes}`, deux codes distincts (`UPLOAD_FILE_TOO_LARGE` / `UPLOAD_TOTAL_SIZE_EXCEEDED`).

**Limite connue, signalée, non corrigée (hors périmètre demandé)** : la suppression d'une entrée
(`PedagogicalLogService.remove()`) s'appuie sur `ON DELETE CASCADE` pour les **lignes**, mais ne
déclenche aucun nettoyage des **fichiers** correspondants sur le volume — fichiers orphelins
possibles. Corriger proprement supposerait de coupler `PedagogicalLogModule` et
`AttachmentsModule` (via `forwardRef` ou autre), non engagé sans demande explicite.

## 3. Réglages TI — `PedagogicalLogSettings`

Nouveau module `src/settings/` — table singleton (id fixe `00000000-…-000000000001`, jamais de
`PrimaryGeneratedColumn`, élimine toute course à la création d'une seconde ligne), seedée par la
migration avec les valeurs par défaut exactes de l'arbitrage :
`attachmentsEnabled: true`, `maxFileBytes: 100000`, `maxTotalBytesPerEntry: 5000000`.

- `GET /pedagogical-logs/settings/attachments` — tout compte authentifié.
- `PATCH /pedagogical-logs/settings/attachments` — `technicien_informatique` uniquement, mise à
  jour partielle. Validation ajoutée (non explicitement demandée mais jugée nécessaire) :
  `maxFileBytes` ne peut pas dépasser `maxTotalBytesPerEntry` (`400` sinon).
- Quand `attachmentsEnabled=false` : `POST /logs/:id/attachments` refuse explicitement (`403`),
  jamais un `201` silencieux. Ne bloque pas la lecture ni la suppression de pièces jointes déjà
  présentes.

`profile-service` reste seul propriétaire du plafond de l'avatar (domaine séparé, délégué à un
autre sous-agent) — pas de service de configuration transverse inventé ici.

## Vérifications faites (session initiale)

- `npm run build` (tsc via `nest build`) : 0 erreur.
- **Migration** vérifiée contre une base Postgres jetable reconstituant l'état réel de production
  (schéma post-`CahierDeTexteRefonte`, ligne `migrations` insérée pour que seule la nouvelle
  migration soit rejouée) : `up()` appliqué et vérifié par requête SQL directe (colonne
  `resource_links`, table `pedagogical_log_attachments` avec sa FK `CASCADE`, table
  `pedagogical_log_settings` avec sa ligne singleton), `down()` vérifié (retour exact à l'état
  initial), `migration:run` rejoué avec succès après le revert. Base jetable supprimée ensuite.
- `npm test` : **169/169 tests unitaires verts**, 15 suites — 49 nouveaux tests
  (`resourceLinks` + `getEntryForWrite()` sur `PedagogicalLogService`, validation DTO,
  détection de type par octets réels, `PedagogicalLogSettingsService`, `AttachmentsService`),
  **0 régression** sur les 120 tests hérités.
- `npm run test:e2e` : mêmes **33 échecs préexistants**, confirmés strictement identiques avant/
  après cette session (routes `/pedagogical-logs` au pluriel jamais montées côté contrôleur, gap
  documenté de longue date, hors périmètre de cette tâche) + **23 nouveaux tests verts** (6 sur les
  réglages TI, 17 sur les pièces jointes) = **92 tests verts au total** (69 hérités + 23 nouveaux),
  **0 régression**.

## Documentation mise à jour

- `docs/routes.md` — nouvelle section "Liens et pièces jointes" sous `pedagogical-log-service`
  (contrat exact des 6 nouvelles routes, corps `413`/`400`, plafonds, liste blanche de types).
- `docs/services/pedagogical-log-service.md` — nouvelle session technique complète (arborescence,
  décisions techniques, vérifications, points en suspens), 2 nouvelles entités documentées.
- `docker-compose.yml` — nouveau volume nommé `pedagogical_log_media` (distinct de `media_data`),
  monté dans `pedagogical-log-service`, variable `PEDAGOGICAL_LOG_MEDIA_PATH` déclarée. **Ce volume
  n'est pas couvert par le dump Postgres et doit être ajouté à la routine de sauvegarde** (signalé
  dans le YAML lui-même, comme pour `media_data`).

## Point bloqué (session initiale)

`.env.example` de ce service n'a pas pu être mis à jour — même règle de permission que la session
du 2026-08-20 (blocage de lecture/écriture sur tout fichier `.env*`). Variable à ajouter
manuellement en documentation/déploiement si `.env.example` doit rester exhaustif :
`PEDAGOGICAL_LOG_MEDIA_PATH=./storage/media` (valeur conteneur : `/app/storage/media`, déjà
correcte dans `docker-compose.yml`). Les autres variables nécessaires (`REDIS_URL`,
`PROFILE_SERVICE_URL`, `INTERNAL_SECRET`, `DASHBOARD_NOTIFICATION_SERVICE_URL`) étaient déjà
absentes de `.env.example` avant cette session (point ouvert déjà signalé le 2026-08-20, non
aggravé ici).

## État git (session initiale)

- Commit unique `0168b90` sur `feat/cahier-de-texte-liens-pieces-jointes`, poussé sur `origin` en
  fast-forward (`3599b77..0168b90`).
- **Non déployé sur la pile réelle** — ce sous-agent n'a pas accès au déploiement ; c'est à
  l'orchestrateur de reconstruire l'image, appliquer la migration en production
  (`node node_modules/typeorm/cli.js -d dist/src/data-source.js migration:run`, comme pour la
  session du 2026-08-20) et relancer le conteneur avec le nouveau volume monté.
- **Branches non fusionnées repérées** (rappel obligatoire, hors périmètre de cette tâche) :
  `feat/cahier-de-texte-liens-pieces-jointes` (ce travail, à merger après revue),
  `feat/profile-service-media-settings` (probablement le sous-agent `profile-service` traitant la
  partie déléguée de ce même arbitrage — réglage TI de la photo de profil), et deux branches sans
  rapport apparent avec cette tâche : `feat/front-reprise-candidature-formateur`,
  `feat/reprise-candidature-formateur`.

## Ce qui reste à faire (hors périmètre de la session initiale)

- Déploiement réel (build + migration + redémarrage + preuve HTTP contre
  `https://claudevma.visioprof.fr`) — revient à l'orchestrateur.
- Écran front "Joindre un fichier" / affichage des liens externes / écran TI "Paramètres système"
  — à déléguer à `front-developper`, en agrégeant ce domaine avec celui de `profile-service`
  (photo de profil) sur un même écran, comme prévu par l'arbitrage.
- Fichiers orphelins sur suppression d'entrée (signalé plus haut, non corrigé).

---

## Addendum — 2026-08-26, session ultérieure : correctif build Docker (`file-type`)

### Bug signalé

`docker compose build pedagogical-log-service` échouait avec
`error TS2305: Module '"file-type"' has no exported member 'fromBuffer'` sur
`src/attachments/attachment-mime-detector.ts:1`, attribué à une résolution
npm ambiguë entre la dépendance directe `file-type@16.5.4` (API CJS
`fromBuffer`) et une copie imbriquée `@nestjs/common/node_modules/file-type@20.4.1`
(API ESM `fileTypeFromBuffer`).

### Point de départ — worktree isolé

Cette session tourne dans un worktree git isolé différent de celui de la
session initiale ci-dessus. La branche `feat/cahier-de-texte-liens-pieces-jointes`
était déjà extraite dans le worktree principal partagé, donc impossible à
checkout ici sous le même nom. Une branche locale
`fix/pedagogical-log-file-type-resolution` a été créée à partir de
`origin/feat/cahier-de-texte-liens-pieces-jointes` (commit `e809d11`), puis
poussée en fast-forward vers ce même nom distant après le correctif — aucune
nouvelle branche distante créée.

### Investigation — le bug ne s'est pas reproduit tel que décrit

Vérifications faites, dans cet ordre, contre un état strictement propre
(`node_modules` absent au départ de ce worktree, jamais réutilisé) :

1. `npm ci` propre : `745` paquets installés sans erreur.
2. `npm run build` (`nest build` / `tsc`) : succès, code de sortie `0`.
3. `npx tsc --noEmit` : succès.
4. `npx tsc --traceResolution` : confirme que TypeScript résout `'file-type'`
   depuis `attachment-mime-detector.ts` en `Node10`/classique, remonte
   l'arbre `node_modules` à partir du fichier source, et trouve directement
   `node_modules/file-type/index.d.ts` à la racine du service — `Package ID
   'file-type/index.d.ts@16.5.4'`. Il ne descend jamais dans
   `node_modules/@nestjs/common/node_modules/file-type` (v20), qui n'est
   visible que depuis l'intérieur de `@nestjs/common` lui-même.
5. `docker compose build --no-cache pedagogical-log-service` (variables
   d'environnement non liées au service fournies en dummy pour permettre
   l'interpolation du compose : `LIVEKIT_NODE_IP`, `LIVEKIT_PUBLIC_URL`,
   `WEBHOOK_SECRET`) : succès, sans cache, deux fois de suite.

Cause technique vérifiée : `package-lock.json` (lockfileVersion 3) pin de
manière déterministe `node_modules/file-type` à `16.5.4` à la racine et
`node_modules/@nestjs/common/node_modules/file-type` à `20.4.1` séparément.
`npm ci` installe exactement l'arbre décrit par le lockfile, sans jamais le
recalculer — ce résultat est donc reproductible à l'identique quel que soit
l'environnement, tant que le lockfile n'est pas régénéré par un `npm install`.
Le bug rapporté, tel que décrit, ne s'est donc pas reproduit sur le commit
`e809d11` dans cet environnement.

Côté runtime (non type-check), vérifié que `@nestjs/common` utilise
`file-type` uniquement via `pipes/file/file-type.validator.js` avec un
import ESM dynamique (`eval('import("file-type")')`), qui résoudra sa propre
copie imbriquée v20 indépendamment — aucune interférence possible avec notre
code, et ce validateur n'est utilisé nulle part dans `src/` du service.

### Correctif appliqué quand même (robustesse demandée explicitement)

Sans reproduction du bug, mais conformément à la demande explicite de rendre
le code robuste "quelle que soit la résolution effective", plutôt que de
forcer une résolution npm globale (`overrides`) — écartée car elle aurait pu
casser silencieusement le `FileTypeValidator` interne de `@nestjs/common`
(son import ESM dynamique attend `fileTypeFromBuffer`, absent de la v16) —
`attachment-mime-detector.ts` a été modifié pour accepter les deux API
possibles de `file-type` (`fromBuffer` CJS ou `fileTypeFromBuffer` ESM),
détectées dynamiquement au chargement du module, avec erreur explicite si
aucune des deux n'est disponible.

Fichier modifié :
`services/pedagogical-log-service/src/attachments/attachment-mime-detector.ts`

### Vérifications post-correctif

- `npm ci` propre : OK.
- `npx tsc --noEmit` : OK (exit 0).
- `npm run build` : OK (exit 0).
- `npm test` : 15 suites, **169 tests, tous verts**, y compris
  `test/unit/attachments/attachment-mime-detector.spec.ts`.
- `docker compose build --no-cache pedagogical-log-service` : **succès**,
  vérifié deux fois (avant et après le correctif, les deux fois vertes dans
  cet environnement — le correctif ne change donc pas le résultat local mais
  ferme la fragilité structurelle signalée).

### Commit et push

- Commit `30c995c` sur la branche existante `feat/cahier-de-texte-liens-pieces-jointes`
  (poussée en fast-forward depuis une branche locale de travail
  `fix/pedagogical-log-file-type-resolution`, aucune nouvelle branche distante
  créée).
- `git push origin fix/pedagogical-log-file-type-resolution:feat/cahier-de-texte-liens-pieces-jointes`
  → `e809d11..30c995c`.

### Branches non fusionnées dans master constatées (rappel, hors périmètre de cette tâche)

- `feat/cahier-de-texte-liens-pieces-jointes` (cette branche, mise à jour ici)
- `feat/front-reprise-candidature-formateur`
- `feat/reprise-candidature-formateur`

### Points en suspens

- Le TS2305 rapporté n'a pas été reproduit dans cet environnement malgré
  plusieurs tentatives de reproduction stricte (npm ci propre + docker
  --no-cache). Si le même message d'erreur réapparaissait ailleurs (autre
  machine CI, autre version de npm capable de régénérer le lockfile), il
  vaudrait la peine de comparer le `package-lock.json` exact utilisé à ce
  moment-là avec celui du commit `e809d11` pour vérifier qu'il n'a pas été
  régénéré entre-temps avec une résolution différente.
