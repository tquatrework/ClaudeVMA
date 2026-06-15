# Rapport de tests frontend — 2026-06-13

## Framework de test utilisé

- **Vitest** (v1.6.1) — runner + assertions
- **@testing-library/react** (v16) — rendu de composants React
- **@testing-library/user-event** (v14) — interactions utilisateur simulées
- **jsdom** — DOM virtuel pour les tests unitaires
- **Environnement** : `jsdom` configuré dans `vite.config.ts`

---

## Tests ajoutés

### `src/__tests__/apiClient.test.ts`
Vérifie les contrats du client API centralisé :
- La `baseURL` est bien `/api/v1`
- Le header `Authorization: Bearer <token>` est injecté à chaque requête quand un token est présent
- Aucun header Authorization quand aucun token n'est stocké
- Sur réponse 401 : le localStorage est vidé et `window.location.href` est redirigé vers `/login`

### `src/pages/__tests__/LoginPage.test.tsx`
- Rendu des champs email, mot de passe et bouton de soumission
- Présence du lien "Créer un compte"
- `login()` est appelée avec les bons paramètres
- Navigation vers `/dashboard` après connexion réussie
- Affichage du message d'erreur API
- Message d'erreur par défaut si l'API ne renvoie pas de message
- Bouton désactivé en état `isLoading`

### `src/pages/__tests__/RegisterPage.test.tsx`
- Rendu des champs email, mot de passe, sélecteur de rôle
- Les 3 rôles auto-inscriptibles (`eleve`, `parent_financeur`, `formateur`) sont présents
- `POST /accounts` est appelé avec le bon payload
- Redirection vers `/login` après inscription réussie
- Affichage de l'erreur API
- État de chargement pendant la soumission

### `src/pages/__tests__/DashboardPage.test.tsx`
- Salutation avec l'email de l'utilisateur
- Indicateur de chargement (stat cards à "…")
- Réponse paginée `{ data, meta }` pour les notifications
- Réponse tableau direct pour les notifications
- Empty state "Aucune notification"
- Marquage d'une notification lue via `POST /notifications/:id/read`
- Suppression d'une notification via `DELETE /notifications/:id`
- Quick-card "Mon carnet" visible uniquement pour le rôle `eleve`
- "Mon carnet" absent pour `parent_financeur`
- Bannière de consentements pour `validationStatus: pending`
- Empty state "Aucune séance à venir"
- Query `/calendar?studentId=student-1` pour le rôle élève

### `src/pages/__tests__/CalendarPage.test.tsx`
- Indicateur de chargement
- Affichage des activités via `GET /calendar`
- Empty state "Aucune activité planifiée"
- Message d'erreur sur échec API (500)
- Message "Accès refusé" sur 403
- Bouton "Planifier une séance" visible pour formateur
- Bouton absent pour élève
- Ouverture du formulaire de création
- `POST /calendar` avec le bon payload (type + teacherId)
- Query avec `teacherId=teacher-1` pour le rôle formateur

### `src/pages/__tests__/ActivitiesPage.test.tsx`
- Indicateur de chargement
- Liste des activités avec titres
- Stat cards (Planifiées / En cours / Terminées)
- Empty state global
- Filtrage par statut (ex: "Annulée")
- Empty state pour un filtre sans résultats
- Erreur API 500
- Erreur 403 "Accès refusé"
- Bouton "Réessayer" présent sur erreur
- Query avec `studentId` pour le rôle élève

### `src/pages/__tests__/MessagesPage.test.tsx`
- Indicateur de chargement
- Liste des conversations
- Empty state "Aucune conversation"
- Erreur de chargement
- Badge de messages non lus
- Chargement des messages d'une conversation via `GET /messages/conversation/:id`
- `PATCH /messages/:id/read` pour les messages non lus ouverts
- `POST /conversations/:id/messages` pour envoyer un message
- Affichage du message envoyé dans le fil
- `POST /conversations` pour créer une nouvelle conversation

### `src/pages/__tests__/TeacherRequestsPage.test.tsx`
- Indicateur de chargement
- Liste des demandes avec IDs et descriptions
- Empty state "Aucune demande"
- Erreur API 500
- Erreur 403 "Accès refusé"
- Onglets de filtre (toutes, en attente, acceptée, refusée, annulée)
- Filtre par statut actif
- Empty state pour un filtre sans résultats
- Bouton "Nouvelle demande" visible pour `eleve` et `parent_financeur`
- Bouton absent pour `formateur`
- Ouverture du formulaire de création
- `POST /requests` avec le bon payload
- Ajout de la nouvelle demande à la liste

### `src/pages/__tests__/ProfilePage.test.tsx`
- Indicateur de chargement
- Sections profil administratif et pédagogique
- Affichage des valeurs de champs
- Erreur 404 "Profil introuvable"
- Erreur 403 "Accès refusé"
- Bouton "Modifier" visible pour son propre profil
- Notes internes absentes pour le rôle élève
- Notes internes visibles pour le rôle RP
- Ajout de note interne via `POST /profiles/:userId/internal-notes`
- Affichage de la nouvelle note après ajout

