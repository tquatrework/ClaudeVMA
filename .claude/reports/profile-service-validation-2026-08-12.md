# profile-service — Validation des nouveaux formateurs (2026-08-12)

Branche `feat/validation-nouveaux-professeurs`. Arbitrage de référence :
`docs/architecture.md` > « Validation des nouveaux formateurs, et plan de travail du RP ».

**Statut : ⚠️ livré et prouvé côté `profile-service`, bloqué par une ligne manquante chez
`identity-access-service`.**

---

## 1. Ce que j'ai mesuré avant de coder

La cause n'était pas là où le nom la désignait. Créer un compte formateur réel contre la pile
(`POST /accounts/teachers`, `201`) puis regarder la base de `profile-service` donne :

| Table | Ligne créée ? |
|---|---|
| `administrative_profiles` | oui |
| `teacher_pedagogical_profiles` | **non** |
| `teacher_validations` | **non** |

Conclusion : `POST /accounts/teachers` appelle **`POST /internal/create-administrative-profile`**,
et **pas** `POST /internal/create-teacher-profiles`. Poser la correction dans
`createTeacherProfiles` — le nom qui l'appelle — aurait produit du **code mort pour l'inscription
réelle**, avec des tests verts. Les deux chemins sont donc couverts.

Second constat, déterminant pour la reprise de stock : **17 comptes de rôle formateur, 2 lignes de
validation, 5 profils pédagogiques formateur** — et les deux formateurs `validated` ne figuraient
pas dans ces 5. `teacher_pedagogical_profiles` ne peut donc pas servir de marqueur « est
formateur ».

---

## 2. Ce qui est livré

### La création à l'inscription

`ProfilesService.bootstrapTeacherValidation(teacherId)` crée la ligne au statut `pending`.
**Idempotent, et surtout non destructeur** : une ligne existante est renvoyée telle quelle, quel
que soit son statut. C'est le point dur — repasser un formateur `validated` en `pending`
annulerait la décision d'un RP sans trace, et repasser un `rejected` en `pending` lui rouvrirait
la porte.

Déclenché sur les deux chemins :

- `POST /internal/create-teacher-profiles` → inconditionnel, la route dit elle-même que le compte
  est un formateur ;
- `POST /internal/create-administrative-profile` → **si `role === "formateur"`**.

### `role` sur `CreateAdministrativeProfileDto`

Ce champ était **prévu par l'arbitrage du 2026-08-07** (« en conséquence,
`CreateAdministrativeProfileDto` transporte le rôle ») et n'avait jamais été ajouté.

Il est **facultatif** à dessein : l'exiger ferait échouer toute création de compte en `400` tant
que l'appelant ne l'envoie pas, c'est-à-dire casserait l'inscription entière pour corriger un
défaut de validation. **Non persisté, non exposé** — `identity-access-service` reste l'unique
propriétaire du rôle. Son absence est journalisée en `warn`, avec la conséquence métier écrite en
toutes lettres plutôt qu'un message technique.

### La reprise de stock — un script, pas une migration SQL

`profile-service` ne connaît pas les rôles et a interdiction de les persister. Aucune table locale
ne dit qui est formateur (cf. §1). **Une migration SQL ne pourrait que deviner**, donc créer des
enregistrements de validation pour des élèves et des parents.

La liste est donc demandée à son propriétaire :

- `scripts/maintenance/backfill-teacher-validations.ts` — lit
  `GET /internal/accounts?role=formateur` puis appelle la route ci-dessous par lots. `--dry-run`
  disponible. Même forme que `backfill-profiles.ts`, déjà au dépôt.
- `POST /internal/teachers/ensure-validations` — `{teacherIds}`, plafond déclaré à 200. Répond
  `200` (et non `201`) : dans le cas nominal du rejeu, rien n'est créé. La garantie de
  non-destruction est portée **par le serveur**, pas par le script.

### Le repli de synthèse : filet, plus masque

`GET /profiles/:teacherId/validation` répond toujours `200 {teacherId, status:"pending"}` faute de
ligne — refuser la lecture n'aiderait ni le formateur ni le RP — mais **journalise « ANOMALIE DE
DONNEES » en `error`**, en nommant les deux causes possibles et le script de reprise. C'est
l'absorption *silencieuse* qui faisait mentir l'écran, pas le repli lui-même.

### Les deux listes fusionnées

La file renvoyait un tableau nu **non borné** quand l'annuaire, livré le matin même, était borné et
paginé. C'est parce qu'elles vivaient dans deux services distincts que la divergence avait pu
naître. Elles partagent désormais **un DTO de pagination** (`TeachersPageQueryDto`) et **une
méthode de requête** (`TeacherDirectoryService.listTeachersByValidationStatus`).

### Langue

Messages du cycle de validation traduits, avec les libellés d'état (`en attente`,
`en cours d'examen`, `validé`, `refusé`) tenus **en un point unique** plutôt que réécrits dans
chaque message. Le refus générique de `RolesGuard` (`"Insufficient role"`), **partagé par toutes
les routes du service**, remontait lui aussi jusqu'à l'écran : traduit.

---

## 3. Le contrat de la file — le front doit être rebranché

`GET /profiles/teachers/pending-validation` — RP **seul**, `page` (défaut 1), `limit` (défaut 20,
max 100).

