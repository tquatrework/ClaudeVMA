# teacher-request-service — le 409 du lien élève↔formateur cesse d'être avalé

**Date** : 2026-08-12 · **Branche** : `feat/flow-demande-professeur` · **Statut** : ✅

## Le défaut corrigé

`ProfileServiceClient.createTeacherStudentRelation()` traitait le `409` de
`POST /internal/create-teacher-student-relation` comme un succès :

```ts
if (response.status === 409) { this.logger.log(...); return; }
```

Cette branche avait été écrite pour l'idempotence, à une époque où `profile-service` répondait
`409` sur un rejeu. Depuis la livraison du 2026-08-12, **un rejeu répond `200`** : le seul `409`
encore renvoyé signale un lien existant dont le `isPrincipalTeacher` **diffère** de celui demandé.

Conséquence de la branche conservée : le RP désignait un professeur principal, `profile-service`
refusait, et l'application affichait « demande validée ». Une erreur métier transformée en succès
technique — ce que les principes du projet interdisent explicitement.

## Ce qui a changé

| Fichier | Changement |
|---|---|
| `src/teacher-request/clients/profile-service.client.ts` | La branche `409 → succès` est retirée. Le `409` lève une `ConflictException` avec un message français. Log passé de `log` à `warn`. Commentaire de méthode réécrit. |
| `src/teacher-request/teacher-request.service.ts` | Commentaire de `validateCandidate()` corrigé : le rejeu retombe sur un `200`, plus sur « un `409` traité comme un succès ». Aucun changement de logique. |
| `test/unit/profile-service.client.spec.ts` | `201` → succès ; `200` (rejeu) → succès ; `409` → `ConflictException` avec message français. |
| `test/unit/teacher-request.service.spec.ts` | Le conflit remonte au RP ; ni la demande ni les propositions ne sont sauvegardées. Un rejeu réussi clôture bien la demande. |
| `test/e2e/helpers/app.helper.ts`, `test/e2e/requests.e2e-spec.ts` | Drapeau `shouldConflictOnLinkCreation` sur le double de `profile-service` + test de bout en bout. |
| `docs/routes.md`, `docs/services/teacher-request-service.md` | Contrat et session documentés. |

Message rendu au RP :

> Un lien existe deja entre cet eleve et ce formateur, avec un statut de professeur principal
> different de celui demande. Verifiez qui est le professeur principal de cet eleve avant de valider.

## Point 3 de la consigne : le `200` du rejeu

**Vérifié, pas supposé.** Le client teste `response.ok`, qui vaut `true` pour tout code `2xx` :
`201` (création) comme `200` (rejeu) poursuivent la validation. Deux tests unitaires distincts
le prouvent, l'un avec `{ok: true, status: 201}`, l'autre avec `{ok: true, status: 200}`.

## Vérification

- **136 tests unitaires** verts — `npm test`.
- **19 tests e2e** verts (base PostgreSQL locale `teacher_request_test`) —
  `npx jest --config test/jest-e2e.json`.
- **Build** `nest build` sans erreur.

Preuve du bout en bout (`requests.e2e-spec.ts`) : le RP valide alors que `profile-service` répond
en conflit → `POST /requests/:id/validate` renvoie **`409`**, le corps contient « professeur
principal », et la demande reste en `redirected`.

## Points ouverts

1. **`validatedBy`** (identité du RP qui valide, pour l'événement `TeacherLinkedToStudent`
   proposé par `profile-service`) : **non ajouté**, décision prise — personne ne le remplirait
   aujourd'hui. À rouvrir quand un consommateur en aura besoin.
2. **Le script `npm run test:e2e` est cassé**, écart préexistant hors périmètre : il lance
   `jest --testMatch ...` avec la configuration Jest de `package.json`, qui ne déclare pas
   `setupFiles`. `test/e2e/setup-env.ts` n'est donc jamais chargé et la suite échoue sur la
   validation d'environnement. La suite passe avec `npx jest --config test/jest-e2e.json`,
   configuration qui, elle, déclare `setupFiles`. Correction non faite ici pour tenir le
   périmètre ; à traiter séparément (une ligne dans `package.json`).
