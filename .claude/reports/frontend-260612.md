# Rapport frontend — 2026-06-12

## BUG-004 — Fallback VITE_API_BASE_URL inopérant sur chaîne vide

**Fichier :** `apps/web/src/api/client.ts` ligne 4

**Correction appliquée :**
```ts
// Avant
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1'
// Après
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1'
```

L'opérateur `??` (nullish coalescing) ne substitue que `null` et `undefined`, pas les chaînes vides.
L'opérateur `||` substitue toute valeur falsy, y compris `""`, ce qui est le comportement attendu.

**Statut :** ✅ Corrigé

---

## BUG-009a — Encodage corrompu dans les fichiers React

**Fichiers audités :**
- `apps/web/src/pages/RegisterPage.tsx`
- `apps/web/src/pages/ActivityDetailPage.tsx`
- `apps/web/src/pages/CalendarPage.tsx`

**Résultat de l'audit :**

Les trois fichiers sont en **UTF-8 valide**. Aucune séquence corrompue de type `Ã©`, `CrÃ©Ã©` ou `ActivitÃ©` n'est présente dans les bytes réels des fichiers.

Les caractères accentués présents sont correctement encodés :
- `RegisterPage.tsx` : `é`, `è`, `à`, `É`, `—`, `…`
- `ActivityDetailPage.tsx` : `é`, `è`, `É`, `—`, `…`
- `CalendarPage.tsx` : `é`, `…`, `→`

Vérification effectuée via :
1. Recherche de bytes 0xC3 0x83 (double-encodage UTF-8 → Latin-1 → UTF-8)
2. Recherche de patterns regex `Ã.` dans le contenu décodé en UTF-8
3. Inventaire complet de tous les caractères non-ASCII

**Aucune modification n'a été nécessaire.** Les fichiers étaient déjà corrects au moment de l'audit.

**Statut :** ✅ Vérifié — aucune corruption détectée, aucun changement requis

---

## Résumé

| Bug | Action | Statut |
|-----|--------|--------|
| BUG-004 | `??` → `||` dans `client.ts` ligne 4 | ✅ Corrigé |
| BUG-009a | Audit des 3 fichiers React — aucune corruption trouvée | ✅ Vérifié propre |
