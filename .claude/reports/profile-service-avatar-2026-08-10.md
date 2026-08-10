# profile-service — Photo de profil (2026-08-10)

Branche : `feat/photo-de-profil` — 6 commits poussés sur `origin`.
Statut : ✅ implémenté, testé, **prouvé contre la pile réelle**. Un blocage
d'infrastructure hors dépôt (nginx) empêche l'usage avec de vraies photos.

---

## 1. Contrat des trois routes

Préfixe gateway : `/api/v1/profiles`.

### `POST /profiles/:userId/avatar`

- **Corps** : `multipart/form-data`, champ `file`, **un seul fichier**.
- **Droit** : **le titulaire seul**. Aucune exception administrative.
- **200** `{ "avatarUrl": "/api/v1/profiles/{userId}/avatar?v=1786351627960" }`
- **400** aucun fichier · format non reconnu · SVG · HEIC/HEIF · image illisible
- **401** jeton absent ou invalide
- **403** appelant autre que le titulaire
- **413** au-delà de `MEDIA_MAX_UPLOAD_BYTES` (8 Mio par défaut)
- **500** profil administratif absent, ou stockage indisponible

200 et non 201 : la route ne crée pas une ressource à une adresse nouvelle,
elle remplace le contenu d'une sous-ressource dont l'URL est fixe.

### `GET /profiles/:userId/avatar`

- **Renvoie les octets**, pas une redirection ni une URL.
- **Droit de lecture** : celui du champ `avatarUrl`, via le port de filtrage déjà écrit.
- **200** octets + en-têtes :
  `Content-Type: image/webp`, `Content-Length`, `ETag: "<horodatage>-<taille>"`,
  `Cache-Control: private, max-age=60, must-revalidate`, `Last-Modified`
- **401** jeton absent ou invalide
- **403** aucun droit de lecture sur le **profil** (formateur ou parent non rattaché,
  élève consultant autrui) — c'est l'accès au profil qui est refusé, pas la photo
- **404** pas de photo **ou** photo masquée pour ce lecteur, **volontairement
  indiscernables**, même message : `Aucune photo de profil disponible pour cet utilisateur`

### `DELETE /profiles/:userId/avatar`

- **Droit** : le titulaire seul, mêmes règles que l'envoi.
- **204** photo supprimée, **ou déjà absente** — idempotent.
- **401** / **403** comme ci-dessus.

### `avatarUrl` dans le bloc `administrative`

`"/api/v1/profiles/{userId}/avatar?v={horodatage}"`, ou `null`.
Préfixe réglable par `AVATAR_PUBLIC_PATH_PREFIX`. Le jeton `?v=` change à chaque
remplacement. **Envoyer `avatarUrl` à `PUT /profiles/:userId/administrative` → 400**,
avec un message qui oriente vers les routes ci-dessus.

---

## 2. Sécurité

Le point central du lot. Rien de ce qui est reçu n'est stocké tel quel.

| Mesure | Mise en œuvre |
|---|---|
| Type sur les **octets réels** | `detectImageFormat` sur les nombres magiques. Ni l'extension ni le `Content-Type` du client ne sont consultés — tous deux sous son contrôle. |
| **Ré-encodage systématique** | sharp → WebP, 512 px max. Ce qui est stocké est la sortie de l'encodeur, jamais l'entrée : une charge dissimulée n'est jamais recopiée. |
| **EXIF supprimé** | Objectif en soi, pas effet de bord : une photo de téléphone porte les coordonnées GPS du domicile. `rotate()` appelé **avant** la perte de l'orientation. |
| **SVG refusé** | Document XML exécutable. sharp sait le lire (libRSVG compilé) — raison de plus pour l'écarter avant de lui donner les octets. |
| Taille d'entrée | `MEDIA_MAX_UPLOAD_BYTES`, contrôlé par multer **et** par le service. |
| Bombe de décompression | `limitInputPixels` à 50 Mpx : le plafond d'octets porte sur le compressé, pas sur le décodé. |
| Nom de fichier | UUID généré par le serveur. Rien du client n'entre dans la clé. |
| multer **en mémoire** | Un stockage disque temporaire écrirait les octets non vérifiés avant de savoir si c'est une image. |
| Aucun chemin ne sort | Port `MediaStoragePort` ; l'adaptateur est le seul à manipuler un chemin, et ses erreurs n'en contiennent aucun. |
| Anti-traversée | Motif de clé strict **puis** comparaison de préfixe après `resolve()`. Deux ceintures. |

