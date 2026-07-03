# Rapport — Architecture de navigation front VisioMath
Date : 2026-07-02
Branche : `feat/nav-homogenisation`

---

## 1. Matrice de navigation finale

| Fonctionnalité | Rôle(s) | Emplacement actuel | Route | Statut | Commentaire |
|---|---|---|---|---|---|
| Accueil / Dashboard | Tous | Menu haut | `/dashboard` → redirect vers dashboard rôle | OK | DashboardPage redirige vers le bon dashboard selon le rôle |
| Calendrier | élève, parent, formateur, RP, AP | Menu haut | `/calendar` | OK | parent_financeur ajouté aux allowedRoles (manquait) |
| Contacts | élève, parent, formateur, RP, AP | Menu haut | `/contacts` | OK | TI et AF retirés du menu haut (ils n'ont pas de contacts proches) |
| Messages | élève, parent, formateur, RP, AP, TI | Menu haut | `/messages` | OK | |
| Demandes professeur | élève, parent, RP | Menu haut | `/teacher-requests` / `/rp/teacher-requests` | OK | Ajouté dans le top nav pour élève, parent, RP |
| Stats / Archives | Tous sauf TI et AF (filtré côté serveur) | Menu haut | `/archives` | OK | |
| Notifications (cloche) | Tous | Top bar droite (icône) | `/notifications` | OK | Route créée, placeholder propre |
| Profil personnel | Tous | Top bar droite (avatar) | `/profiles/:userId` | OK | Lien vers profil de l'utilisateur connecté |
| Déconnexion | Tous | Top bar droite | — | OK | Bouton dans l'en-tête |
| Visio / Activités | élève, formateur | Rail gauche — Cours | `/activities` | OK | |
| Demandes ouvertes | formateur, AP | Rail gauche — Cours | `/open-activities` | OK | |
| Cahier de texte | élève, parent, formateur, RP, AP | Rail gauche | `/pedagogical-log` | OK | |
| Mémo | élève | Rail gauche — Cours | `/memos` | OK | Élève uniquement (création) |
| Carnet personnel | élève | Rail gauche — Cours | `/notebook/:userId` | OK | Réservé élève |
| Exercices | élève, formateur, RP, AP | Rail gauche — Contenus | `/content/exercises` | OK | Phase 3 — placeholder fonctionnel |
| Évaluations | élève, formateur, RP, AP | Rail gauche — Contenus | `/content/evaluations` | OK | Phase 3 — placeholder fonctionnel |
| Tutos-vidéos | élève, formateur, RP, AP | Rail gauche — Contenus | `/content/tutorials` | OK | Phase 3 — placeholder fonctionnel |
| Forums | élève, formateur, RP, AP | Rail gauche — Communauté | `/community/forums` | OK | Phase 3 — placeholder fonctionnel |
| Parcours | élève, formateur, RP, AP | Rail gauche — Communauté | `/community/paths` | OK | Phase 3 — placeholder fonctionnel |
| Jeux | élève | — | — | Supprimé du rail | Fonctionnalité phase 3 non développée — aucune route ni page n'existent |
| Demandes de rattachement parent | parent | Rail gauche — Démarches | `/parent-link-requests` | OK | Route ajoutée dans App.tsx |
| Boîte de validation rattachement | élève, RP, TI | Rail gauche — Validation | `/parent-link-requests/inbox` | OK | Route ajoutée dans App.tsx |
| Mes élèves suivis | formateur, RP, AP, parent | Rail gauche — Suivi | `/my-students` | OK | Route ajoutée dans App.tsx |
| Documents légaux personnels | élève, parent, formateur, RP, AF | Rail gauche — Compte | `/legal` | OK | Retiré du menu haut — appartient au profil/compte |
| Profil financier | parent, AF, RP, TI | Rail gauche — Compte | `/finance` / `/finance/:ownerId` | OK | |
| Archives pédagogiques | élève, parent, formateur, RP, AF, TI | Menu haut / Rail | `/archives` / `/archives/:studentId` | OK | |
| Archives financières | parent, AF, RP, TI | Menu haut | `/archives` | OK | Filtrées par le backend selon le rôle |
| Rémunérations formateur | formateur, AF | Rail gauche — Compte / Finances | `/teacher-payment-requests` | OK | Rebaptisé "Rémunérations" dans le rail formateur |
| Tableau de bord AF | AF | Rail gauche — Finances | `/admin/finance` | OK | Retiré du menu haut "Espace AF" — intégré au rail |
| Modèles légaux | AF | Rail gauche — Documents | `/legal/templates` | OK | Label "Modèles légaux" (was "Modèles") |
| Exports activité | RP, AP, TI, AF | Rail gauche — Finances / Administration | `/admin/activities/export` | OK | |
| Délégations | RP, TI | Rail gauche — Gestion / Administration | `/delegations` | OK | Retiré du menu haut — dans le rail |
| Gestion comptes | RP, TI | Rail gauche — Administration | `/admin/accounts` | OK | Retiré du menu haut |
| Incidents | TI | Rail gauche — Administration | `/incidents` | OK | |
| Masquages temporaires | TI | Rail gauche — Administration | `/admin/observability/visibility-overrides` | OK | |
| Métadonnées site | TI | Rail gauche — Administration | `/admin/observability/site-metadata` | OK | Ajouté (manquait) |
| Journaux activité | RP, AF, TI | Rail gauche — Observabilité | `/admin/observability/activity-log` | OK | |
| Logs techniques | TI | Rail gauche — Observabilité | `/admin/observability/technical-logs` | OK | |
| Santé services | TI, RP | Rail gauche — Observabilité | `/admin/observability/health` | OK | |
| Orchestration / Workflows | TI, RP, AF | Rail gauche — Observabilité | `/admin/orchestration/workflows` | OK | |
| Activité globale | RP, AP, TI, AF | Rail gauche — Observabilité | `/admin/activity` | OK | |
| Contenus à valider | RP, AP | Rail gauche — Validation / Contenus | `/content/validation` | OK | |
| Tableau de bord TI | TI | Dashboard | `/admin/observability` | OK | DashboardPage redirige `/dashboard/ti` → `/admin/observability` |
| Tableau de bord AF | AF | Dashboard | `/admin/finance` | OK | DashboardPage redirige `/dashboard/af` → `/admin/finance` |
| Recherche professeur | RP | À confirmer | — | Phase 2 — à créer | Fonctionnalité phase 2, aucune page ni route existante |
| Stats (chiffres) | RP, AF, TI | À confirmer | — | Phase 2/3 — à créer | Les stats détaillées sont dans `/archives` pour l'instant |

---

## 2. Fichiers modifiés

| Fichier | Nature de la modification |
|---|---|
| `apps/web/src/components/Layout.tsx` | Refonte complète du menu haut et des rails par rôle |
| `apps/web/src/components/dashboard/DashboardShell.tsx` | Notification bell → `/notifications` (was `/dashboard`) |
| `apps/web/src/pages/EleveDashboardPage.tsx` | Ajout "Demandes" dans top nav, retrait "Jeux" du rail |
| `apps/web/src/pages/ParentDashboardPage.tsx` | Refonte top nav (retrait "Finances") + refonte rail |
| `apps/web/src/pages/ProfesseurDashboardPage.tsx` | Rail : "Mes élèves" → `/my-students`, ajout "Rémunérations" |
| `apps/web/src/pages/RpDashboardPage.tsx` | Retrait "Comptes" du top nav, refonte rail |
| `apps/web/src/pages/ApDashboardPage.tsx` | Retrait "Contenus" et "Forums" du top nav |
| `apps/web/src/App.tsx` | Ajout routes : `/notifications`, `/my-students`, `/parent-link-requests`, `/parent-link-requests/inbox` |
| `apps/web/src/pages/NotificationsPage.tsx` | Nouvelle page créée (placeholder propre) |
| `apps/web/test/pages/LegalTemplateAdminPage.test.tsx` | `getByText` → `getAllByText` (doublon légit rail + h1) |

---

## 3. Fonctionnalités déplacées et nouveaux emplacements

| Fonctionnalité | Ancien emplacement | Nouvel emplacement | Raison |
|---|---|---|---|
| Admin (lien) | Menu haut top nav | Supprimé du top nav (disponible dans chaque rail) | Violation règle top-nav |
| Délégations | Menu haut top nav | Rail rôle RP et TI | Outil métier, pas une zone transversale |
| Finances (AF) | Menu haut top nav | Rail AF — "Tableau de bord AF" | Outil métier AF |
| Paiements (formateur) | Menu haut top nav | Rail formateur — "Rémunérations" | Outil métier formateur |
| Espace AF | Menu haut top nav | Rail AF — "Tableau de bord AF" | Doublon et mauvaise catégorie |
| Calendrier enfant (parent rail) | "Calendrier enfant" | "Calendrier" | Libellé plus neutre |
| Mes élèves (formateur) | `/contacts` | `/my-students` | Route dédiée créée |
| Notifications (cloche) | Lien vers `/dashboard` | Lien vers `/notifications` | Règle : la cloche doit pointer vers les notifications |
| Jeux (élève) | Rail — Communauté | Supprimé | Aucune route ni page n'existent — phase 3 non développée |
| Documents légaux (parent rail) | Groupe "Finances" | Groupe "Compte" | Les documents légaux sont personnels, pas financiers |

---

## 4. Routes manquantes ou placeholders créés

| Route | Page | Nature |
|---|---|---|
| `/notifications` | `NotificationsPage.tsx` | Placeholder propre avec état vide "Aucune notification pour l'instant." |
| `/my-students` | `MyStudentsPage.tsx` | Page existante désormais routée |
| `/parent-link-requests` | `ParentLinkRequestPage.tsx` | Page existante désormais routée |
| `/parent-link-requests/inbox` | `ParentLinkRequestsInboxPage.tsx` | Page existante désormais routée |

**Routes encore manquantes (non créées dans cette session) :**
- `/community/games` — Jeux phase 3 non développés, retiré des rails

---

## 5. Fonctionnalités laissées en option (phase 2/3)

| Fonctionnalité | Phase | État |
|---|---|---|
| Recherche professeur | Phase 2 | Aucune page ni route — à créer en phase 2 |
| Stats détaillées (tableaux de bord chiffrés) | Phase 2/3 | Redirigé vers `/archives` en attendant |
| Jeux (élève) | Phase 3 | Retiré des rails — à ajouter quand la page et la route existeront |
| Contexte actif (barre sous le header) | Phase 2 | Non implémenté — à faire quand le contexte parent/professeur sera développé |
| Sélecteur d'élève (pages détaillées parent) | Phase 2 | Non implémenté — prévu dans les règles UX parent multi-élèves |

---

## 6. Vérifications effectuées

- [x] Inventaire complet de toutes les routes App.tsx (plus de 45 routes)
- [x] Inventaire des pages dans `apps/web/src/pages/` (68 fichiers)
- [x] Lecture des fichiers de référence : `docs/routes.md`, `docs/api-mapping.md`, `.claude/design/front-design.md`, `.claude/agents/front-developper.md`
- [x] Retrait du lien mort `/community/games` (aucune page, aucune route)
- [x] Ajout des routes manquantes pour 4 pages existantes non routées
- [x] Menu haut nettoyé : uniquement zones transversales (Accueil, Calendrier, Contacts, Messages, Demandes, Stats/Archives)
- [x] Notification bell corrigée vers `/notifications` dans Layout.tsx ET DashboardShell.tsx
- [x] Logique rail par rôle cohérente entre Layout.tsx (pages génériques) et les DashboardPage* (pages dashboard)
- [x] Documents légaux déplacés dans la section "Compte" pour les rôles appropriés (pas dans top nav)
- [x] Délégations, Finances AF, Paiements AF retirés du top nav et intégrés aux rails rôle
- [x] Tests lancés : 736 tests passent (75 fichiers de test)
- [x] Un test adapté : `LegalTemplateAdminPage.test.tsx` — `getByText` → `getAllByText` (doublon légitime entre rail et h1)

### Responsive
- PC : rail visible, masquable via le bouton toggle dans DashboardShell (implémenté)
- Tablette : rail réduit à 148px (implémenté via `@media`)
- Mobile : rail masqué, burger menu visible, tiroir rail accessible via "Menu outils" (implémenté)
- Aucune initiale seule dans les menus — tous les libellés sont complets

### Design
- Fond clair, cartes blanches, bordures fines, ombres douces — conservé
- Accent par rôle via `accentClass` — conservé
- Typographie via `var(--font-heading)` et `var(--font-body)` — conservée
- Données fictives dans la zone centrale : aucune ajoutée, celles existantes sont des états vides légitimes

---

## 7. Architecture résultante du menu haut

```
[VisioMath] | Accueil | Calendrier | Contacts | Messages | Demandes | Stats/Archives |     | 🔔 | [Avatar] Déconnexion |
```

Items conditionnels :
- Calendrier : élève, parent, formateur, AP, RP
- Contacts : élève, parent, formateur, RP, AP
- Messages : élève, parent, formateur, RP, AP, TI
- Demandes : élève, parent, RP
- Stats/Archives : tous sauf TI et AF administratif (mais ils ont accès via leurs rails)
