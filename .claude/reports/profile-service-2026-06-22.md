# profile-service — Session du 2026-06-22

## Objectif
Implémenter le flux de demande de rattachement parent–élève (`ParentLinkRequest`) avec 4 nouvelles routes.

## Statut : ✅

## Fichiers créés

```
src/parent-link-requests/
├── entities/
│   └── parent-link-request.entity.ts       — Entité TypeORM avec enum pending|approved|rejected
├── dto/
│   └── create-parent-link-request.dto.ts   — DTO de création (studentId UUID)
├── parent-link-requests.service.ts          — Logique métier + notifications best-effort
├── parent-link-requests.controller.ts       — 4 routes NestJS avec décorateurs Swagger
└── parent-link-requests.module.ts           — Module NestJS (TypeORM + JWT)

test/unit/parent-link-requests/
└── parent-link-requests.service.spec.ts     — 29 tests unitaires
```

## Fichiers modifiés

- `src/app.module.ts` : ajout de `ParentLinkRequestsModule` et de l'entité `ParentLinkRequest` dans la liste TypeORM.

## Routes créées

| Méthode | Chemin | Rôles autorisés |
|---|---|---|
| POST | /parent-link-requests | parent_financeur |
| GET | /parent-link-requests | parent_financeur, eleve, responsable_pedagogique, technicien_informatique |
| POST | /parent-link-requests/:id/approve | eleve (ciblé uniquement), responsable_pedagogique, technicien_informatique |
| POST | /parent-link-requests/:id/reject | eleve (ciblé uniquement), responsable_pedagogique, technicien_informatique |

## Décisions techniques

1. **Pas de dépendance `@nestjs/axios`** : le service n'avait pas ce package. Les notifications best-effort vers `dashboard-notification-service` utilisent `fetch` natif (Node 18+, ici Node 24).

2. **Validation de l'élève en base locale** : la vérification que le `studentId` correspond à un profil élève existant se fait directement sur `StudentPedagogicalProfile` (déjà en base dans ce service), sans appel IAM.

3. **Pas de duplication de lien** : lors d'un approve, si le lien `FinanceOwnerStudentLink` existe déjà, il n'est pas recréé (idempotence).

4. **Sécurité élève** : pour approve/reject, si l'acteur est un élève, une vérification stricte `actor.id === request.studentId` est appliquée côté service (en plus du `@Roles` guard). Un élève ne peut traiter que les demandes qui le ciblent.

## Tests

- 29 tests unitaires : 29/29 ✅
- Suite complète : 173/173 ✅ (aucune régression)
- Build TypeScript : ✅ sans erreur

## Points en suspens

- Pas de migration SQL explicite : `synchronize: true` (hors production) crée automatiquement la table `parent_link_requests`. En production, une migration TypeORM sera nécessaire.
- Le `DASHBOARD_NOTIFICATION_SERVICE_URL` doit être ajouté aux variables d'environnement du déploiement.
