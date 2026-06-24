# Rapport — Correction routage post-login responsable_pedagogique

**Date :** 2026-06-24  
**Statut :** ✅ Corrigé — build OK

---

## Cause racine identifiée

Dans `apps/web/src/pages/LoginPage.tsx`, la fonction `resolveRoleLandingPage` groupait `responsable_pedagogique` avec `animateur_pedagogique` et `administrateur_financier` pour les rediriger vers `/admin/activity` :

```typescript
// AVANT (bugué)
case 'responsable_pedagogique':
case 'animateur_pedagogique':
case 'administrateur_financier':
  return '/admin/activity'
```

Ce faisant, après un login réussi, un RP était redirigé vers la vue admin d'activité au lieu de son tableau de bord métier `/dashboard`.

À noter : la route `/admin/activity` autorise bien `responsable_pedagogique` dans son `ProtectedRoute` — donc il n'était pas bloqué, simplement mal orienté. Le bug était purement dans la table de mapping post-login.

---

## Fichier modifié

- `apps/web/src/pages/LoginPage.tsx` — fonction `resolveRoleLandingPage` (lignes 7-18)

---

## Logique exacte corrigée

```typescript
// APRÈS (corrigé)
function resolveRoleLandingPage(role: UserRole): string {
  switch (role) {
    case 'technicien_informatique':
      return '/admin/accounts'
    case 'animateur_pedagogique':
    case 'administrateur_financier':
      return '/admin/activity'
    default:
      return '/dashboard'
  }
}
```

`responsable_pedagogique` tombe désormais dans le `default` → `/dashboard`.

---

## Mapping complet post-login

| Rôle | Route d'atterrissage |
|---|---|
| `technicien_informatique` | `/admin/accounts` |
| `animateur_pedagogique` | `/admin/activity` |
| `administrateur_financier` | `/admin/activity` |
| `responsable_pedagogique` | `/dashboard` ✅ |
| `eleve` | `/dashboard` |
| `parent_financeur` | `/dashboard` |
| `formateur` | `/dashboard` |

---

## Vérifications complémentaires

- **ProtectedRoute `/admin/activity`** : liste `responsable_pedagogique` dans `allowedRoles` → RP peut y accéder manuellement ou via un lien navbar, mais n'y est plus redirigé automatiquement après login.
- **Navbar Layout.tsx** : le lien "Admin" pointe vers `/admin/activity` et est visible pour RP → comportement conservé et correct.
- **AuthContext / hasRole** : `responsable_pedagogique` est bien reconnu dans le type `UserRole` — aucun problème de reconnaissance.
- **Build** : `npm run build` dans `apps/web/` passe sans erreur TypeScript.
