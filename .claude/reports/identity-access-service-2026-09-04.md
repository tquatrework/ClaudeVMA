# Vérification du contrat `GET /internal/accounts/by-login-identifier` — 2026-09-04

## Contexte

`communication-service` (chantier Contacts, PR #257) a construit `IdentityAccessClient`, qui
appelle `GET /internal/accounts/by-login-identifier` en supposant, par analogie avec
`GET /internal/accounts/by-user-id/:userId`, une réponse de la forme
`{ userId, loginIdentifier, role }`. Cette hypothèse n'avait jamais été vérifiée.

## Méthode

1. Lecture du code source (`services/identity-access-service/src/internal/internal.controller.ts`
   et `src/accounts/accounts.service.ts`).
2. Vérification empirique en HTTP direct contre le conteneur réel `visiomath_identity_access`
   (port interne 3001, header `X-Internal-Secret` lu directement dans l'environnement du
   conteneur), avec un compte de test réel récupéré en base (`prof.lycee`, rôle `formateur`).

## Constat : le contrat diverge de l'hypothèse de `communication-service`

Code (`internal.controller.ts:40-43`) :

```ts
@Get('accounts/by-login-identifier')
findByLoginIdentifier(@Query('loginIdentifier') loginIdentifier: string) {
  return this.accountsService.findByLoginIdentifier(loginIdentifier);
}
```

`AccountsService.findByLoginIdentifier` (`accounts.service.ts:1009-1013`) :

```ts
async findByLoginIdentifier(loginIdentifier: string): Promise<{ userId: string; role: string }> {
  const user = await this.userRepo.findOne({ where: { loginIdentifier } });
  if (!user) throw new NotFoundException('Identifiant élève introuvable');
  return { userId: user.id, role: user.role };
}
```

Vérification HTTP réelle :

```
GET /internal/accounts/by-login-identifier?loginIdentifier=prof.lycee
X-Internal-Secret: <secret réel du conteneur>
→ 200 {"userId":"38132407-b428-4b11-a07c-4a719fcaa3c0","role":"formateur"}

GET /internal/accounts/by-login-identifier?loginIdentifier=does.not.exist.xyz
X-Internal-Secret: <secret réel>
→ 404 {"message":"Identifiant élève introuvable","error":"Not Found","statusCode":404}
   (message générique malgré le mot "élève", confirmé sur un identifiant sans rapport avec un élève)

GET /internal/accounts/by-login-identifier?loginIdentifier=prof.lycee
(sans header)
→ 401 Unauthorized
```

**Résumé du contrat réel** :
- Paramètre de requête : `loginIdentifier` (confirmé, conforme à l'hypothèse).
- Réponse succès (200) : `{ userId: string, role: string }` — **pas de `loginIdentifier`** dans le
  corps, contrairement à l'hypothèse `{userId, loginIdentifier, role}`.
- Identifiant inconnu : `404`.
- Header manquant : `401`.

## Écart signalé à `communication-service`

Si `IdentityAccessClient` lit `response.loginIdentifier` sur le résultat de cet appel, cette
valeur sera `undefined` en production. Le client doit soit réutiliser l'identifiant qu'il a
lui-même passé en paramètre (il le connaît déjà, c'est l'appelant qui l'a fourni), soit ignorer ce
champ dans son typage de réponse. Cette correction relève de `communication-service`, pas
d'`identity-access-service` — aucune modification de code n'a été faite ici, conformément au
périmètre de la tâche.

## Documentation mise à jour

`docs/routes.md` :
- Table des routes internes (`/internal/accounts/by-login-identifier`) : précise maintenant le nom
  du paramètre de requête.
- Nouvelle ligne de contrat de réponse, juste après celle de `by-user-id/:userId`, documentant
  `{userId, role}`, le 404 et son message, et l'écart avec l'hypothèse de `communication-service`.
- Section Contacts (`communication-service`), point 3 du bloc "Blocages identifiés côté
  profile-service" : mis à jour pour refléter que le contrat est désormais vérifié et divergent,
  avec l'action requise côté client.

## Statut

✅ Contrat vérifié empiriquement contre la pile réelle, documentation corrigée. Écart réel
identifié : la réponse ne porte pas `loginIdentifier` (seulement `{userId, role}`) — à corriger
dans `IdentityAccessClient` de `communication-service` si ce champ y est consommé.
