# Rapport de refactoring front — 2026-07-03

## Résumé du refactoring

Élimination des duplications dans `apps/web/src/` : types, fonctions utilitaires, configuration de navigation et composants UI partagés. La navigation (topnav + rail gauche) était définie manuellement dans chaque dashboard et dans Layout.tsx — elle est maintenant centralisée dans une source unique. Les interfaces TypeScript communes étaient redéfinies dans chaque page — elles sont maintenant centralisées dans `src/types/`. Les fonctions de formatage (`formatCountdown`, `formatEventDate`, `formatShortDate`) étaient copiées à l'identique dans 2 dashboards — elles sont centralisées dans `src/utils/`. Le composant "Fil d'activité" (liste de notifications) était copié en JSX dans 4 dashboards — il est maintenant le composant partagé `ActivityFeed`.

---

## Fichiers créés

### Types partagés
- `src/types/calendar.ts` — interface `CalendarEvent`
- `src/types/dashboard.ts` — interfaces `DashboardNotification`, `DashboardContact`, `DashboardReminder`
- `src/types/navigation.ts` — interfaces `TopNavItem`, `RailItem`, `RailGroup`, `NavItem`
- `src/types/user.ts` — re-export de `UserRole`, `AuthUser`

### Utilitaires
- `src/utils/dateFormat.ts` — `formatCountdown`, `formatEventDate`, `formatShortDate`, `formatActivityDate`
- `src/utils/dashboardFormat.ts` — `normalizeListResponse`, `getFutureEvents`
- `src/utils/role.ts` — `ROLE_LABELS`, `ROLE_ACCENT_CLASS`, `getRoleLabel`, `getRoleAccentClass`, `getInitials`, `getAvatarLetter`

### Navigation centralisée
- `src/navigation/navigationConfig.ts` — `TOP_NAV_CONFIG`, `RAIL_GROUPS_BY_ROLE`, `filterTopNavItems`, `getRailGroupsForRole`

### Composants UI partagés
- `src/components/ui/DashboardCard.tsx` — `DashboardCard`, `DashboardSectionTitle`, `DashboardCardLabel`
- `src/components/ui/EmptyState.tsx` — `EmptyState`
- `src/components/ui/ActivityFeed.tsx` — `ActivityFeed`
- `src/components/ui/ImportantContacts.tsx` — `ImportantContacts`
- `src/components/ui/PageTitle.tsx` — `PageTitle`
- `src/components/ui/RoleBadge.tsx` — `RoleBadge`, `AccessBadge`

---

## Fichiers modifiés

### Layout et shell
- `src/components/Layout.tsx` — suppression de `useTopNavItems()` et `useRailGroups()` inline (300+ lignes supprimées), remplacement par `filterTopNavItems` + `getRailGroupsForRole`
- `src/components/dashboard/DashboardShell.tsx` — suppression des 3 interfaces locales (`NavItem`, `RailItem`, `RailGroup`), re-export depuis `src/types/navigation.ts`

### Dashboards refactorisés
- `src/pages/EleveDashboardPage.tsx` — types centralisés, utils centralisés, navigation centralisée, `ImportantContacts` et `ActivityFeed` utilisés, `PageTitle` utilisé
- `src/pages/ProfesseurDashboardPage.tsx` — idem + suppression des fonctions `formatEventDate`/`formatShortDate` locales
- `src/pages/ParentDashboardPage.tsx` — navigation centralisée, `getFutureEvents` utilisé, `PageTitle` utilisé
- `src/pages/RpDashboardPage.tsx` — navigation centralisée, types centralisés, `ActivityFeed` utilisé, `PageTitle` utilisé
- `src/pages/ApDashboardPage.tsx` — navigation centralisée, types centralisés, `ActivityFeed` utilisé, `PageTitle` utilisé
- `src/pages/AfFinanceDashboardPage.tsx` — import `RailGroup`/`NavItem` depuis `src/types/navigation.ts`
- `src/pages/TiAdminDashboard.tsx` — import `RailGroup`/`NavItem` depuis `src/types/navigation.ts`

---

## Duplications supprimées