```json
{
  "data": [
    {
      "userId": "38132407-b428-4b11-a07c-4a719fcaa3c0",
      "firstName": "prof",
      "lastName": "lycee",
      "levels": null,
      "subjects": null,
      "pendingSince": "2026-08-12T15:20:17.694Z"
    }
  ],
  "page": 1, "limit": 3, "total": 16, "totalPages": 6
}
```

| | Avant | Après |
|---|---|---|
| Enveloppe | tableau nu, non borné | `{data, page, limit, total, totalPages}` |
| Identifiant | `teacherId` | `userId` |
| Date | `createdAt` | `pendingSince` |
| `id` | id de l'enregistrement | supprimé |
| — | — | `levels`, `subjects` ajoutés |

Deux écarts de nommage **résorbés, pas documentés** (arbitrage du 2026-08-08) : l'identifiant d'une
personne s'appelait `teacherId` ici et `userId` dans l'annuaire ; et `createdAt`, dans une liste de
*personnes*, se lisait « date de création du formateur ». `id` disparaît car `PATCH` adresse par
`teacherId` — c'était un UUID de plus exposé sans usage.

Erreurs : `400` (`page`/`limit` invalide, `limit > 100`, paramètre inconnu) · `401` · `403` tout
autre rôle, **TI compris**. Le TI tranche un dossier ouvert ; il n'a pas à disposer de la file.

---

## 4. Preuves contre la pile réelle

Image reconstruite, conteneur `visiomath_profile` recréé.

**Reprise de stock sur la base réelle :**

```
{"created":[…16 identifiants…],
 "alreadyPresent":["a1c90ec9-5dbe-424a-b40c-82fbf05d1c26","2b02e211-cd1f-4e68-8aa0-e43800cfad7c"]}
```

Les deux `validated` ont conservé **statut et commentaire** (« Validation de demonstration du flow
professeur. »). Base ensuite : 16 `pending` + 2 `validated`.

**Via `https://claudevma.visioprof.fr`, jeton RP :**

- `GET /api/v1/profiles/teachers/pending-validation?limit=3` → `200`, enveloppe paginée,
  `total: 16`.
- Cohérence lecture ↔ liste sur un formateur neuf : `GET …/validation` → `status:"pending"`, et il
  est bien dans la file (`total` 16 → 17).
- `PATCH …/validation {"status":"validated"}` par le RP → `403` :
  « Seul le technicien informatique peut sauter l'étape « en cours d'examen » et passer directement
  de « en attente » à « validé » ou « refusé ». Le responsable pédagogique doit d'abord prendre le
  dossier en charge. »

**Tests :** 622 unitaires verts, 328 e2e verts contre un vrai PostgreSQL (dont un nouveau fichier
`teacher-validation.e2e-spec.ts`, 33 cas). `[PROF-BR-010]` reste rouge — préexistant, laissé à
dessein.

---

## 5. Ce que j'attends d'`identity-access-service` — **le blocage**

Une inscription réelle **ne crée toujours pas** l'enregistrement, parce qu'`identity-access-service`
n'envoie pas `role`. Vérifié : compte `preuve.prof.1786548084` créé en `201`, aucune ligne dans
`teacher_validations`, et le `warn` attendu émis :

> `Profil administratif créé pour userId=21461ab2-… SANS rôle transmis. […] aucun enregistrement de
> validation n'est créé, il n'apparaîtra dans aucune file du responsable pédagogique.`

**Ce qu'il faut changer — une ligne :** ajouter `role` au corps déjà envoyé à

```
POST http://profile-service:3002/internal/create-administrative-profile
X-Internal-Secret: <INTERNAL_SECRET>

{ "userId": "...", "firstName": "...", "lastName": "...",
  "phone": "...", "birthDate": "...",
  "role": "formateur" }            ← seul ajout
```

`role` prend les valeurs de `UserRole` (`eleve`, `parent_financeur`, `formateur`,
`animateur_pedagogique`, `responsable_pedagogique`, `technicien_informatique`,
`administrateur_financier`). **Facultatif** : ne rien envoyer ne casse rien, l'envoyer pour *tous*
les rôles est préférable (l'arbitrage du 2026-08-07 le demande de façon générale) et seul
`formateur` déclenche un effet aujourd'hui.

Le côté receveur est **complet et prouvé** : rejouer le même appel avec `role:"formateur"` crée la
ligne et fait apparaître le formateur dans la file (vérifié ci-dessus).

Je ne l'ai pas codé chez eux, comme demandé.

---

## 6. Points à signaler

- **Contrat du front modifié** sur `pending-validation` (§3) — l'écran actuel lit `teacherId` et
  `createdAt` sur un tableau nu : il casse tant qu'il n'est pas rebranché.
- **Le stock reste à rattraper périodiquement** tant que le point §5 n'est pas fait : chaque
  nouveau formateur inscrit entre-temps sera invisible jusqu'au prochain passage du script.
- **L'arbitrage parle d'une « migration »** ; c'est un script de maintenance, pour la raison
  développée en §2 — la contrainte est architecturale, pas un contournement.
- Le point 4 de l'arbitrage (**plan de travail du RP** : deux files réunies dans un écran) est
  **front**, hors de mon périmètre. La source de données de la première file est livrée.
- `[PROF-BR-010]` non touché.

## 7. Branches non fusionnées

`feat/validation-nouveaux-professeurs` (poussée, non mergée) est la seule branche de ce travail.