### `src/pages/__tests__/ProfileEditPage.test.tsx`
- Indicateur de chargement
- Pré-remplissage du formulaire administratif avec les données existantes
- `PUT /profiles/:userId/administrative` sur soumission
- Message de succès après sauvegarde profil administratif
- Message d'erreur sur échec de sauvegarde
- Onglet pédagogique visible pour le rôle élève
- Navigation vers l'onglet pédagogique
- `PUT /profiles/:userId/pedagogical` sur soumission
- Message de succès après sauvegarde profil pédagogique
- Navigation retour vers la page profil

### `src/__tests__/userJourneys.test.tsx` — Parcours utilisateur
5 journeys d'intégration couvrant la navigation entre pages :

1. **Login → Dashboard** : connexion formulaire → landing sur le dashboard avec salutation
2. **Dashboard → Calendrier → Création séance** : navigation + création séance via `POST /calendar`
3. **Dashboard → Messagerie → Envoi message** : navigation + sélection conversation + envoi via `POST /conversations/:id/messages`
4. **Dashboard → Demandes professeur → Création demande** : navigation + création via `POST /requests`
5. **Dashboard → Profil → Édition** : navigation profil → édition → sauvegarde via `PUT /profiles/:userId/administrative`

---

## Routes mockées

| Route | Méthode | Tests |
|---|---|---|
| `/auth/login` | POST | LoginPage, Journey 1 |
| `/accounts` | POST | RegisterPage |
| `/notifications` | GET | DashboardPage |
| `/notifications/:id/read` | POST | DashboardPage |
| `/notifications/:id` | DELETE | DashboardPage |
| `/dashboards/me` | GET | DashboardPage |
| `/calendar` | GET | CalendarPage, ActivitiesPage, DashboardPage |
| `/calendar` | POST | CalendarPage, Journey 2 |
| `/conversations` | GET | MessagesPage, Journey 3 |
| `/conversations` | POST | MessagesPage |
| `/conversations/:id/messages` | POST | MessagesPage, Journey 3 |
| `/messages/conversation/:id` | GET | MessagesPage |
| `/messages/:id/read` | PATCH | MessagesPage |
| `/requests` | GET | TeacherRequestsPage, DashboardPage |
| `/requests` | POST | TeacherRequestsPage, Journey 4 |
| `/profiles/:userId` | GET | ProfilePage, ProfileEditPage |
| `/profiles/:userId/administrative` | PUT | ProfileEditPage, Journey 5 |
| `/profiles/:userId/pedagogical` | PUT | ProfileEditPage |
| `/profiles/:userId/internal-notes` | GET | ProfilePage |
| `/profiles/:userId/internal-notes` | POST | ProfilePage |
| `/relations/teacher-student/:userId` | GET | ProfilePage |

---

## Parcours utilisateur couverts

- Login → Dashboard → notifications réelles (paginated `{ data, meta }`)
- Dashboard → Calendrier → Création séance (formateur)
- Dashboard → Messagerie → Sélection conversation → Envoi message
- Dashboard → Demandes professeur → Création demande (élève)
- Dashboard → Profil → Édition profil administratif

---

## Résultats finaux

```
Test Files  12 passed (12)
     Tests  103 passed (103)
  Start at  2026-06-13
```

---

## Zones non testées et pourquoi

| Zone | Raison |
|---|---|
| `ActivityDetailPage` | Page de détail, pas de parcours autonome dans l'instruction |
| `VideoPage` | Dépend d'un roomId dynamique ; intégration visio non testée unitairement |
| `PedagogicalLogPage` / `NotebookPage` / `MemosPage` | Pages présentes mais hors scope du lot demandé |
| `ConsentsPage` | Présente mais hors scope du lot |
| `IncidentsPage` / `AdminActivityPage` / `AgreementsPage` | Hors scope lot |
| Tests E2E (Playwright) | Non installé ; jsdom suffit pour les tests unitaires/composants demandés |
| Refresh automatique du JWT (401 interceptor en flux réel) | Testé au niveau interceptor unitaire, pas en navigation complète |

---

## Corrections appliquées à l'infrastructure de test

- **`src/test-setup.ts`** : ajout du stub `window.HTMLElement.prototype.scrollIntoView = () => {}` pour éviter l'erreur jsdom sur `MessagesPage` (usage de `ref.scrollIntoView`)
- **`src/test-helpers.tsx`** : helper partagé `renderWithRouter` et `makeAuthUser` (utilisé indirectement)
- Les inputs sans attribut `htmlFor`/`id` sont interrogés via `getByPlaceholderText` au lieu de `getByLabelText`
- Les éléments dupliqués (email dans nav + contenu, "Mon carnet" dans nav + quick-card) sont gérés via `getAllByText`
