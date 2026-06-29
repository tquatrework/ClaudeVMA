# Design System VisioMath — Rapport session 2026-06-29

## Architecture retenue : Layout unifié (shell simple)

### Diagnostic initial

- `ProtectedRoute` ne wrape pas `Layout` — il fait uniquement la vérification auth/rôle.
- Les pages dashboard (`EleveDashboardPage`, etc.) importent `DashboardShell` directement : **pas de double shell**.
- Les autres pages (`CalendarPage`, `MessagesPage`, etc.) importent `Layout` directement.
- Il n'y avait donc **pas de double barre de navigation** — les dashboards rôle et les autres pages coexistaient avec deux composants différents.

### Architecture adoptée

Architecture shell simple : `Layout.tsx` est réécrit pour devenir le nouveau shell unifié.
Les pages dashboard (EleveDashboardPage, etc.) conservent `DashboardShell` — ils fournissent leur propre navigation.
Les autres pages (CalendarPage, MessagesPage, etc.) utilisent le nouveau `Layout` qui inclut désormais top bar + rail par rôle.

```
Layout.tsx (nouveau)
├── Bannière consentement (conservée, conditions identiques)
├── Top bar (52px)
│   ├── Logo accent couleur du rôle
│   ├── Navigation principale (filtres hasRole conservés à l'identique)
│   └── Avatar + identité + déconnexion
├── Body (flex row)
│   ├── Rail gauche (172px desktop / 64px tablette / tiroir mobile)
│   │   └── Groupes d'outils selon le rôle de l'utilisateur
│   └── Zone contenu (flex:1, 24px padding)
│       └── {children}
└── Footer (conservé)
```

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `apps/web/src/hooks/useRoleAccent.ts` | Hook retournant `{ accentClass, accentHex }` selon le rôle utilisateur |

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `apps/web/src/components/Layout.tsx` | Réécrit : top bar + rail par rôle + zone centrale avec tokens CSS |
| `apps/web/src/index.css` | Import `tokens.css` en tête (avant `@tailwind`) |
| `apps/web/src/App.tsx` | Suppression import `tokens.css` redondant (désormais dans index.css) |

## Rail par rôle implémenté

| Rôle | Groupes |
|---|---|
| `eleve` | Cours · Travail · Mon espace |
| `parent_financeur` | Suivi · Finances |
| `formateur` | Cours · Travail · Contenus |
| `responsable_pedagogique` | Gestion · Validation · Outils |
| `animateur_pedagogique` | Contenus · Communauté |
| `administrateur_financier` | Finances · Documents |
| `technicien_informatique` | Administration · Observabilité |

## Règles respectées

- Toutes les conditions `hasRole` de l'ancienne Layout conservées à l'identique
- Bannière consentement conservée (conditions identiques)
- Footer conservé
- Logique de déconnexion conservée
- Aucune logique métier, appel API, guard de rôle ou route modifié
- Aucun `any` TypeScript introduit
- `npm run build` : succès sans erreur

## Points en suspens

1. **Pages dashboard (DashboardShell)** : les pages `/dashboard/eleve`, `/dashboard/parent`, etc. utilisent encore `DashboardShell` avec leur propre `topNavItems` configurée manuellement. Ces listes sont indépendantes des `visibleTopNavItems` de `Layout`. Si on ajoute un item de nav à Layout, il faut penser à l'ajouter aussi dans chaque page dashboard.

2. **Pages hardcodant du indigo Tailwind** : plusieurs pages (CalendarPage, MessagesPage, TeacherRequestsPage, etc.) utilisent encore des classes Tailwind indigo (`bg-indigo-600`, `text-indigo-600`, `ring-indigo-400`...) dans leur contenu propre. Ces couleurs s'affichent dans la zone centrale, pas dans le shell. La migration complète du contenu des pages vers `var(--accent)` est hors scope de cette session (pas de modification de logique métier demandée).

3. **Doublons d'items rail** : certains items du rail pointent vers des paths identiques mais ont des labels différents (ex. formateur : "Mes élèves" → /contacts, "Demandes prof." → /teacher-requests). L'état actif `isActivePath` peut allumer plusieurs items pour le même path — comportement acceptable en l'état.

4. **Chunk JS de 681 kB** : warning préexistant, hors scope.
