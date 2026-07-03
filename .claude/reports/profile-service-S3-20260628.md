# profile-service — Audit S3 : Identifiants utilisateur dans l'URL — 2026-06-28

## Statut global : OK (aucune faille)

## Perimetre audite

Controleurs :
- profiles/profiles.controller.ts
- relations/relations.controller.ts
- parent-link-requests/parent-link-requests.controller.ts
- internal/internal.controller.ts

Services :
- profiles/profiles.service.ts
- relations/relations.service.ts
- parent-link-requests/parent-link-requests.service.ts

Guards :
- common/guards/jwt-auth.guard.ts
- common/guards/roles.guard.ts
- internal/internal.guard.ts

---

## Tableau des endpoints audites

### ProfilesController

| Route | Param ID URL | Verification | Verdict |
|-------|-------------|-------------|---------|
| GET /profiles/:userId | userId | assertReadAccess (owner OR role prive OR lien metier) | OK |
| PUT /profiles/:userId/administrative | userId | assertWriteAccess (owner OR RP/TI/AF) | OK |
| PUT /profiles/:userId/pedagogical | userId | assertWriteAccess (owner OR RP/TI/AF) | OK |
| GET /profiles/:userId/internal-notes | userId | @Roles RP/AP/TI/AF fixe | OK |
| POST /profiles/:userId/internal-notes | userId | @Roles RP/AP fixe | OK |
| GET /profiles/:userId/internal-notes/:noteId | userId+noteId | @Roles RP/AP/TI/AF + filtre (noteId, targetUserId) | OK |
| PUT /profiles/:userId/internal-notes/:noteId | userId+noteId | @Roles RP/AP + verificaiton auteur OU RP | OK |
| DELETE /profiles/:userId/internal-notes/:noteId | userId+noteId | actor.role === RP | OK |
| POST /profiles/:teacherId/ap-status | teacherId | @Roles RP | OK |
| PATCH /profiles/:teacherId/validation | teacherId | @Roles RP/TI + transitions d etat | OK |
| GET /profiles/:teacherId/validation | teacherId | allowedRoles.includes(role) || actor.id === teacherId | OK |
| GET /profiles/:userId/statistics | userId | assertReadAccess (meme regle que GET profile) | OK |
| GET /profiles/:userId/visibility-preferences | userId | actor.id !== userId && !isPrivilegedRole(role) | OK |
| PATCH /profiles/:userId/visibility-preferences | userId | actor.id !== userId && !isPrivilegedRole(role) | OK |
| GET /profiles/teachers/pending-validation | aucun | @Roles RP | OK |

### RelationsController

| Route | Param ID URL | Verification | Verdict |
|-------|-------------|-------------|---------|
| POST /relations/finance-owner-student | aucun (body) | @Roles RP/AF | OK |
| GET /relations/finance-owner-student/:financeOwnerId | financeOwnerId | allowed.includes(role) OR actor.id === financeOwnerId | OK |
| POST /relations/teacher-student | aucun (body) | @Roles RP | OK |
| GET /relations/teacher-student/:studentId | studentId | verification multi-role + lien PARENT en base | OK |
| POST /relations/pedagogical-coordinator | aucun (body) | @Roles RP | OK |
| GET /relations/pedagogical-coordinator/:coordinatorId | coordinatorId | privileged.includes(role) OR actor.id === coordinatorId | OK |

### ParentLinkRequestsController

| Route | Param ID URL | Verification | Verdict |
|-------|-------------|-------------|---------|
| POST /parent-link-requests | aucun (body) | @Roles PARENT_FINANCEUR | OK |
| GET /parent-link-requests | aucun | filtrage par actor.id dans le service | OK |
| POST /parent-link-requests/:id/approve | id (requestId) | assertCanProcessRequest: eleve vise OU RP/TI | OK |
| POST /parent-link-requests/:id/reject | id (requestId) | assertCanProcessRequest: eleve vise OU RP/TI | OK |

### InternalController

Tous les endpoints utilises uniquement en body (pas d ID dans l URL).
Protection : InternalGuard via header X-Internal-Secret.

---

## Failles detectees : AUCUNE

Tous les endpoints avec parametre ID dans l URL verifient correctement :
- actor.id === paramId (acces propre), OU
- actor.role dans une liste de roles internes autorises (RP/TI/AF), OU
- un lien metier valide verifie en base (FORMATEUR->ELEVE, PARENT->ELEVE).

## Actions prises

Aucune correction de code necessaire.
Build verifie : cd services/profile-service && npm run build -> succes, 0 erreur.

## Point en suspens (hors perimetre S3)

INTERNAL_SECRET non configure : InternalGuard laisse passer sans authentification si
la variable d environnement est absente (warning dans les logs).
A couvrir par politique d infrastructure (secret obligatoire en production).
