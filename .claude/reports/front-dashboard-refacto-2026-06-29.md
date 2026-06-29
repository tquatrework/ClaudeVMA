# Rapport — Refonte dashboards VisioMath

**Date** : 2026-06-29
**Agent** : front-developper
**Build** : OK (tsc + vite build — 0 erreur TypeScript)

---

## Fichiers créés

### Design tokens
- `apps/web/src/styles/tokens.css` — Variables CSS centralisées : couleurs neutres, accents par rôle (oklch), typographie, espacements, dimensions du layout, ombres, rayons.

### Composant partagé
- `apps/web/src/components/dashboard/DashboardShell.tsx` — Shell commun (top bar + rail + zone centrale). Props : `accentClass`, `railGroups`, `topNavItems`, `userName`, `userRole`, `children`. Responsive intégré via styles CSS inline + media queries injectées.

### Dashboards par rôle (nouveaux fichiers)
- `apps/web/src/pages/EleveDashboardPage.tsx` — Accent indigo. Hero prochain cours + fils d'activité + progression.
- `apps/web/src/pages/ParentDashboardPage.tsx` — Accent cyan. Vue agrégée élèves rattachés avec cards par élève.
- `apps/web/src/pages/ProfesseurDashboardPage.tsx` — Accent vert. Hero prochain cours + activité récente + planning semaine.
- `apps/web/src/pages/RpDashboardPage.tsx` — Accent prune. Stats rapides + liste actions à traiter priorisées + activité récente.
- `apps/web/src/pages/ApDashboardPage.tsx` — Accent ambre. Contenus à valider + activité forums + stats.

### Dashboards refactorés (fichiers existants réécrits)
- `apps/web/src/pages/AfFinanceDashboardPage.tsx` — Accent ardoise. KPIs financiers + actions rapides + paramètres rémunération + derniers mouvements.
- `apps/web/src/pages/TiAdminDashboard.tsx` — Accent ardoise foncée. Santé services (alertes en avant) + outils d'administration filtrés par rôle.

### Routeur mis à jour
- `apps/web/src/pages/DashboardPage.tsx` — Redirige chaque rôle vers son dashboard dédié via `Navigate`. Fallback élève.
- `apps/web/src/App.tsx` — Import des tokens CSS + ajout des 5 routes `/dashboard/{eleve,parent,professeur,rp,ap}`.

---

## Décisions techniques

1. **Layout inline CSS + CSS variables** — Choix délibéré pour encapsuler le style dans les composants sans ajouter de dépendances (pas de styled-components, pas de CSS modules supplémentaires). Les tokens oklch sont posés en variables CSS sur `:root` et surchargés par classes `.role-*` sur le shell.

2. **`accentClass` en string** — Le shell reçoit un nom de classe (`role-eleve`, etc.) plutôt qu'une valeur oklch directe. Cela permet à CSS de résoudre automatiquement `var(--accent)` via la cascade, sans JavaScript pour interpoler les valeurs.

3. **Responsive** : desktop = layout complet, tablette (≤1024px) = rail icônes seules (labels masqués par `.vm-rail-label`), mobile (≤768px) = rail masqué + burger + tiroir lateral.

4. **`DashboardPage.tsx` refactoré en routeur pur** — Plus de logique métier dans ce fichier. Il dispatch uniquement vers les dashboards rôle-spécifiques.

5. **Données mockées commentées `// TODO: brancher API`** — Progression élève, stats AP, forums AP, KPIs AF.

6. **`isLoading` non exposé par `useAuth`** — Le hook n'expose pas `isLoading` dans son contrat public actuel. Le `DashboardPage` fait un guard simple sur `user === null` avec une page de chargement basique.

---

## Points en suspens (TODO)

- **Progression élève** (`EleveDashboardPage`) : données mockées — brancher API `learning-activity-service` quand disponible.
- **Objectifs élève** : endpoint non défini dans `docs/routes.md` — à spécifier en Phase 3.
- **Stats RP** (formateurs actifs, contenus en attente) : endpoints non exposés — ajouter à `docs/routes.md`.
- **Stats AP** (contenus publiés, parcours actifs) : idem.
- **KPIs AF** (crédits actifs, paiements en attente, factures émises) : endpoint `GET /finance/settings` disponible mais ne retourne pas ces agrégats — à compléter côté backend.
- **Solde crédit Parent** : non exposé pour la card élève — à brancher via `GET /api/v1/finance/financial-profiles/:ownerId`.
- **Forums AP** : données mockées — brancher `GET /community/forums` (Phase 3).
- **`isLoading` dans `useAuth`** : l'interface `AuthState` expose `isLoading` mais il concerne uniquement le login. Un `isInitializing` dédié à la vérification du token initial serait utile pour `DashboardPage`.

---

## Routes ajoutées dans App.tsx

| Path | Rôles | Composant |
|------|-------|-----------|
| `/dashboard/eleve` | `eleve` | `EleveDashboardPage` |
| `/dashboard/parent` | `parent_financeur` | `ParentDashboardPage` |
| `/dashboard/professeur` | `formateur` | `ProfesseurDashboardPage` |
| `/dashboard/rp` | `responsable_pedagogique` | `RpDashboardPage` |
| `/dashboard/ap` | `animateur_pedagogique` | `ApDashboardPage` |

Les routes `/admin/finance` (AF) et `/admin/observability` (TI) existaient déjà et pointent vers les composants refactorés.
