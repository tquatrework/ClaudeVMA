# Front — loginIdentifier — 2026-06-22

## Statut global : ✅ Toutes les modifications appliquées — build OK

---

## Détail par point

### 1. AuthContext ✅
- `AuthUser` : ajout du champ `loginIdentifier: string`
- `login(loginIdentifier, password)` : renommage du paramètre + body API mis à jour
- Fichier : `src/context/AuthContext.tsx`

### 2. LoginPage ✅
- State `email` → `loginIdentifier`
- Label : "Identifiant de connexion", `type="text"`, placeholder `jean.dupont`
- Appel : `login(loginIdentifier, password)`
- Lien ajouté : "Identifiant oublié ?" → `/recover-identifier`
- Fichier : `src/pages/LoginPage.tsx`

### 3. PasswordResetPage ✅
- State `emailAddress` → `loginIdentifier`
- Label : "Identifiant de connexion", `type="text"`
- Body API : `{ loginIdentifier }` (était `{ email }`)
- Message confirmation mis à jour
- Lien "Identifiant oublié ?" → `/recover-identifier` ajouté
- Fichier : `src/pages/PasswordResetPage.tsx`

### 4. RecoverIdentifierPage ✅ (NOUVEAU)
- Champ email (type email, requis), label "Email de contact"
- Bouton "Récupérer mes identifiants"
- Appel : `POST /auth/recover-identifier { email }`
- Message de succès toujours affiché après soumission
- Lien retour `/login`
- Fichier : `src/pages/RecoverIdentifierPage.tsx`

### 5. Route `/recover-identifier` ✅
- Import + `<Route>` ajoutés dans `src/App.tsx`

### 6. Formulaires d'inscription ✅
- `StudentRegistrationPage`, `TeacherRegistrationPage`, `ParentRegistrationPage`
- `loginIdentifier: ''` ajouté dans le state initial
- State `isEmailAlreadyUsed` ajouté
- `checkEmailAvailability()` déclenché au `onBlur` du champ email
- Bannière warning jaune si email déjà utilisé (non bloquant)
- Champ "Identifiant de connexion" ajouté après le champ email (éditable, helper texte)
- `loginIdentifier` inclus dans le body des appels API de création
- Fichiers modifiés :
  - `src/pages/StudentRegistrationPage.tsx`
  - `src/pages/TeacherRegistrationPage.tsx`
  - `src/pages/ParentRegistrationPage.tsx`

### 7. Affichages utilisateur connecté ✅
- `user?.email` → `user?.loginIdentifier` dans :
  - `src/components/Layout.tsx` (desktop ligne ~147 + mobile ligne ~221)
  - `src/pages/DashboardPage.tsx` (~ligne 190)
  - `src/pages/AfFinanceDashboardPage.tsx` (~ligne 84)

### Correctif annexe ✅
- `src/test-helpers.tsx` : ajout de `loginIdentifier: 'test.user'` dans `makeAuthUser()` pour satisfaire le type `AuthUser` mis à jour

---

## Build
`npm run build` → ✅ 184 modules transformés, aucune erreur TypeScript.

## Fichiers non modifiés (conformément aux instructions)
- `LegalDocumentsPage.tsx`, `ContactsPage.tsx`, `MessagesPage.tsx`, `ActivityLogPage.tsx`, `SiteMetadataEditor.tsx`, `TeacherCandidatesView.tsx`