| Duplication | Occurrences avant | Solution |
|---|---|---|
| `interface CalendarEvent` | 4 (Eleve, Professeur, Parent, + Layout) | Centralisée dans `src/types/calendar.ts` |
| `interface Notification` / `DashboardNotification` | 5 dashboards | Centralisée dans `src/types/dashboard.ts` |
| `interface ContactEntry` / `DashboardContact` | 2+ fichiers | Centralisée dans `src/types/dashboard.ts` |
| `interface NavItem` / `RailGroup` | DashboardShell + 5 dashboards | Centralisée dans `src/types/navigation.ts` |
| `function formatCountdown` | 1 (Eleve) | Centralisée dans `src/utils/dateFormat.ts` |
| `function formatEventDate` | 2 (Eleve, Professeur) | Centralisée dans `src/utils/dateFormat.ts` |
| `function formatShortDate` | 2 (Eleve, Professeur) | Centralisée dans `src/utils/dateFormat.ts` |
| Fil d'activité (JSX notifications) | 4 dashboards | Composant `ActivityFeed` |
| Liste contacts importants (JSX) | 1 (Eleve) | Composant `ImportantContacts` |
| Salutation `Bonjour [prénom]` | 5 dashboards | Composant `PageTitle` |
| `TOP_NAV_ITEMS` constant | 5 dashboards + Layout.tsx | `filterTopNavItems` depuis `navigationConfig.ts` |
| `RAIL_GROUPS` constant | 5 dashboards + Layout.tsx | `getRailGroupsForRole` depuis `navigationConfig.ts` |
| `(Array.isArray(data) ? data : (data.data ?? []))` | 4 dashboards | `normalizeListResponse` dans `src/utils/dashboardFormat.ts` |
| `filter/sort futureEvents` | 3 dashboards | `getFutureEvents` dans `src/utils/dashboardFormat.ts` |

---

## Fichiers encore au-dessus de 300 lignes

| Fichier | Lignes | Justification |
|---|---|---|
| `src/App.tsx` | 884 | Registre des routes — nature inhérente (aucun code dupliqué) |
| `src/components/dashboard/DashboardShell.tsx` | 626 | Shell avec modes desktop/tablette/mobile (3 vues JSX inévitables) |
| `src/components/Layout.tsx` | 586 | Shell avec modes desktop/tablette/mobile — conservé parallèlement à DashboardShell pour les pages non-dashboard |
| `src/pages/AdminActivityPage.tsx` | 578 | Page d'admin complexe — non concernée par ce refactoring |
| `src/pages/EleveDashboardPage.tsx` | 484 | Logique métier spécifique élève : carte prof attitré + héro prochain cours |
| `src/pages/TeacherRegistrationPage.tsx` | 470 | Formulaire multi-étapes — non concerné |
| `src/pages/OpenActivityDetailPage.tsx` | 432 | Page fonctionnelle — non concernée |
| `src/pages/AfFinanceDashboardPage.tsx` | 423 | Dashboard AF avec logique récompenses spécifique |
| `src/pages/OpenActivitiesPage.tsx` | 421 | Page fonctionnelle — non concernée |
| `src/pages/TiAdminDashboard.tsx` | 324 | Dashboard TI avec healthcheck agrégé |

**Note sur DashboardShell et Layout :** Ces deux fichiers coexistent par conception — `DashboardShell` est utilisé par les dashboards rôle, `Layout` est utilisé par les autres pages connectées. Une fusion future est possible mais sort du périmètre de ce refactoring.

---

## Commandes exécutées et résultats

```bash
npx tsc --noEmit
# → Succès, 0 erreur

npm run build
# → ✓ 216 modules transformed
# → dist/assets/index.js 699.07 kB (gzip: 154.87 kB)
# → ✓ built in 2.56s
```

---

## Risques résiduels

1. **AfFinanceDashboardPage** et **TiAdminDashboard** ont une navigation top spécifique (différente de `TOP_NAV_CONFIG`) — conservée intentionnellement car ces rôles ont un contexte d'accueil différent (`/admin/finance`, `/admin/observability`).
2. **DashboardShell vs Layout** : deux implémentations du shell persistent. Une fusion nécessiterait de choisir entre les deux et d'adapter toutes les pages — hors périmètre.
3. Les pages non-dashboard (CalendarPage, ProfilePage, etc.) utilisent encore `Layout` qui lui-même utilise maintenant `navigationConfig` — cohérent.
