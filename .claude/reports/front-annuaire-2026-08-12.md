# Front — annuaire des formateurs validés branché sur l'étape 3

Date : 2026-08-12 · Branche : `feat/flow-demande-professeur` · Périmètre : `apps/web/`

## Statut

✅ Livré et prouvé contre la pile réelle. Le composeur du RP est peuplé de vrais
formateurs, désignés par leur nom.

## Le blocage levé

La session précédente s'était arrêtée sur un constat serveur : aucune route ne
permettait au RP de lister les formateurs. `useSelectableTeachers` renvoyait une
liste vide et le composeur affichait « La liste des professeurs n'est pas encore
disponible ».

`GET /profiles/teachers/validated` existe depuis le 2026-08-12. Ce lot la branche.

## Ce qui a été fait

| Fichier | Rôle |
|---|---|
| `apps/web/src/types/pagination.ts` | **Nouveau.** `PaginatedResponse<T>` — l'enveloppe `{data, page, limit, total, totalPages}` était déclarée en double (archives), elle est désormais partagée. |
| `apps/web/src/types/profile.ts` | `ValidatedTeacher` — la forme exacte servie par le serveur, avec les deux nuances `null` / `[]` documentées. |
| `apps/web/src/types/teacherRequests.ts` | `SelectableTeacher` déplacé depuis le hook (type partagé par 3 fichiers), enrichi de `expertise`. |
| `apps/web/src/api/profile.ts` | `fetchValidatedTeachers(page, limit)` + `VALIDATED_TEACHERS_MAX_LIMIT = 100`. Chemin backend repris tel quel de `docs/routes.md`. |
| `apps/web/src/utils/teacherDirectory.ts` | **Nouveau.** `formatTeacherExpertise`, `toSelectableTeacher` — le formatage sort du composant. |
| `apps/web/src/hooks/teacher-requests/useSelectableTeachers.ts` | Appel réel, pagination jusqu'à `totalPages`, états `isLoading` / `loadError` / `isTruncated`. |
| `apps/web/src/components/teacher-requests/TeacherProposalComposer.tsx` | Quatre états réels en français, niveaux/matières sous chaque nom. |
| `apps/web/src/pages/TeacherRequestDetailPage.tsx` | Câblage, et `isEnabled` restreint au RP. |
| `apps/web/src/api/archiveDocument.ts` | `PaginatedArchiveResponse<T>` devient un alias du type partagé (aucun appelant touché). |

## Le composeur a bougé — pourquoi

La note laissée dans l'ancien hook annonçait « il n'y aura qu'à remplacer le corps
de ce hook, le composeur n'aura pas à changer ». C'était vrai de la **mécanique**
(sélection multiple par cases à cocher : pas une ligne modifiée), faux de sa
**signature**.

La prop `isDirectoryUnavailable` ne décrivait pas un état de chargement mais
l'**absence de route** — un état qui n'existe plus. La garder aurait signifié
mentir sur la nature de l'échec : un `403`, une coupure réseau et « la
fonctionnalité n'est pas développée » auraient produit le même écran. Elle est
remplacée par `teachersLoadError` (le message du serveur, affiché tel quel) et
`isDirectoryTruncated`. S'ajoute la ligne d'expertise sous chaque nom, sans
laquelle les niveaux et matières — qui servent précisément à choisir — n'auraient
nulle part où s'afficher.

## Les quatre pièges du contrat, et comment ils sont tenus

1. **Enveloppe, pas tableau nu.** Le hook lit `response.data`. C'est le défaut qui
   avait vidé l'écran des archives le 2026-08-11 ; il n'est pas rejoué.
2. **Pagination.** 100 par page (le plafond déclaré, jamais dépassé — `limit=101`
   est refusé en `400`), et les pages suivantes sont enchaînées jusqu'à
   `totalPages`. Garde-fou explicite à 20 pages / 2 000 formateurs, annoncé à
   l'écran quand il coupe : une boucle non bornée sur un `totalPages` aberrant
   enfermerait la page dans une suite de requêtes sans fin.
3. **`null` ≠ `[]` ≠ « null ».** Les deux cas existent réellement en base et
   produisent la même ligne discrète « Niveaux et matières non renseignés ».
4. **Un nom absent n'est jamais remplacé par un UUID.** `formatPersonDisplayName`
   donne « Professeur (nom non renseigné) ».

Ajouté au-delà du contrat : l'annuaire n'est **pas appelé** pour un rôle qui
recevrait `403`. Le hook prend `isEnabled`, la page le restreint au RP.