---

## 3. Preuve contre la pile réelle (https://claudevma.visioprof.fr)

Compte élève créé par l'API, connexion réelle, tout via le domaine public.

```
1. GET /profiles/:id            avatarUrl = null ; seule clé avatar* exposée : ["avatarUrl"]
2. GET /avatar (sans photo)     HTTP 404 "Aucune photo de profil disponible pour cet utilisateur"
3. PUT /administrative
     {"avatarUrl":"https://evil.example/x.jpg"}
                                HTTP 400 "Le champ « avatarUrl » est géré par l'application
                                et ne peut pas être envoyé ici. La photo de profil s'envoie
                                via POST /profiles/:userId/avatar…"
4. POST /avatar — SVG nommé photo.png annoncé image/png
                                HTTP 400 "Les fichiers SVG ne sont pas acceptés… ce format
                                peut contenir du code exécutable."
5. POST /avatar — script shell annoncé image/jpeg
                                HTTP 400 "Le fichier envoyé n'est pas une image reconnue."
6. POST /avatar — vraie photo, nom client "../../evil.php"
                                HTTP 200 {"avatarUrl":"/api/v1/profiles/491d118b…/avatar?v=1786351550701"}
7. GET /profiles/:id            avatarUrl = /api/v1/profiles/491d118b…/avatar?v=1786351550701
8. GET /avatar                  HTTP 200, image/webp, 548 octets,
                                Cache-Control: private, max-age=60, must-revalidate
                                ETag: "1786351550701-548"
```

### Ce qui entre / ce qui sort

```
ENVOYÉ : 11 906 octets, jpeg 1600x1200
  EXIF présent        : true
  contient "iPhone"   : true      (marque du téléphone)
  contient "Camille"  : true      (nom dans le Copyright EXIF)
  contient charge PHP : true      ("<?php system($_GET[\"cmd\"]); ?>")

REÇU   :    548 octets, webp 512x512
  EXIF présent        : false
  contient "iPhone"   : false
  contient "Camille"  : false
  contient charge PHP : false
  aucun octet commun en fin de fichier : true
```

### Remplacement, suppression, droits

```
 9. POST avatar (1er)           HTTP 200 — volume : 45abbcc4-….webp        (1 fichier)
10. POST avatar (remplacement)  HTTP 200 — volume : c18cfded-….webp        (1 fichier)
                                jeton de version changé : oui
11. Formateur rattaché lit      HTTP 200, 548 octets, image/webp
12. Formateur tente POST        HTTP 403 "Seul le titulaire du profil peut modifier ou
                                supprimer sa photo de profil."
13. Formateur tente DELETE      HTTP 403 (même message)
14. L'élève masque avatarUrl (audience self)   HTTP 200
15. Formateur relit             HTTP 404 — et non 403
16. GET /profiles vu du formateur :
      avatarUrl présent dans le bloc ? false
      nommé dans hiddenFields ?       true
      isFiltered = true
17. Le titulaire relit          HTTP 200, 548 octets
18. DELETE par le titulaire     HTTP 204 — 0 fichier sur le volume, avatarUrl = null
19. DELETE de nouveau           HTTP 204 (idempotent)
```

---

## 4. Données existantes

Vérifié **avant** écriture de la migration, sur la base réelle :

```
 total | with_avatar
-------+-------------
    20 |           0
```

**Aucun `avatarUrl` renseigné.** Rien à reprendre.

La migration supprime `avatar_url` (plus rien ne l'écrit ; la garder aurait laissé
une colonne portant le nom d'une donnée qu'elle ne contient plus, ce que
`docs/architecture.md` proscrit) et ajoute `avatar_object_key`,
`avatar_content_type`, `avatar_updated_at`.

**Garde-fou** : la migration **refuse de s'exécuter** si la moindre ligne porte un
`avatar_url` non nul, avec un message indiquant la marche à suivre. Un démarrage
bloqué et explicite vaut mieux qu'une URL effacée en silence.

Après migration sur la base réelle : **20 profils, tous préservés.**

---

## 5. Trois bugs que seule la pile réelle a révélés

Aucun n'était visible au build ni aux 415 tests unitaires.

1. **`import sharp from 'sharp'`** type-checkait et compilait, mais émettait
   `sharp_1.default` — `undefined` à l'exécution. sharp publie ses types en
   `export = sharp` et le service compile avec `esModuleInterop: false`.
   Le service aurait démarré puis cassé au premier téléversement.
   Corrigé en `import * as sharp`.

