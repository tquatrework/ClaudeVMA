# Audit : api-gateway — flux parent/financeur et student-link
Date : 2026-06-23

---

## Statut global : ⚠️ INCOMPLET — route critique manquante

La logique métier côté `profile-service` est en place et correcte. La lacune est exclusivement au niveau du **gateway** (nginx) : le préfixe `/api/v1/parent-link-requests` n'est pas routé, rendant toute la mécanique de demande de rattachement parent inaccessible depuis l'extérieur.

---

## 1. Règles de forwarding vers profile-service

Le gateway (`/home/debian/Documents/claudeVMA/gateway/api-gateway/nginx.conf`) expose deux préfixes vers `profile-service:3002` :

| Préfixe gateway          | Cible upstream              | Auth        |
|--------------------------|-----------------------------|-------------|
| `^~ /api/v1/profiles`    | `http://profile/profiles`   | `auth_request /internal/auth` |
| `^~ /api/v1/relations`   | `http://profile/relations`  | `auth_request /internal/auth` |

Le contrôleur `profile-service` expose un troisième groupe de routes :

| Contrôleur NestJS        | Préfixe service             | Routé dans nginx ? |
|--------------------------|-----------------------------|--------------------|
| `ProfilesController`     | `/profiles`                 | oui                |
| `RelationsController`    | `/relations`                | oui                |
| `ParentLinkRequestsController` | `/parent-link-requests` | NON            |

### Routes de parent-link-requests disponibles côté service (non exposées)

| Méthode | Chemin service                      | Rôles autorisés                        |
|---------|-------------------------------------|----------------------------------------|
| POST    | `/parent-link-requests`             | PARENT_FINANCEUR                       |
| GET     | `/parent-link-requests`             | PARENT_FINANCEUR, ELEVE, RP, TI        |
| POST    | `/parent-link-requests/:id/approve` | ELEVE (propre compte), RP, TI          |
| POST    | `/parent-link-requests/:id/reject`  | ELEVE (propre compte), RP, TI          |

Ces quatre routes sont totalement inaccessibles depuis l'extérieur.

### Routes de relations déjà exposées (pertinentes au flux parent)

Via `/api/v1/relations` -> `/relations` :

| Méthode | Chemin service                               | Rôles autorisés               |
|---------|----------------------------------------------|-------------------------------|
| POST    | `/relations/finance-owner-student`           | RP, ADMINISTRATEUR_FINANCIER  |
| GET     | `/relations/finance-owner-student/:financeOwnerId` | RP, AF, TI, ou le financeur lui-même |

Ces routes permettent à un RP/AF de créer un lien financeur-élève directement (sans passer par le workflow de demande parent). Elles sont bien exposées.

---

## 2. Middleware d'auth / gestion des permissions

### Validation JWT au niveau gateway (nginx)
- Toutes les routes protégées passent par `auth_request /internal/auth` qui proxie vers `GET /auth/me` de `identity-access-service`.
- Nginx se contente d'un binaire 200/401 : si 401, il répond immédiatement sans transmettre la requête.
- Il n'y a aucune logique de rôle dans nginx. Le contrôle des rôles est entièrement délégué aux services en aval.
- Le header `Authorization` est propagé à chaque service.

### Contrôle des rôles côté services (RBAC pur)
- `identity-access-service` : `RolesGuard` lit le champ `user.role` (single role par compte) injecté par `JwtStrategy.validate()`.
- `profile-service` : même pattern — `JwtAuthGuard` + `RolesGuard` + vérifications manuelles dans les services (ex. `assertReadAccess`).
- Il n'y a pas de REBAC (Relationship-Based Access Control) au niveau du gateway. Les vérifications relationnelles (parent lié à cet élève ?) sont effectuées dans les méthodes de service, en interrogeant directement la table `finance_owner_student_links`.

### REBAC implémenté dans profile-service
La méthode `ProfilesService.assertReadAccess()` effectue une vraie vérification relationnelle :
- FORMATEUR : vérifie une ligne dans `teacher_student_links` pour le couple `(teacherId, studentId)`.
- PARENT_FINANCEUR : vérifie une ligne dans `finance_owner_student_links` pour le couple `(financeOwnerId, studentId)`.
- ELEVE : peut uniquement voir son propre profil.

Le REBAC existe mais est imbriqué dans la logique de service, pas externalisé en middleware ou au niveau gateway. C'est conforme à l'architecture microservices du projet.

---

## 3. Routes manquantes

### (a) Parent demandant à être rattaché à un élève
Route nécessaire au gateway : `POST /api/v1/parent-link-requests`
- Actuellement : aucune location nginx ne correspond
- Impact : le flux self-service de rattachement parent est entièrement cassé
- Correction requise dans nginx.conf :
```
location ^~ /api/v1/parent-link-requests {
  auth_request /internal/auth;
  proxy_pass http://profile/parent-link-requests;
  proxy_set_header Host              $host;
  proxy_set_header X-Real-IP         $remote_addr;
  proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $forwarded_proto;
  proxy_set_header Authorization     $http_authorization;
  proxy_set_header X-Correlation-ID  $http_x_correlation_id;
}
```

