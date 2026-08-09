# profile-service — 2026-08-08

Résorption de la paire longue `administrativeProfile` / `pedagogicalProfile` sur les routes
`/internal/*`, en application de l'arbitrage du 2026-08-08 (« une même donnée porte un seul nom dans
tout le système »).

Branche : `fix/profile-field-names-english` (travail réalisé dans le worktree agent, rebasé sur
`42cd9f6`).

---

## 1. Ce qui a changé

### Code

`services/profile-service/src/internal/internal.service.ts` — seul fichier de production modifié.

| Route | Avant | Après |
|---|---|---|
| `POST /internal/create-administrative-profile` | `{userId, administrativeProfile}` | `{userId, administrative}` |
| `POST /internal/create-student-profiles` | `{userId, administrativeProfile, pedagogicalProfile}` | `{userId, administrative, pedagogical}` |
| `POST /internal/create-teacher-profiles` | `{userId, administrativeProfile, pedagogicalProfile}` | `{userId, administrative, pedagogical}` |

Les trois autres routes internes (`link-parent`, `create-teacher-student-relation`,
`link-coordinator`) ne renvoyaient pas de bloc de profil : inchangées.

**Aucun alias de compatibilité n'a été ajouté**, conformément à la consigne. Un champ d'alias
recréerait exactement la situation de deux noms concurrents que l'arbitrage supprime.

`internal.controller.ts` n'a pas eu besoin d'être touché : ses types de retour sont dérivés du
service via `Awaited<ReturnType<InternalService['...']>>`, ils suivent automatiquement.

### Tests

- `test/unit/internal/internal.service.spec.ts` : assertions alignées + nouveau `describe`
  « nommage des blocs de profil » (3 tests) qui verrouille la **liste exacte** des clés de sortie
  (`Object.keys(result)`) et l'absence de la paire longue.
- `test/e2e/internal.e2e-spec.ts` : assertions alignées + nouveau `describe` de verrou (4 tests) —
  un par route de création, plus une passe sur le corps sérialisé des trois réponses qui échoue si
  la chaîne `administrativeProfile` ou `pedagogicalProfile` réapparaît **où que ce soit** dans la
  réponse, y compris imbriquée.
- Suppression d'un repli qui masquait la forme de la réponse : le test
  « isAnimateurPedagogique à false par défaut » faisait
  `const pedagogical = res.body.pedagogicalProfile ?? res.body` — le repli rendait indétectable
  tout changement de forme, c'est-à-dire précisément ce que ce test aurait dû protéger.
- `test/e2e/profiles.e2e-spec.ts` : dernière référence résiduelle supprimée. L'assertion
  `expect(res.body.firstName).toBe(before.body.administrativeProfile?.firstName ?? 'Alice')`
  lisait une clé qui **n'a jamais existé** sur `GET /profiles/:userId` (route déjà en clés courtes
  depuis le 2026-08-07) et retombait donc systématiquement sur la valeur en dur `'Alice'` : le test
  passait quoi qu'il arrive. Remplacée par une lecture stricte de `before.body.administrative.firstName`.

### Documentation

`docs/routes.md` :

1. Ligne `GET /profiles/:userId` : l'avertissement « **clés courtes**, à ne pas confondre avec
   `administrativeProfile`/`pedagogicalProfile` que renvoient les routes `/internal/*` » est
   supprimé (sans objet) et remplacé par l'affirmation positive que ce sont les seuls noms.
2. Section « API interne inter-services » de profile-service : elle n'avait **aucune** colonne
   « Réponse attendue » — c'est en partie ce qui a permis à la divergence de passer inaperçue.
   Colonne ajoutée, avec les corps de réponse et les codes d'erreur des 6 routes.
3. Note obsolète du 2026-08-07 (« ces routes sont **inchangées** ») remplacée par un encadré qui
   énonce la règle et liste les consommateurs vérifiés.
4. Ligne dupliquée : `POST /internal/create-administrative-profile` apparaissait **deux fois** dans
   le même tableau (lignes 254 et 257), avec deux descriptions partiellement contradictoires.
   Fusionnées en une seule ligne.
5. `POST /auth/login` : body corrigé de `{email, password}` en `{loginIdentifier, password}`, avec
   une note explicitant que `email` et `loginIdentifier` sont deux données **distinctes** — il n'y
   avait rien à renommer, c'était la doc qui était fausse. `email` reste dans la *réponse*.
   **Le code de identity-access-service n'a pas été touché.**

`docs/services/profile-service.md` : nouvelle décision `C10` (session 2026-08-08) documentant le
changement, l'inventaire des consommateurs et la correction incidente de `/auth/login`.

---

## 2. Consommateurs internes des routes `/internal/*` de profile-service

Inventaire par `grep` sur l'ensemble du dépôt. **Aucun consommateur ne casse.**