2. **`avatarUrl?: never`** dans le DTO : aucun `design:type` exploitable émis,
   `@nestjs/swagger` a interprété ce vide comme une dépendance circulaire et
   **refusait de démarrer le service**. Corrigé par `avatarUrl?: string` +
   `type: String`. Le refus reste porté par le validateur, pas par le type.

3. **Volume monté en root.** `/app/storage/media` n'existait pas dans l'image :
   Docker créait le point de montage en root alors que le conteneur tourne en
   `node` (uid 1000). Le service démarrait, servait tout le reste, et échouait au
   premier téléversement sur `EACCES`. Corrigé dans le Dockerfile (`mkdir` +
   `chown` avant `USER node`).

---

## 6. Tests

**415 tests unitaires, tous verts** (76 ajoutés) :

| Fichier | Tests | Objet |
|---|---|---|
| `test/unit/media/image-transcoder.spec.ts` | 17 | Détection, refus, ré-encodage, EXIF, charge cachée |
| `test/unit/media/filesystem-media-storage.adapter.spec.ts` | 18 | Cycle, absence, 8 clés hostiles, aucune fuite de chemin |
| `test/unit/profiles/avatar.service.spec.ts` | 41 | Droits, remplacement, filtrage, suppression |
| `test/unit/profiles/administrative-profile.view.spec.ts` | 12 | Projection, jeton de version, refus du DTO |

Build `nest build` : ✅. Image Docker alpine : ✅ (sharp musl vérifié dans l'image).

---

## 7. Points en suspens

### 🔴 Bloquant pour l'usage réel — nginx, hors de ce dépôt

nginx en amont plafonne les corps de requête à **~1 Mo** et renvoie un `413`
**HTML** avant que la requête n'atteigne le service.

```
  0.5 Mo -> HTTP 400 (le service répond : fichier tronqué, donc illisible)
    2 Mo -> HTTP 413 <html> nginx/1.27.5
    6 Mo -> HTTP 413 <html> nginx/1.27.5
   12 Mo -> HTTP 413 <html> nginx/1.27.5
```

Le plafond du service (8 Mio) est donc **inatteignable**, alors qu'une photo de
téléphone pèse couramment 2 à 5 Mo. **Testé sans nginx**, le service accepte bien
une image de 5,62 Mo (`200`) et renvoie `413` au-delà de 8 Mio.

Correction : `client_max_body_size` dans le bloc `location /api/v1/` de
`claudevma.visioprof.fr`, fichier **`/home/debian/NginxGlobal/nginx.conf`**
(image `nginx-global`, **hors du dépôt VisioMath**).

### 🟠 Front — `<img src>` ne fonctionnera pas

La route est authentifiée par le JWT porté dans l'en-tête `Authorization`, que le
navigateur n'envoie pas sur une balise `<img>`. Le front doit récupérer les octets
par `fetch` avec le jeton, puis construire un object URL.

### 🟠 Sauvegarde

Le volume `media_data` n'est **pas** couvert par le dump Postgres. À ajouter à la
routine, sinon une restauration rendrait une base référençant des photos absentes
(le service répond alors `404` avec un log d'anomalie, mais elles sont perdues).

### 🟡 Ramasse-miettes

Aucun nettoyage des fichiers orphelins. Ils n'apparaissent que si le processus meurt
entre l'écriture du fichier et celle de la base, ou si une suppression échoue après
une mise à jour réussie — deux cas journalisés en erreur. Volume attendu négligeable.

### 🟡 HEIC/HEIF

Refusé avec un message invitant à réenregistrer en JPEG. Les iPhone produisent ce
format ; Safari le convertit généralement au téléversement, mais ce n'est pas garanti.

### Données de démonstration laissées en base

Deux comptes créés pour la preuve, réutilisables par le front :
`avatar.demo.eleve` / `avatar.demo.prof`, mot de passe `MotDePasse!2026`, rattachés
entre eux. La visibilité de `avatarUrl` de l'élève a été remise à son défaut (`linked`).

---

## 8. Déploiement effectué

Le conteneur `visiomath_profile` **a été reconstruit et redéployé** depuis cette
branche (`docker compose -p claudevma`), migration comprise. Le reste de la pile n'a
pas été touché. `/health` répond `{"status":"ok"}`.
