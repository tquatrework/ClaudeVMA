# community-path-service — Développement réel des Forums (2026-09-04)

Branche : `feat/community-path-forums-refonte`
PR : https://github.com/tquatrework/ClaudeVMA/pull/230 (ouverte, non mergée)
Arbitrage source : `docs/architecture/identite-profils-acces.md`, section
"Developpement reel des Forums (`community-path-service`)", 2026-09-04.

## Statut

✅ Implémenté, buildé, testé (152/152 tests unitaires verts), PR ouverte. Pipeline
d'image réel (`sharp`) vérifié hors mocks (encodage, lecture, refus SVG). Pas de
vérification contre la pile Docker réelle — hors périmètre de ce chantier backend
isolé, à faire au déploiement.

## Résumé des décisions prises

1. **Seul le RP crée un forum.** `POST /forums` refuse tout autre rôle (y compris
   l'AP) en `403`. Plus aucun mécanisme `isPublished`/publication : un forum RP est
   visible dès sa création.
2. **`allowedRoles` remplace l'enum `ForumPublic`.** Colonne Postgres `text[]`
   nullable sur `Forum`. `null`/vide = ouvert à tous les comptes connectés. Valeurs
   possibles pour restreindre : `eleve`, `parent_financeur`, `formateur`,
   `animateur_pedagogique` (enum `ForumRestrictableRole`).
3. **Décision prise à ma discrétion, à signaler à l'utilisateur** : les rôles
   administratifs **RP, administrateur_financier ET technicien_informatique**
   contournent toujours la restriction (accès illimité à tout forum), pas seulement
   le RP. L'arbitrage garantissait explicitement seulement le RP et laissait le
   reste à mon appréciation ; j'ai choisi de m'aligner sur le principe général déjà
   posé ailleurs dans ce projet ("Roles administratifs = RP, AF et TI voient tout").
   Les rôles administratifs ne sont **pas** des valeurs sélectionnables dans
   `allowedRoles` (inutile, ils voient tout de toute façon).
4. **Masquage total (404, jamais 403)** appliqué à `GET /forums` (forum absent de
   la liste), `POST /forums/:id/comments` et `GET /forums/:id/image` pour un rôle
   non autorisé sur un forum restreint. C'est un changement de comportement par
   rapport à l'ancien code qui renvoyait un `403` explicite sur le rôle — corrigé
   pour suivre la discipline de masquage du reste du projet.
5. **Tags réellement exploitables en recherche** : `GET /forums?tags=algèbre,trigo`
   filtre désormais par correspondance partielle insensible à la casse (`ILIKE`),
   alors que le champ existait mais n'était jamais utilisé en filtre auparavant.
6. **Image d'illustration** : nouveau volume Docker nommé
   `community_path_forum_images` (premier stockage binaire de ce service), variable
   `FORUM_IMAGE_STORAGE_PATH`. Réencodage systématique via `sharp` (JPEG/PNG/WebP/
   GIF acceptés, SVG et tout format non reconnu refusés), redimensionnement max
   1200px sans agrandissement, nom de fichier généré côté serveur (UUID), plafond
   **1 000 000 octets** (même motif que l'avatar : rester sous le défaut non
   déclaré de nginx-global). `GET /forums/image-constraints` expose ce plafond et
   les types acceptés, à lire avant l'affichage du sélecteur de fichier.
7. **Charte de bonne conduite** : hypothèse "unique et globale" de l'arbitrage
   confirmée dans l'implémentation (une seule ligne de réglage en base, pas de
   versionnage). Acceptation par utilisateur, horodatée, idempotente. Texte initial
   vide (`content: ''`), modifiable par RP et TI.
