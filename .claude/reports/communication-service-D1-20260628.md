# Rapport D1 — communication-service — 2026-06-28

## Statut : ✅ Déjà résolu

## Constat

Le problème D1 (contacts calculés mais non exposés au front) avait été résolu lors du commit `a9e8226` du 27 juin 2026 :
`feat: ajouter le ContactController public dans communication-service`

## État actuel

### Route exposée
`GET /contacts` — protégée par `JwtAuthGuard`, `userId` tiré de `req.user.id` (règle S3 respectée).

### Contrôleur
`services/communication-service/src/contact/contact.controller.ts`

Endpoints disponibles :
- `GET /contacts` — liste les contacts actifs non expirés de l'utilisateur authentifié
- `POST /contacts/:id/activate` — active un précontact
- `DELETE /contacts/:id` — supprime un contact non-mandatory
- `PATCH /contacts/:id/visibility` — bascule visible/hidden

### Signature de retour
`GET /contacts` → `Promise<ContactPolicy[]>`

Chaque `ContactPolicy` expose :
- `id` (uuid)
- `userId`, `contactId`
- `relationType` (ex. "teacher-student", "parent-student")
- `active` (boolean)
- `status` ('active' | 'precontact')
- `mandatory` (boolean)
- `visibility` ('visible' | 'hidden')
- `expiresAt` (Date | null)
- `createdAt`, `updatedAt`

### Module
`ContactController` enregistré dans `ContactModule` (`contact.module.ts`, ligne 9).

### Swagger
- `@ApiOperation` avec `summary` et `description` COM-BR-010 présents
- `@ApiResponse` 200 et 401 déclarés
- `@ApiBearerAuth()` sur le contrôleur

### Build
`npm run build` : ✅ succès sans erreur ni avertissement.

## Aucune action supplémentaire requise
