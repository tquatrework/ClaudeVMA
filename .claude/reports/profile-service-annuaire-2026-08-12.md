# profile-service — Annuaire des formateurs validés (2026-08-12)

Branche : `feat/flow-demande-professeur`
Périmètre : ajout ciblé d'une route de listage, levée du blocage de l'étape 3 du flow
« demande de professeur ».

---

## 1. Le contrat livré

```
GET /profiles/teachers/validated?page=1&limit=20
```

Via `api-gateway` : `GET /api/v1/profiles/teachers/validated`.

| | |
|---|---|
| Auth | JWT obligatoire (`401` sans jeton) |
| Rôles | `responsable_pedagogique`, `administrateur_financier`, `technicien_informatique` — **et eux seuls** |
| Query | `page` (défaut `1`, minimum `1`), `limit` (défaut `20`, minimum `1`, **maximum `100`**) |

### Réponse `200`

```json
{
  "data": [
    {
      "userId": "00000000-0000-4000-8000-0000000000a1",
      "firstName": "Alice",
      "lastName": "André",
      "levels": ["seconde", "premiere"],
      "subjects": ["mathematiques"]
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 3,
  "totalPages": 1
}
```

**Enveloppe, pas un tableau nu** — même forme que les listes paginées d'`archive-document-service`
(`{data, page, limit, total, totalPages}`). C'est le point d'attention principal pour le
branchement front : `useSelectableTeachers` lit aujourd'hui un tableau.

### Erreurs

| Code | Cas |
|---|---|
| `400` | `page`/`limit` non entier ou `< 1` ; `limit > 100` ; **paramètre de requête inconnu** (`forbidNonWhitelisted`) |
| `401` | Sans jeton |
| `403` | Tout autre rôle — **animateur pédagogique compris** |

Messages de refus en français, exemple réel sur `limit=101` :

> « Le nombre de formateurs par page ne peut pas dépasser 100. Demandez les pages suivantes pour
> obtenir la suite de la liste. »

### Garanties de forme

- **Tri par nom puis prénom sur l'ensemble de la liste**, pas page par page, avec `teacherId` en
  départage pour un ordre stable entre deux pages.
- `levels` / `subjects` : `null` = **non renseigné** (le profil pédagogique est facultatif),
  `[]` = liste vide enregistrée. Les deux ne se confondent pas.
- `firstName` / `lastName` à `null` = **incohérence de données** (profil administratif manquant).
  Le formateur reste dans la liste, trié en fin (`NULLS LAST`), l'anomalie est journalisée
  côté serveur.
- Une page au-delà de la dernière : `200 {data: [], total: N}`, **jamais `404`**.
- Annuaire vide : `total: 0`, `totalPages: 0`.

---

## 2. Décisions prises, et pourquoi

### Le chemin — deux segments, obligatoirement

`GET /profiles/teachers` est capté par `GET /profiles/:userId` : `ParseUUIDPipe` refuse
« teachers », d'où le `400` constaté le 2026-08-12. Le chemin retenu comporte donc **deux
segments**, comme `teachers/pending-validation` avant lui.

Le contrôleur est en outre déclaré **avant** `ProfilesController` dans `profiles.module.ts` :
Express sert la première route enregistrée qui correspond. Aucune collision n'existe aujourd'hui
(aucune route à deux segments ne se termine par `validated`), mais l'ordre rend la garantie
indépendante des routes qu'on ajoutera demain.

### Le nommage

`teachers/validated` plutôt que `teachers/directory` ou `teachers` : il **nomme ce qui est
listé** et se lit en miroir de `teachers/pending-validation`. Les deux routes cohabitent sans
ambiguïté possible — l'une liste ceux qu'on ne propose pas, l'autre ceux qu'on propose.

### Le contenu — socle strict, alors que les administrateurs sont exemptés du filtrage

Les rôles administratifs échappent au filtrage champ par champ : servir la fiche entière aurait
été *techniquement* autorisé. La restriction à `userId, firstName, lastName, levels, subjects`
est donc **délibérée** et non la conséquence d'un filtre — sinon la liste deviendrait la porte
dérobée exacte que le contrat figé de `src/internal/display-name.ts` interdit par ailleurs.

`avatarUrl` appartient au socle de visibilité mais **n'est pas servi** : il n'aide pas à choisir,
et « rien de plus » a été lu strictement. L'ajouter plus tard est un champ de plus, sans nouvel
arbitrage de périmètre.

### Le plafond — déclaré, et refusé explicitement

`VALIDATED_TEACHERS_MAX_LIMIT = 100`, constante exportée relue par le service, Swagger, les tests
et `docs/routes.md` : le plafond n'est écrit qu'une fois. Un `limit` au-dessus est **refusé en
`400`**, jamais ramené en silence à 100 — rogner sans le dire ferait croire à l'appelant qu'il a
tout reçu, même famille de défauts que « accepter puis ignorer un champ » (2026-08-09).

### L'incohérence de données — en liste, pas en `500`

`leftJoin` et non `innerJoin`. L'arbitrage du 2026-08-07 exige un `500` sur
`GET /profiles/:userId` quand le profil administratif manque, mais faire échouer **tout**
l'annuaire pour un seul enregistrement abîmé priverait le RP de son outil de travail. Le
formateur reste visible, noms à `null`, anomalie journalisée en `ERROR`.

### La phase 2 n'est pas rendue coûteuse

La recherche par niveau, disponibilités et points reste hors périmètre. La forme retenue
(QueryBuilder + enveloppe paginée) l'accueillera par un `WHERE` supplémentaire et des paramètres
de query en plus — sans changer la forme de la réponse.