8. **Suppression de commentaire réservée strictement au RP** (pas AP, pas TI, pas
   l'auteur) — suppression physique, pas de trace conservée (rien dans l'énoncé
   n'exigeait une preuve rétroactive, contrairement aux consentements/relations).
9. **`ForumExclusion` inchangé**, aucune route retirée ni modifiée sur ce point.

## Fichiers modifiés/créés

- `services/community-path-service/src/forums/entities/forum.entity.ts` — retire
  `public`/`isPublished`, ajoute `allowedRoles`, `imageFilename`, `imageMimeType`.
- `services/community-path-service/src/forums/entities/forum-charter-setting.entity.ts` (nouveau)
- `services/community-path-service/src/forums/entities/forum-charter-acceptance.entity.ts` (nouveau)
- `services/community-path-service/src/forums/services/forum-image-storage.service.ts` (nouveau) —
  stockage disque + pipeline `sharp`.
- `services/community-path-service/src/forums/dto/create-forum.dto.ts` — `public` → `allowedRoles`.
- `services/community-path-service/src/forums/dto/update-forum-charter.dto.ts` (nouveau)
- `services/community-path-service/src/forums/forums.controller.ts` — nouvelles routes
  (charte, image, suppression de commentaire), `createForum` réservé RP.
- `services/community-path-service/src/forums/forums.service.ts` — réécriture des
  règles d'accès (`isRoleAllowedForForum`), masquage, charte, image.
- `services/community-path-service/src/forums/forums.module.ts`, `src/app.module.ts` —
  enregistrement des nouvelles entités/providers.
- `services/community-path-service/src/common/enums/forum-restrictable-role.enum.ts` (nouveau)
- `services/community-path-service/src/common/constants/forum-access.constants.ts` (nouveau)
- `services/community-path-service/src/common/constants/forum-image.constants.ts` (nouveau)
- `services/community-path-service/src/common/enums/forum-public.enum.ts` — **supprimé**.
- `services/community-path-service/package.json` — ajout `sharp`, `@types/multer`.
- `docker-compose.yml` — volume `community_path_forum_images` + variable d'environnement.
- Tests réécrits : `forums.service.spec.ts`, `forums.controller.spec.ts`,
  `community-path-acceptance.spec.ts` (CPS-AC-001/004/005 forum uniquement — les
  tests Parcours sont inchangés).

## Points laissés ouverts / à signaler à l'utilisateur

- **Bypass admin étendu à AF/TI** (point 3 ci-dessus) : à confirmer, c'est une
  interprétation de l'orchestrateur sur un point explicitement laissé à
  l'appréciation du service.
- **Texte réel de la charte** non fourni — reste vide en base tant que le RP/TI ne
  le renseigne pas via `PATCH /forums/charter`.
- **Front non traité** : ce chantier est backend uniquement, conformément au
  séquencement demandé ("`community-path-service` d'abord, `front-developper`
  ensuite une fois le contrat stabilisé").
- **Pas de vérification contre la pile Docker réelle** (pas de `docker compose up`
  dans ce chantier isolé) — la migration de schéma se fera via `synchronize`
  (pas de migrations TypeORM dans ce service, comme le reste du service existant),
  donc aucune action manuelle attendue au déploiement au-delà du build/redeploy
  habituel + création du nouveau volume nommé.

---

## Contrat des routes — pour délégation front

Toutes les routes restent sous `Controller('forums')`, protégées par
`JwtAuthGuard` + `RolesGuard` (Bearer JWT requis). Aucune n'est actuellement
protégée par un décorateur `@Roles()` déclaratif — les contrôles de rôle sont
faits manuellement dans le service (comme avant ce chantier), donc un rôle
insuffisant renvoie une exception métier explicite (403/404 selon le cas décrit
ci-dessous), pas un rejet de guard générique.

### Forums

**`POST /forums`** — créer un forum. **Réservé au RP.**
- Body (JSON) :
  ```json
  {
    "title": "string (requis)",
    "description": "string (optionnel)",
    "level": "string (optionnel)",
    "difficulty": "string (optionnel)",
    "theme": "string (optionnel)",
    "competences": "string (optionnel)",
    "tags": "string (optionnel, libre, ex: \"algèbre,trigonométrie\")",
    "allowedRoles": ["eleve" | "parent_financeur" | "formateur" | "animateur_pedagogique"]
      // optionnel ; absent ou [] = ouvert à tous les comptes connectés
  }
  ```
- 201 : renvoie l'entité `Forum` complète (voir forme ci-dessous).
- 400 : DTO invalide (titre vide, valeur `allowedRoles` hors enum, etc.)
- 403 : appelant non RP (`"Seul le responsable pédagogique peut créer un forum"`).

Forme de l'entité `Forum` retournée par les routes qui l'exposent :
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string | null",
  "level": "string | null",
  "difficulty": "string | null",
  "theme": "string | null",
  "competences": "string | null",
  "tags": "string | null",
  "allowedRoles": ["eleve", ...] | null,
  "createdById": "uuid",
  "createdByRole": "responsable_pedagogique",
  "imageFilename": "string | null",   // interne, ne pas construire d'URL à partir de ça côté front
  "imageMimeType": "string | null",
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```
Pour afficher l'image, toujours passer par `GET /forums/:id/image` (route dédiée),
jamais reconstruire un chemin à partir de `imageFilename`.

**`GET /forums`** — lister les forums accessibles à l'appelant.
- Query params optionnels :
  - `tags` : chaîne, tags séparés par virgule (`?tags=algèbre,trigo`), filtre `OR`
    partiel insensible à la casse.
- 200 : tableau de `Forum` (forme ci-dessus). Un forum restreint à des rôles
  auxquels l'appelant n'appartient pas est **absent** de la liste (jamais un item
  masqué/vide — l'entrée n'existe simplement pas dans le tableau). RP/AF/TI voient
  tout, y compris les forums restreints à d'autres rôles.

### Charte de bonne conduite

**`GET /forums/charter`** — lecture, ouverte à tout compte authentifié.
- 200 : `{ "content": "string (peut être vide)", "updatedAt": "ISO date" }`

**`PATCH /forums/charter`** — modification. **Réservé au RP et au TI.**
- Body : `{ "content": "string" }`
- 200 : même forme que `GET`.
- 403 si appelant ni RP ni TI.

**`GET /forums/charter/acceptance`** — mon statut d'acceptation.
- 200 : `{ "accepted": boolean, "acceptedAt": "ISO date" | null }`

**`POST /forums/charter/acceptance`** — accepter la charte (idempotent, sans body).
- **201** si c'est une première acceptation.
- **200** si déjà acceptée précédemment (aucune erreur, renvoie l'acceptation
  existante).
- Corps de réponse dans les deux cas : `{ "accepted": true, "acceptedAt": "ISO date" }`
- Le front doit distinguer les deux codes uniquement pour, éventuellement,
  personnaliser un message ("Charte acceptée" vs "Vous aviez déjà accepté") — le
  comportement fonctionnel est identique.

**Blocage sur commentaire non précédé d'acceptation** — voir
`POST /forums/:id/comments` ci-dessous, code `CHARTER_NOT_ACCEPTED`.

### Image d'illustration

**`GET /forums/image-constraints`** — à lire avant d'afficher le sélecteur de
fichier, ouverte à tout compte authentifié.
- 200 :
  ```json
  { "maxSizeBytes": 1000000, "allowedMimeTypes": ["image/jpeg", "image/png", "image/webp", "image/gif"] }
  ```

**`POST /forums/:id/image`** — téléverser/remplacer l'image. **Réservé au RP.**
- `multipart/form-data`, champ de fichier nommé **`file`**.
- 200 : renvoie l'entité `Forum` mise à jour (`imageFilename`/`imageMimeType`
  renseignés — toujours ignorer ces deux champs côté affichage, utiliser
  `GET /forums/:id/image`).
- 400 : aucun fichier envoyé, fichier trop volumineux (message cite la taille
  reçue et la limite, en français), ou format non reconnu par le réencodage
  (SVG compris).
- 403 : appelant non RP.
- 404 : forum introuvable.

**`GET /forums/:id/image`** — lire l'image (binaire, `Content-Type` posé selon le
type réel détecté à l'envoi).
- 200 : corps binaire de l'image.
- 404 dans trois cas indistincts côté front (comportement volontaire, ne pas
  essayer de les différencier) : forum inexistant, forum existant mais non
  accessible au rôle de l'appelant (restriction), ou forum accessible mais sans
  image envoyée.

### Commentaires

**`POST /forums/:id/comments`** — publier un commentaire.
- Body : `{ "content": "string (requis)" }`
- 201 : entité `ForumComment` :
  ```json
  { "id": "uuid", "forumId": "uuid", "authorId": "uuid", "authorRole": "string", "content": "string", "createdAt": "ISO date" }
  ```
- **404** : forum inexistant **OU** rôle de l'appelant non autorisé sur ce forum
  restreint (masquage — le front ne doit pas pouvoir distinguer les deux cas, donc
  afficher un message générique type "Forum introuvable").
- **403 avec corps structuré distinctif** dans deux cas, à différencier
  explicitement côté front sur le champ `code` :
  - Utilisateur exclu de ce forum précis (`ForumExclusion`) : corps standard Nest
    `{ "statusCode": 403, "message": "Vous avez été exclu de ce forum" }` (pas de
    champ `code` particulier ici).
  - **Charte non acceptée** : corps
    ```json
    { "statusCode": 403, "code": "CHARTER_NOT_ACCEPTED", "message": "Vous devez accepter la charte de bonne conduite avant de participer à un forum" }
    ```
    → c'est le signal explicite à utiliser pour rediriger l'utilisateur vers
    l'écran d'acceptation de charte (`GET`/`POST /forums/charter*`) plutôt que
    d'afficher une simple erreur générique.

**`DELETE /forums/:id/comments/:commentId`** — supprimer un commentaire.
**Réservé au RP.**
- 204 : pas de corps.
- 403 : appelant non RP.
- 404 : commentaire introuvable pour ce `forumId` précis (y compris si le
  commentaire existe mais sous un autre forum — vérification croisée
  `forumId`+`commentId`).

### Exclusions (inchangé)

**`POST /forums/:id/exclusions`** — exclut un membre. Réservé au propriétaire du
forum (de fait, toujours un RP désormais) ou à tout RP.
- Body : `{ "excludedUserId": "uuid (requis)", "reason": "string (optionnel)" }`
- 201 : entité `ForumExclusion`.
- 400 : déjà exclu.
- 403 : ni propriétaire ni RP.
- 404 : forum introuvable.

## Notes pour `front-developper`

- Les rôles sélectionnables pour `allowedRoles` à la création d'un forum sont
  exactement `eleve`, `parent_financeur`, `formateur`, `animateur_pedagogique` —
  ne pas proposer les rôles administratifs dans ce sélecteur (ils voient tout de
  toute façon).
- Le formulaire de création RP doit lire `GET /forums/image-constraints` avant
  d'afficher le bouton d'upload d'image, même principe que l'avatar de profil.
- Prévoir un écran/bandeau bloquant la zone de saisie de commentaire tant que
  `GET /forums/charter/acceptance` renvoie `accepted: false`, avec un bouton menant
  à la lecture de la charte (`GET /forums/charter`) puis à son acceptation
  (`POST /forums/charter/acceptance`).
- Un forum qui n'apparaît plus dans `GET /forums` (changement de restriction de
  rôle par le RP) doit disparaître silencieusement des écrans qui le listaient —
  ne pas tenter de recharger un `GET /forums/:id` individuel qui n'existe pas
  dans ce contrat (il n'y a pas de route de lecture d'un forum unique ; elle
  n'a pas été demandée par l'arbitrage).
