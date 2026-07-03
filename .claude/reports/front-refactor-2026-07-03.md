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

---

## Passe 2 — Pages hors dashboards (2026-07-03)

### Périmètre

Extension du même travail à toutes les pages hors dashboards déjà traités en passe 1.

### Nouveaux fichiers créés

#### Types partagés
- `src/types/content.ts` — `DifficultyLevel`, `DIFFICULTY_LABELS`, `DIFFICULTY_BADGE_CLASSES`, `ContentStatus` (partagés ExerciseCatalogPage + EvaluationCatalogPage)
- `src/types/learningActivity.ts` — `OpenActivityStatus`, `OPEN_ACTIVITY_STATUS_LABELS`, `OPEN_ACTIVITY_STATUS_BADGE_CLASSES` (partagés OpenActivitiesPage + OpenActivityDetailPage)
- `src/types/profile.ts` — `Profile`, `InternalNote`, `TeacherStudentRelation`, `CoordinatorRelation` (centralisés depuis ProfilePage)

#### Utilitaires
- `src/utils/dateFormat.ts` enrichi — `formatLocalDate`, `formatLocalDateTime` (remplacent les `new Date().toLocaleString/toLocaleDateString` inline)

#### Composants UI partagés
- `src/components/ui/StatusBadge.tsx` — badge de statut générique (remplace tous les `<span className="text-xs ...">statut</span>`)
- `src/components/ui/ErrorMessage.tsx` — bloc d'erreur formaté (remplace les `<div className="p-4 bg-red-50 ...">` inline)
- `src/components/ui/PageHeader.tsx` — en-tête de page titre+sous-titre+action (remplace le pattern `flex items-start justify-between gap-4`)
- `src/components/ui/CatalogItemCard.tsx` — carte d'item de catalogue pédagogique (pattern commun exercices/évaluations)

#### Composants admin
- `src/components/admin/WorkflowCommandPanel.tsx` — panneau Commandes extrait d'AdminActivityPage
- `src/components/admin/WorkflowEventsPanel.tsx` — panneau Événements extrait d'AdminActivityPage

### Pages modifiées

| Page | Modification |
|---|---|
| `ExerciseCatalogPage.tsx` | `DIFFICULTY_*` → `types/content.ts`, `CatalogItemCard`, `StatusBadge`, `PageHeader`, `EmptyState` |
| `EvaluationCatalogPage.tsx` | `DIFFICULTY_*` → `types/content.ts`, `CatalogItemCard`, `StatusBadge`, `PageHeader`, `EmptyState` |
| `TutorialCatalogPage.tsx` | `PageHeader`, `StatusBadge`, `EmptyState` |
| `OpenActivitiesPage.tsx` | `STATUS_*` → `types/learningActivity.ts`, `StatusBadge`, `PageHeader`, `EmptyState` |
| `OpenActivityDetailPage.tsx` | `STATUS_*` → `types/learningActivity.ts`, `StatusBadge` |
| `ContactsPage.tsx` | Suppression styles inline (encart "Nouvelle demande") → classes Tailwind |
| `ProfilePage.tsx` | Types locaux (`Profile`, `InternalNote`, `TeacherStudentRelation`) → `types/profile.ts` |
| `AdminActivityPage.tsx` | Extraction panneaux Commandes et Événements → composants `admin/` ; `StatusBadge`, `ErrorMessage`, `formatLocalDateTime` |

### Duplications supprimées

| Duplication | Occurrences avant | Solution |
|---|---|---|
| `DIFFICULTY_LABELS` + `DIFFICULTY_BADGE_CLASSES` | 2 (ExerciseCatalog, EvaluationCatalog) | Centralisé dans `src/types/content.ts` |
| `STATUS_LABELS` + `STATUS_BADGE_CLASSES` (OpenActivity) | 2 (OpenActivities, OpenActivityDetail) | Centralisé dans `src/types/learningActivity.ts` |
| `interface Profile`, `InternalNote`, `TeacherStudentRelation` | 1 local dans ProfilePage | Centralisé dans `src/types/profile.ts` |
| Bloc `<div style={...}>` inline | ContactsPage (encart demande) | Remplacé par classes Tailwind |
| Pattern `<span className="text-xs bg-... text-...">statut</span>` | 10+ occurrences | Composant `StatusBadge` |
| Pattern `<div className="p-4 bg-red-50 border border-red-200...">` | 8+ occurrences | Composant `ErrorMessage` |
| Pattern `<div className="flex items-start justify-between gap-4">` | 6+ occurrences | Composant `PageHeader` |
| `new Date(...).toLocaleString('fr-FR')` inline | ~12 occurrences (AdminActivity, WorkflowEvents, etc.) | `formatLocalDateTime` depuis `dateFormat.ts` |

### Fichiers encore au-dessus de 300 lignes après passe 2

| Fichier | Lignes | Justification |
|---|---|---|
| `EleveDashboardPage.tsx` | 484 | Logique métier spécifique + carte prof + héro prochain cours |
| `TeacherRegistrationPage.tsx` | 470 | Wizard 3 étapes — état très couplé entre étapes, pas extractible sans lourdeur |
| `AfFinanceDashboardPage.tsx` | 423 | Dashboard AF avec logique récompenses spécifique |
| `OpenActivityDetailPage.tsx` | 422 | Page fonctionnelle avec dialog, formulaire d'édition, sous-composants exportés |
| `OpenActivitiesPage.tsx` | 409 | Page + 2 sous-composants exportés dans le même fichier (pattern intentionnel) |
| `FinancialProfilePage.tsx` | 401 | 3 sections distinctes (statut, paiement, archives) — forte logique métier |
| `StudentRegistrationPage.tsx` | 390 | Wizard 3 étapes — même raison que TeacherRegistration |
| `CalendarPage.tsx` | 384 | Calendrier avec multiples interactions (invitation, annulation, rappels) |
| `ProfilePage.tsx` | 380 | Profil avec 6 sections conditionnelles par rôle |
| `ActivityDetailPage.tsx` | 376 | Détail activité avec 4 sous-sections (résumé, présence, enregistrements, cahier) |
| `AdminActivityPage.tsx` | 322 | 578 → 322 (-44%) après extraction Commandes + Événements |

### Build final passe 2

```bash
npx tsc --noEmit   → 0 erreur
npm run build      → ✓ 225 modules, 2.75s
```