---

## 3. api-gateway — vérifié, non modifié

`gateway/api-gateway/nginx.conf` proxifie `/api/v1/profiles` **en bloc** :

```
location ^~ /api/v1/profiles {
  auth_request /internal/auth;
  proxy_pass http://$upstream_profile$api_v1_suffix;
```

La règle du service est explicite : « proxifier par préfixe, jamais route par route ». La route
est donc jointe **sans aucune déclaration nouvelle**, et le risque de `404` HTML nginx signalé
dans la consigne ne se présente pas ici. **Aucune modification de la gateway n'a été faite ni
n'est nécessaire.**

---

## 4. Fichiers touchés

| Fichier | Nature |
|---|---|
| `services/profile-service/src/profiles/dto/list-validated-teachers.query.dto.ts` | NOUVEAU — pagination, plafond, messages français |
| `services/profile-service/src/profiles/teacher-directory.service.ts` | NOUVEAU — cas d'usage, droits, requête, conversion `simple-array` |
| `services/profile-service/src/profiles/teacher-directory.controller.ts` | NOUVEAU — adaptateur HTTP, `@Roles`, Swagger complet |
| `services/profile-service/src/profiles/profiles.module.ts` | Enregistrement (contrôleur déclaré en premier) |
| `services/profile-service/test/unit/profiles/teacher-directory.service.spec.ts` | NOUVEAU — 23 tests |
| `services/profile-service/test/unit/profiles/list-validated-teachers.query.dto.spec.ts` | NOUVEAU — 12 tests |
| `services/profile-service/test/e2e/teacher-directory.e2e-spec.ts` | NOUVEAU — 26 tests |
| `docs/routes.md` | Section « Annuaire des formateurs validés (2026-08-12) » |
| `docs/services/profile-service.md` | Endpoint + décision C20 + deux points ouverts |

Service séparé de `ProfilesService` : celui-ci dépasse déjà largement les seuils de
`docs/conventions/services-convention.md` (1353 lignes), et l'annuaire n'a besoin d'aucune de ses
dépendances (ni relations, ni événements, ni identity-access, ni visibilité).

---

## 5. Tests

**Unitaires** — 22 suites, **586 tests, tous verts** (551 avant la session, +35).

Couverts : chaque rôle administratif autorisé ; chaque rôle refusé (élève, parent, formateur, AP)
avec message français ; aucune requête base quand le rôle est refusé ; socle exact des clés
servies ; conversion `simple-array` ; `null` vs `[]` ; formateur sans profil administratif
conservé et journalisé ; valeurs par défaut ; traduction `page`/`limit` en fenêtre SQL ; première
page à `offset 0` ; total global vs page ; arrondi de `totalPages` ; page au-delà de la dernière ;
annuaire vide ; filtre `status = validated` ; ordre de tri ; comptage sur une copie de la requête.

**DTO** — bornes basses et hautes, valeurs décimales, non numériques, `page=0`, `limit=0`,
plafond dépassé, et la vérification que la valeur **n'est pas rognée**.

**E2E contre un vrai PostgreSQL (Testcontainers)** — 8 suites, **296 tests, 295 verts**.
La nouvelle suite : **26 tests, tous verts**.

```
PASS test/e2e/teacher-directory.e2e-spec.ts
  ✓ répond 200, et non 400 « userId non-UUID »
  ✓ liste les trois formateurs validés
  ✓ exclut le formateur encore en cours de validation
  ✓ ne recoupe pas la liste des formateurs en attente
  ✓ sert exactement userId, firstName, lastName, levels, subjects
  ✓ ne laisse fuir aucune donnée hors socle (téléphone, adresse, prescription)
  ✓ autorise le responsable pédagogique / administrateur financier / technicien informatique
  ✓ refuse le formateur / élève / parent financeur / animateur pédagogique en 403
  ✓ refuse un appel sans jeton en 401
  ✓ trie sur l'ensemble de la liste, pas page par page
  ✓ refuse un limit au-dessus du plafond, en français et sans rogner
  ✓ refuse un paramètre de requête inconnu plutôt que de l'ignorer
  ✓ conserve un formateur validé sans profil administratif, noms à null
  (26 tests)
```

**Le seul échec de la suite e2e est `[PROF-BR-010]`** (AF / note interne), préexistant et laissé
rouge à dessein, conformément à la consigne.

---

## 6. Limite de validation — à savoir

Ces tests **ne valent pas preuve contre la pile réelle** : le conteneur `visiomath_profile` n'a
pas été reconstruit, la reconstruction sortant du périmètre d'un agent de service. Tant que
l'image n'est pas reconstruite, `https://claudevma.visioprof.fr` **ne sert pas cette route** et
le composeur front continuera d'afficher « La liste des professeurs n'est pas encore disponible ».

Preuve produite ici : 26 cas HTTP joués contre un PostgreSQL réel, dont les codes et les corps
cités ci-dessus.

---

## 7. Ce qui reste à faire

1. **Front** — brancher `useSelectableTeachers` sur la route. Attention à l'enveloppe : la
   réponse est `{data, ...}`, pas un tableau. Le hook peut composer `displayName` à partir de
   `firstName`/`lastName`, et afficher `levels`/`subjects` pour aider le RP à choisir.
2. **Déploiement** — reconstruire `visiomath_profile` pour que la route existe sur la pile réelle.
3. **Non traité, volontairement** : `avatarUrl` dans l'annuaire (trombinoscope) ; la recherche
   par niveau, disponibilités et points (phase 2) ; l'annuaire global de tous les utilisateurs
   (question laissée ouverte par l'arbitrage, non anodine côté vie privée).
