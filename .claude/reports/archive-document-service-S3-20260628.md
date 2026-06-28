# Audit sécurité S3 — archive-document-service

**Date :** 2026-06-28
**Service :** `archive-document-service`
**Auditeur :** Claude Sonnet 4.6 (subagent sécurité)
**Statut global :** ⚠️ 1 faille corrigée — service maintenant ✅

---

## Résumé

| Endpoint | Paramètre URL | Vérification identité/rôle | Statut |
|---|---|---|---|
| `GET /students/:studentId/pedagogical-archives` | `studentId` | `assertReadAccess(requesterId, requesterRole, studentId)` | ✅ Sécurisé |
| `POST /students/:studentId/archive-links` | `studentId` | Aucune vérification (avant correction) | ❌ Corrigé |
| `GET /students/:studentId/archive-timeline` | `studentId` | `assertReadAccess(requesterId, requesterRole, studentId)` | ✅ Sécurisé |
| `GET /archive-documents/:id/download` | `id` (résolu en `studentId` via BDD) | `assertReadAccess()` après fetch de l'item | ✅ Sécurisé |
| `GET /internal/students/:studentId/archives` | `studentId` | `InternalSecretGuard` (secret inter-services, pas de JWT) | ✅ Sécurisé |

---

## Faille identifiée et corrigée

### ❌ POST /students/:studentId/archive-links

**Fichiers touchés :**
- `src/archive/archive.controller.ts`
- `src/archive/archive.service.ts`

**Problème :**
Le contrôleur passait `_request` (paramètre non utilisé) au service `addArchiveLink()`.
Le service ne recevait ni `requesterId` ni `requesterRole` et n'effectuait aucune vérification
d'identité ni de rôle avant de créer un lien archive.

N'importe quel utilisateur authentifié (y compris un élève ou un parent financeur) pouvait
POST des archives pour n'importe quel `studentId`.

**Correction appliquée :**

1. **Contrôleur** : propagation de `request.user.id` et `request.user.role` vers le service.
2. **Service** : ajout d'une constante `ROLES_ALLOWED_TO_WRITE_ARCHIVES` et d'un garde explicite
   en tête de `addArchiveLink()` :

```typescript
if (!ROLES_ALLOWED_TO_WRITE_ARCHIVES.includes(requesterRole)) {
  throw new ForbiddenException(
    `Le rôle ${requesterRole} n'est pas autorisé à créer des liens archive`,
  );
}
```

Rôles autorisés à écrire : `FORMATEUR`, `ANIMATEUR_PEDAGOGIQUE`, `RESPONSABLE_PEDAGOGIQUE`,
`TECHNICIEN_INFORMATIQUE`, `ADMINISTRATEUR_FINANCIER`.

Rôles rejetés explicitement : `ELEVE`, `PARENT_FINANCEUR`.

---

## Analyse des autres endpoints

### GET /students/:studentId/pedagogical-archives ✅

`assertReadAccess()` est appelée avec `requesterId` et `requesterRole` issus du JWT.
La méthode vérifie :
- ELEVE : `requesterId === studentId`
- PARENT_FINANCEUR : rôle accepté (filtre carnet personnel appliqué côté retour)
- FORMATEUR : rôle accepté
- RP / TI / AF : accès large via `INTERNAL_ROLES_WITH_BROAD_ACCESS`
- AP : rejeté par défaut (403)

### GET /students/:studentId/archive-timeline ✅

Même logique que ci-dessus via `assertReadAccess()`.

### GET /archive-documents/:id/download ✅

L'item est d'abord récupéré par `id` en base, puis `assertReadAccess()` est appelée avec
le `studentId` de l'item. Vérification supplémentaire : parent financeur ne peut pas
télécharger un carnet personnel.

### GET /internal/students/:studentId/archives ✅

Route interne protégée par `InternalSecretGuard` (validation du header `X-Internal-Secret`
contre la variable d'environnement `INTERNAL_SECRET`). Aucun JWT requis — accès réservé
aux appels inter-services authentifiés par secret partagé.

---

## Build

```
npm run build → SUCCESS (0 erreur TypeScript)
```

## Commit

```
fix(archive-document-service): corriger accès par identifiant URL sans vérification demandeur (S3)
commit 75e93d7
```
