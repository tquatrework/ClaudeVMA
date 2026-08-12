# Front — en-tetes de cache (2026-08-12)

Branche : `fix/cache-control-index-html` · Perimetre : `apps/web/` · Aucune fonctionnalite.

## Le defaut

`GET /` et `GET /assets/*` renvoyaient `Last-Modified` et `ETag` mais **aucun `Cache-Control`**.
Le navigateur appliquait donc son heuristique : il pouvait garder un `index.html` perime, qui
reference l'ancien bundle **par son nom hache**, lui-meme en cache. L'utilisateur regardait une
version de la veille en croyant voir celle du jour.

Consequence reelle, et vraie raison de ce lot : **toute validation visuelle de l'utilisateur
restait sujette au doute**. Constate le 2026-08-11 (ecran affichant des chaines a 0 occurrence
dans le bundle servi), de nouveau le 2026-08-12.

## Le correctif

| Ressource | En-tete | Pourquoi |
|---|---|---|
| `index.html` (et repli SPA) | `Cache-Control: no-cache` | Impose de **revalider**, n'interdit pas de cacher. Avec l'`ETag` deja emis, une page inchangee coute un `304` vide. Pas `no-store`, qui retelechargerait a chaque navigation sans gain de fraicheur |
| `/assets/*` | `Cache-Control: public, max-age=31536000, immutable` | Vite **hache le nom** : un contenu different produit un nom different, il n'y a rien a revalider. Ces fichiers etaient revalides a chaque chargement, pur gaspillage |

Deux blocs `location` freres. Le repli SPA reste dans `location /` ; la redirection interne vers
`/index.html` repasse par ce meme bloc, donc l'en-tete couvre `/` **et** les routes profondes.
`location /assets/` porte `try_files $uri =404` : un bundle manquant doit se voir en `404`, pas
etre servi comme du HTML que le navigateur tenterait d'executer en JavaScript.

`add_header ... always` seulement sur `no-cache`. Une premiere version le portait aussi sur les
actifs : un `404` repartait avec « immutable, un an », ce qui aurait fait garder une **absence**
en cache aussi longtemps que le fichier. Corrige et redeploye.

La configuration sort du `Dockerfile` dans `apps/web/nginx.conf` : elle est relue et modifiee bien
plus souvent qu'ecrite, et les continuations `\n\` du `printf` en ligne rendaient toute correction
risquee (un caractere oublie = nginx qui refuse de demarrer).

A ne pas confondre avec la decision du 2026-08-10 « aucun cache pour l'instant » : celle-la porte
sur les **donnees lues par l'application**, celle-ci sur les **en-tetes de ses fichiers statiques**.

## Preuve — pile reelle, apres `docker compose up -d --build --no-deps frontend`

```
$ curl -sI https://claudevma.visioprof.fr/
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 394
Last-Modified: Wed, 12 Aug 2026 17:35:42 GMT
ETag: "6a7caeee-18a"
Cache-Control: no-cache            <-- etait absent

$ curl -sI https://claudevma.visioprof.fr/assets/index-CY7rLQil.js
HTTP/1.1 200 OK
Content-Type: application/javascript
Content-Length: 796293
ETag: "6a7caeee-c2685"
Cache-Control: public, max-age=31536000, immutable   <-- etait absent

$ curl -sI https://claudevma.visioprof.fr/assets/index-wK7uZK4N.css
HTTP/1.1 200 OK
Content-Type: text/css
Cache-Control: public, max-age=31536000, immutable
```

Repli SPA intact — `/`, `/login`, `/profile`, `/teacher-requests`, `/archives`, `/dashboard`,
`/rp/teacher-validations` : tous `200 text/html`, 394 octets, `Cache-Control: no-cache`, corps =
la page React referencant le bundle courant. Aucun `404`.

```
$ curl -sI -H 'If-None-Match: "6a7caeee-18a"' https://claudevma.visioprof.fr/
HTTP/1.1 304 Not Modified          <-- la revalidation fonctionne, corps vide

$ curl -sI https://claudevma.visioprof.fr/assets/index-DISPARU.js
HTTP/1.1 404 Not Found             <-- sans Cache-Control

$ curl -s -o /dev/null -w '%{http_code} %{content_type}' .../api/v1/auth/me
401 application/json               <-- routage API non affecte
```

Le bundle servi est bien celui du HEAD : « Plan de travail », « Formateurs à examiner » et
`teacher-validations` y sont presents — la verification que le defaut corrige ici rendait
justement impossible.

Suite front : **1527 tests verts (128 fichiers)**, `tsc --noEmit` sans erreur, `vite build`
reussi. Ces tests simulent tout le reseau : ce sont les en-tetes ci-dessus qui font foi.

## Points a signaler

1. **`nginx-global` n'ecrase rien.** Le risque principal du lot ne s'est pas materialise : les
   en-tetes traversent le proxy amont intacts. Aucune intervention hors depot n'est necessaire.
2. **`package-lock.json` n'est pas utilise par l'image.** Le `Dockerfile` copie `package.json`
   seul puis lance `npm install` : le meme commit a produit `index-j26QbPD9.js` en local et
   `index-CY7rLQil.js` dans l'image. Les deux contiennent le code du HEAD (verifie par chaines),
   mais « meme commit » ne garantit pas « memes octets ». Hors perimetre — le correctif
   (`npm ci` + copie du lock) touche la reproductibilite des builds de tous les services.
3. **`immutable` sur un an suppose des noms haches.** Vrai avec Vite aujourd'hui. Un fichier non
   hache qui atterrirait dans `/assets/` serait fige un an chez les visiteurs : la configuration
   de build est devenue une dependance de la politique de cache.
4. **Aucun fichier front au-dessus de 300 lignes n'a ete cree ni modifie** : le lot ne touche que
   `apps/web/Dockerfile` (33 lignes) et `apps/web/nginx.conf` (43 lignes).