### (b) Parent listant ses élèves rattachés
Route déjà exposée : `GET /api/v1/relations/finance-owner-student/:financeOwnerId`
- Accessible via le préfixe `/api/v1/relations` déjà configuré.
- La vérification d'identité (le parent ne peut voir que ses propres liens) est gérée dans `RelationsService.getStudentsByFinanceOwner()` : accès autorisé si `actor.id === financeOwnerId`.

### (c) Accès aux données d'un élève en tant que parent
Routes déjà exposées :
- `GET /api/v1/profiles/:studentId` : `ProfilesService.assertReadAccess()` autorise le PARENT_FINANCEUR si un lien `finance_owner_student_links` existe.
- `GET /api/v1/relations/teacher-student/:studentId` : accessible mais `RelationsService.getTeachersByStudent()` ne liste pas PARENT_FINANCEUR dans les rôles autorisés (seuls RP, TI, ELEVE lui-même, et FORMATEUR sont couverts). Lacune potentielle : un parent lié ne peut pas voir les formateurs de son élève via cette route.

---

## 4. CORS / Rate limiting

### CORS
- Nginx ne configure aucun header CORS (`Access-Control-Allow-Origin`, etc.).
- Il n'y a pas de directive `add_header` pour CORS dans le nginx.conf actuel.
- Si le frontend React est servi sur une origine différente (port différent en dev, ou domaine séparé en prod), les appels XHR/fetch vers le gateway seront bloqués par le navigateur.
- Action requise : ajouter un bloc CORS dans nginx ou s'assurer que le frontend est servi depuis la même origine.

### Rate limiting
- Deux zones définies :
  - `zone=auth` : 10 req/min par IP — appliquée aux routes d'inscription et login
  - `zone=api` : 30 req/s par IP — déclarée mais non appliquée à aucune location dans le nginx.conf actuel (la déclaration `limit_req_zone` existe mais il n'y a aucun `limit_req zone=api` dans les blocs location protégés)
- Les nouvelles routes `/api/v1/parent-link-requests` devront utiliser `limit_req zone=api burst=10 nodelay`.

---

## 5. JWT — Structure du payload

Le payload JWT émis par `identity-access-service` contient :

```json
{
  "sub": "<userId>",
  "loginIdentifier": "<identifiant_de_connexion>",
  "email": "<email_de_contact>",
  "role": "<role_unique>",
  "validationStatus": "<pending|active|suspended>",
  "jti": "<uuid_session>",
  "type": "access"
}
```

Ce que le JWT ne contient PAS :
- Aucune liste d'IDs d'élèves rattachés
- Aucun contexte de relation (liens parent-élève, formateur-élève)

Le JWT est basé sur RBAC pur (un seul rôle). La vérification des relations est effectuée à chaque appel dans les services (requête BDD). Il n'y a pas de notion REBAC encodée dans le token lui-même. C'est une décision architecturale cohérente (évite les tokens volumineux et les problèmes de cache d'état).

---

## Résumé des actions requises au niveau gateway

| Priorité | Action |
|----------|--------|
| Critique | Ajouter `location ^~ /api/v1/parent-link-requests` -> `http://profile/parent-link-requests` dans nginx.conf |
| Important | Mettre à jour `gateway/api-gateway/CLAUDE.md` (table des routes) pour inclure le nouveau préfixe |
| Important | Vérifier et ajouter la gestion CORS (aucun header configuré actuellement) |
| Mineur | Appliquer `limit_req zone=api` sur les nouvelles routes (la zone est déclarée mais inutilisée) |
| Mineur | Vérifier dans `RelationsService.getTeachersByStudent()` si PARENT_FINANCEUR lié doit avoir accès |

---

## Fichiers audités

- `/home/debian/Documents/claudeVMA/gateway/api-gateway/nginx.conf`
- `/home/debian/Documents/claudeVMA/gateway/api-gateway/CLAUDE.md`
- `/home/debian/Documents/claudeVMA/services/identity-access-service/src/auth/strategies/jwt.strategy.ts`
- `/home/debian/Documents/claudeVMA/services/identity-access-service/src/auth/auth.service.ts`
- `/home/debian/Documents/claudeVMA/services/identity-access-service/src/auth/entities/user.entity.ts`
- `/home/debian/Documents/claudeVMA/services/identity-access-service/src/common/guards/roles.guard.ts`
- `/home/debian/Documents/claudeVMA/services/profile-service/src/parent-link-requests/parent-link-requests.controller.ts`
- `/home/debian/Documents/claudeVMA/services/profile-service/src/parent-link-requests/parent-link-requests.service.ts`
- `/home/debian/Documents/claudeVMA/services/profile-service/src/parent-link-requests/entities/parent-link-request.entity.ts`
- `/home/debian/Documents/claudeVMA/services/profile-service/src/relations/relations.controller.ts`
- `/home/debian/Documents/claudeVMA/services/profile-service/src/relations/relations.service.ts`
- `/home/debian/Documents/claudeVMA/services/profile-service/src/relations/entities/finance-owner-student-link.entity.ts`
- `/home/debian/Documents/claudeVMA/services/profile-service/src/profiles/profiles.controller.ts`
- `/home/debian/Documents/claudeVMA/services/profile-service/src/profiles/profiles.service.ts`