## Preuve contre la pile réelle — https://claudevma.visioprof.fr

Compte `trsflow.rp.0811`, jeton lu dans `access_token`.

```
GET /api/v1/profiles/teachers/validated?page=1&limit=100     -> HTTP 200
{"data":[{"userId":"a1c90ec9-…","firstName":"Nadia","lastName":"Lambert","levels":null,"subjects":null},
         {"userId":"2b02e211-…","firstName":"Yanis","lastName":"Roche","levels":null,"subjects":null}],
 "page":1,"limit":100,"total":2,"totalPages":1}

GET …?limit=101   -> HTTP 400
{"message":["Le nombre de formateurs par page ne peut pas dépasser 100. Demandez les pages
             suivantes pour obtenir la suite de la liste."],"error":"Bad Request","statusCode":400}

GET …?page=9      -> HTTP 200  {"data":[],"page":9,"limit":20,"total":2,"totalPages":1}
jeton élève       -> HTTP 403  {"message":"Insufficient role","error":"Forbidden","statusCode":403}
```

Puis le **vrai code du front**, sans aucun mock, exécuté contre cette même pile
(`loadValidatedTeacherDirectory`, puis `TeacherProposalComposer` rendu hors
navigateur). C'est ce que le RP a sous les yeux :

```
Formateurs reçus : 2
Pagination tronquée : false

Proposer cette demande à des professeurs
Professeurs sollicités *
  Nadia Lambert
  Niveaux et matières non renseignés
  Yanis Roche
  Niveaux et matières non renseignés
Message aux professeurs *
Besoin de soutien en analyse
…
Envoyer la proposition   Annuler

--- Un UUID est-il visible ? ---
a1c90ec9-5dbe-424a-b40c-82fbf05d1c26 présent dans le rendu : false
2b02e211-cd1f-4e68-8aa0-e43800cfad7c présent dans le rendu : false
```

Avec un jeton élève, le même code affiche : « Vous n'êtes pas autorisé à effectuer
cette action. »

`loadValidatedTeacherDirectory` est exporté précisément pour cela : la suite front
simule tout le réseau, un vert n'y vaut pas validation sur ce projet.

## Vérifications

- `npx tsc --noEmit` → 0 erreur.
- `npm test` → **1495 tests verts / 126 fichiers** (1473 avant, +22).
- `npm run build` → succès (avertissement de taille de bundle préexistant).
- Tests ajoutés : `test/validatedTeachers.api.test.ts` (5),
  `test/utils/teacherDirectory.test.ts` (9), et 8 cas d'annuaire dans
  `test/pages/TeacherRequestDetailPage.test.tsx` — dont `levels`/`subjects` à
  `null`, liste vide, `403`, nom absent, et pagination sur deux pages.

### Fichiers au-dessus de 300 lignes

Aucun parmi les fichiers touchés. `TeacherProposalComposer.tsx` passe de 225 à 250
lignes — sous le seuil de découpe, et la découpe (extraire la liste de cases à
cocher) séparerait un `fieldset` de son `form` sans gain de lisibilité.
`TeacherRequestDetailPage.tsx` : 206 lignes. `useSelectableTeachers.ts` : 100.

## Points ouverts

- **Hors périmètre, notés et non traités** (rappelés depuis la session
  précédente) : écran d'instruction `pp-change` pour le RP ; cinq statuts hérités
  encore affichés ; `x-correlation-id` et `Idempotency-Key` absents de
  `src/api/client.ts`.
- **L'AF et le TI** ont droit à cette route côté serveur mais aucun écran ne la
  leur propose. Le hook est déjà paramétré par `isEnabled` si le besoin apparaît.
- **Recherche par niveau, disponibilités et points** : phase 2 par arbitrage. Avec
  deux formateurs, aucun filtre n'est nécessaire ; au-delà de quelques dizaines,
  un champ de filtrage local sera le premier besoin.
- **Le cas « niveaux et matières renseignés » n'est prouvé que par les tests** :
  les deux formateurs de la pile n'ont pas de profil pédagogique (facultatif par
  arbitrage du 2026-08-07). Il le sera dès qu'un formateur de test le remplira.

## Risques résiduels

- Le front déployé sur `claudevma.visioprof.fr` est celui de `master` : la preuve
  ci-dessus porte sur le code de la branche exécuté contre l'API de production, pas
  sur l'application déployée. Un déploiement du front reste à faire par le
  coordinateur.
- Aucune trace laissée sur la pile par cette session : uniquement des lectures
  (`GET`), aucune demande ni proposition créée.