| Consommateur | Routes appelées | Lit le corps de réponse ? | Impact |
|---|---|---|---|
| `identity-access-service` — `src/common/clients/profile-service.client.ts` | `create-administrative-profile`, `link-parent` | **Non** — les deux méthodes retournent `Promise<void>`, seul le code HTTP est exploité (et déclenche le rollback / `503`) | Aucun |
| `orchestration-service` — workflows `student-onboarding`, `teacher-onboarding`, `teacher-request` | `create-student-profiles`, `create-teacher-profiles`, `create-teacher-student-relation` | Stocke la sortie de l'étape telle quelle dans `stepOutputs`, sans lire ces clés | Aucun sur le renommage — **mais voir l'anomalie préexistante ci-dessous** |
| `scripts/maintenance/backfill-profiles.ts` | les 3 routes de création | **Non** — ne teste que `response.statusCode` | Aucun |
| `apps/web` | — | Le front n'appelle **pas** les routes `/internal/*` (non exposées via nginx) | Aucun |

### Anomalie préexistante à remonter — orchestration-service

`services/orchestration-service/src/workflow/definitions/teacher-onboarding.workflow.ts:55` :

```ts
profileId: context.stepOutputs['create-teacher-profiles']?.profileId,
```

`profileId` **n'a jamais figuré** dans la réponse de `POST /internal/create-teacher-profiles`, ni
avant ni après ce renommage : la réponse contenait `{userId, administrativeProfile,
pedagogicalProfile}` et contient désormais `{userId, administrative, pedagogical}`. La valeur lue
est donc `undefined` depuis toujours. Ce n'est pas une régression de cette session, mais le champ
est visiblement attendu par l'étape suivante du workflow.

**Ce n'est pas mon service — à déléguer à orchestration-service.** Deux issues possibles : soit
l'étape suivante n'a en fait pas besoin de cet identifiant et la ligne doit disparaître, soit elle
en a besoin et il faut arbitrer ce que `profileId` désigne (aucune des deux entités de profil
n'expose aujourd'hui d'identifiant sous ce nom dans la réponse).

### Point mineur à remonter — apps/web (agent front, travail en parallèle)

`apps/web/src/types/profile.ts:12-13` porte un commentaire devenu faux :

> « les routes internes `POST /internal/create-student-profiles` et `create-teacher-profiles`
> renvoient les mêmes données sous les clés longues `administrativeProfile` / `pedagogicalProfile`
> — ces routes ne sont pas appelées par le front. »

Ces clés longues n'existent plus. Le commentaire est à supprimer ou reformuler. **Non modifié** :
consigne de ne toucher à aucun fichier sous `apps/web/`.

Par ailleurs `apps/web/src/hooks/profile/useProfileForm.ts` et `ProfileEditPage.tsx` continuent
d'employer `administrativeProfile`/`pedagogicalProfile` comme **noms de variables locales** — le
mapping depuis `profile.administrative` / `profile.pedagogical` y est correct, donc le contrat
réseau est bon. C'est un choix de nommage interne au front, pas une route exposant une variante ;
à l'agent front de décider s'il l'aligne pour rester cohérent avec l'esprit de l'arbitrage.

---

## 3. Tests

Exécutés avant remise de la main, depuis `services/profile-service/`.

- **Build** : `npm run build` — OK.
- **Unitaires** : `npm test` — **240 tests, 7 suites, tous verts** (237 avant, +3 verrous).
- **E2E** : `npm run test:e2e` — **116/117 verts** (113 avant, +4 verrous).

### L'unique échec e2e est préexistant et sans lien

```
[PROF-BR-010] Un administrateur financier peut ajouter une note interne → 201
Expected: 201  Received: 403
```

Vérifié plutôt que supposé : le test a été rejoué **seul**, sur l'arbre remis à l'état d'avant
modification (`git stash`), et il échouait déjà à l'identique.

C'est la matérialisation d'une contradiction déjà documentée dans les `openPoints` de
`docs/services/profile-service.md` : le test attend que l'administrateur financier puisse écrire
une note interne, alors que `NOTES_WRITE_ROLES` et `docs/routes.md` restreignent l'écriture à RP et
AP. L'arbitrage PROF-BR-010 est toujours en attente ; ni le test ni le code n'ont été touchés ici,
ce serait trancher l'arbitrage par la bande.

---

## 4. Points en suspens

1. **orchestration-service / `profileId`** — anomalie préexistante décrite ci-dessus, à déléguer.
2. **Arbitrage PROF-BR-010** — l'administrateur financier peut-il écrire une note interne ? Tant
   qu'il n'est pas rendu, un test e2e de profile-service reste rouge en permanence, ce qui use la
   valeur de signal de la suite.
3. **apps/web** — commentaire obsolète dans `src/types/profile.ts`, à traiter par l'agent front.
4. **Redéploiement** — le conteneur `visiomath_profile` ne porte pas encore ce code.
