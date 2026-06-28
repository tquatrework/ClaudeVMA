# Rapport — legal-document-service S2 : Normalisation droits contrôleur

**Date :** 2026-06-28
**Branche :** `refactor/legal-document-service-S2-droits-controleur`
**Commit :** `6ca9038`
**Statut :** ✅

---

## Contexte

Le contrôleur `legal-documents.controller.ts` utilisait `@UseGuards(JwtAuthGuard, RolesGuard)` au niveau de la classe sans aucun `@Roles(...)` sur les endpoints. Un auditeur ne pouvait pas déterminer qui peut appeler quoi sans lire le service entier.

---

## Analyse endpoint par endpoint

### `GET /legal-documents/:ownerId` — `findByOwnerId`

**Règle métier (LDS-FB-001) :** Le service autorise l'accès si :
- `requesterId === ownerId` (propriétaire du document), OU
- Le rôle du requérant est `RP`, `TI` ou `AF` (rôles internes)

**Type :** Droits contextuels (combinaison ownership + rôle interne)
**Action :** Ajout du commentaire contextuel LDS-FB-001

### `POST /legal-documents/:id/sign` — `signDocument`

**Règle métier (LDS-FB-002) :** Le service vérifie `existingDocument.ownerId !== requesterId`. Seul le propriétaire du document peut le signer.

**Type :** Droits contextuels (ownership uniquement — aucun rôle fixe)
**Action :** Ajout du commentaire contextuel LDS-FB-002

---

## Tableau des modifications

| Endpoint             | Changement              | Détail                                        |
|----------------------|-------------------------|-----------------------------------------------|
| `GET /:ownerId`      | Commentaire contextuel  | LDS-FB-001 : owner ou rôle interne RP/TI/AF   |
| `POST /:id/sign`     | Commentaire contextuel  | LDS-FB-002 : propriétaire uniquement          |
| Classe               | Suppression RolesGuard  | Aucun @Roles présent → guard passthrough inutile |
| Import               | Suppression import      | RolesGuard devenu inutilisé                   |

---

## Décision architecturale

`RolesGuard` a été retiré du `@UseGuards` au niveau classe car aucun endpoint de ce contrôleur ne définit de `@Roles(...)`. Le guard laissait passer toutes les requêtes authentifiées (comportement `if (!requiredRoles) return true`), créant une fausse impression de protection par rôle. La vraie protection est intégralement dans le service via `assertCanAccessDocuments` et la vérification `ownerId !== requesterId`.

---

## Build

`npm run build` — succès, aucune erreur TypeScript.

---

## Fichiers modifiés

- `services/legal-document-service/src/legal-documents/legal-documents.controller.ts`
