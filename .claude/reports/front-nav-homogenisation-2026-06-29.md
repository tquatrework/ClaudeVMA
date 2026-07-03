# Rapport — Homogénéisation de la navigation frontend

Date : 2026-06-29  
Agent : front-developper

---

## Fichiers modifiés

| Fichier | Modifications |
|---|---|
| `apps/web/src/components/Layout.tsx` | Règles 1, 2, 3 — toutes les modifications de navigation |
| `apps/web/src/pages/ForbiddenPage.tsx` | Règle 1 — libellé "Retour au tableau de bord" |
| `apps/web/src/pages/AgreementsPage.tsx` | Règle 1 — libellé "Retour au tableau de bord" |

---

## Changements par règle

### Règle 1 — "Tableau de bord" → "Accueil"

Occurrences remplacées :
- `Layout.tsx` ligne 56 : `label: 'Tableau de bord'` → `label: 'Accueil'` dans `useTopNavItems()`
- `ForbiddenPage.tsx` ligne 17 : "Retour au tableau de bord" → "Retour à l'accueil"
- `AgreementsPage.tsx` ligne 73 : "Retour au tableau de bord" → "Retour à l'accueil"

Les pages dashboard (EleveDashboardPage, ParentDashboardPage, ProfesseurDashboardPage, RpDashboardPage, ApDashboardPage) utilisaient déjà "Accueil" dans leurs breadcrumbs — aucune modification nécessaire.

Les routes (`/dashboard`) et identifiants techniques sont inchangés.

---

### Règle 2 — "Mon carnet" et "Mémos" dans le menu de gauche uniquement

Ces deux entrées étaient présentes dans `useTopNavItems()` (menu du haut) :
- `{ label: 'Mon carnet', path: \`/notebook/${user.id}\`, allowedRoles: ['eleve'] }`
- `{ label: 'Mémos', path: '/memos' }`

**Supprimées du menu du haut.**

Elles étaient déjà présentes dans le rail gauche `eleve` (groupe "Mon espace") :
- `{ label: 'Mon carnet', path: \`/notebook/${user.id}\`, icon: '📓' }`
- `{ label: 'Mémos', path: '/memos', icon: '💡' }`

Aucune modification du rail nécessaire.

---

### Règle 3 — Dédoublonnage top / rail gauche

Analyse complète item par item. Les éléments présents dans le rail d'un rôle ont été retirés du menu du haut **pour ce rôle**, via ajustement des `allowedRoles`.

| Item du top | Retiré pour le(s) rôle(s) | Raison |
|---|---|---|
| Calendrier | `parent_financeur` | "Calendrier enfant" dans son rail |
| Activités | `eleve`, `formateur` | "Rejoindre la visio"/"Démarrer la visio" dans leur rail |
| Demandes | `formateur` | "Demandes prof." dans son rail |
| Incidents | `technicien_informatique` | "Incidents" dans son rail |
| Comptes | `responsable_pedagogique`, `technicien_informatique` | "Élèves"/"Comptes" dans leurs rails |
| Délégations | `administrateur_financier` | "Délégations" dans son rail |
| Finances | `parent_financeur` | "Profil financier" dans son rail |
| Paiements | `administrateur_financier` | "Paiements" dans son rail |
| Documents légaux | `parent_financeur`, `administrateur_financier` | "Documents légaux" dans leurs rails |
| Mon carnet | `eleve` | Règle 2 — retiré intégralement du top |
| Mémos | `eleve` (et tous) | Règle 2 — retiré intégralement du top |

Le menu du haut final contient uniquement des éléments non dupliqués dans le rail gauche du rôle connecté :
- Accueil (tous)
- Calendrier (hors parent_financeur)
- Activités (hors eleve, formateur)
- Messages (tous)
- Demandes (hors formateur)
- Incidents (RP uniquement)
- Admin (RP, AP, TI, AF)
- Délégations (RP, TI)
- Finances (AF uniquement)
- Paiements (formateur uniquement)
- Documents légaux (eleve, formateur)
- Espace AF (AF uniquement)

---

## Résultat du build TypeScript

```
npx tsc --noEmit → 0 erreur
```

---

## Statut global

✅ Les 3 règles sont appliquées sans erreur de compilation. Aucun refactoring structurel, aucune route modifiée.
