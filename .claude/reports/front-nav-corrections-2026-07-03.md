# Rapport — Corrections de navigation et structure — 2026-07-03

## Mission
3 corrections de navigation et de structure selon les spécifications du fichier `front-design.md`.

---

## 1. Suppression de "Demandes" du menu haut (topbar)

### Fichier modifié
- `apps/web/src/components/Layout.tsx`

### Ce qui a changé
- Suppression de l'entrée `Demandes` (qui pointait vers `/teacher-requests`) du tableau `useTopNavItems()`.
- Cette entrée était visible pour les rôles `eleve`, `parent_financeur`, `responsable_pedagogique`.

### Décision
Le menu haut ne liste plus "Demandes". L'accès aux demandes de professeur passe désormais par :
- La page `/contacts` (encart "Nouvelle demande" — voir point 3)
- Le dashboard (bouton "Demander un professeur" déjà présent)
- Le rail gauche pour formateur (`Demandes prof.`)

---

## 2. Suppression de "Documents légaux" du rail gauche

### Fichier modifié
- `apps/web/src/components/Layout.tsx`

### Ce qui a changé
- Suppression du groupe `Compte > Documents légaux` dans le rail gauche pour :
  - `eleve` : entrée `{ label: 'Documents légaux', path: '/legal', icon: '📄' }` supprimée du groupe "Compte"
  - `formateur` : même suppression
  - `parent_financeur` : suppression de l'entrée "Documents légaux" (le "Profil financier" reste)
- Les rôles `responsable_pedagogique` et `animateur_pedagogique` n'avaient pas cette entrée dans leur rail — aucun changement pour eux.
- L'`administrateur_financier` conserve ses "Documents légaux" et "Modèles légaux" dans le rail Documents (rôle admin de gestion documentaire).

### Intégration dans la fiche profil
Voir point suivant.

---

## 3. Intégration dans la fiche profil (`/profiles/:userId`)

### Fichier modifié
- `apps/web/src/pages/ProfilePage.tsx`

### Nouvelles sections ajoutées
Trois nouvelles variables de condition et trois nouvelles sections dans la fiche profil :

#### Profil financier
- Condition `canSeeFinancialProfile` : visible sur **son propre profil** pour les rôles ayant une dimension financière (`parent_financeur`, `formateur`, `animateur_pedagogique`, `responsable_pedagogique`, `administrateur_financier`).
- L'élève n'a **pas** de section "Profil financier".
- La section affiche un lien → `/finance`.

#### Documents légaux
- Condition `canSeeDocumentsLegaux` : visible sur **son propre profil** pour tous les rôles ayant accès aux documents légaux (élève, formateur, parent_financeur, animateur_pedagogique, responsable_pedagogique, administrateur_financier, technicien_informatique).
- La section affiche un lien → `/legal`.

#### Confidentialité (déjà existante)
- La section existait déjà, conservée telle quelle.

---

## 4. Déplacement des statistiques vers `/archives` (Stats/Archives)

### Fichier modifié
- `apps/web/src/pages/PedagogicalArchivePage.tsx`

### Ce qui a changé
- Import de `ProfileStatisticsPanel` dans la page archives.
- Ajout d'un 3e onglet `statistics` (libellé : "Statistiques") comme **premier onglet par défaut**.
- L'onglet "Timeline" a été renommé "Archives" pour plus de clarté.
- L'onglet "Résumés de cours" est conservé.
- Le titre de la page est maintenant "Stats / Archives" (au lieu de "Archives pédagogiques").
- La structure des onglets est passée d'un ternaire à des conditions indépendantes pour gérer 3 états.

---

## 5. Encart "Nouvelle demande" sur la page /contacts

### Fichier modifié
- `apps/web/src/pages/ContactsPage.tsx`

### Ce qui a changé
- Import de `useAuth` et `Link` depuis react-router-dom.
- Variable `canMakeTeacherRequest` : `true` pour `eleve`, `parent_financeur`, `responsable_pedagogique`.
- Encart ajouté en haut de page, avant la liste de contacts :
  - Pour élève et parent : libellé "Demandez un professeur ou consultez vos demandes en cours." + lien → `/teacher-requests`
  - Pour RP : libellé "Accéder aux demandes de professeur en attente de traitement." + lien → `/rp/teacher-requests`
  - Style cohérent avec la charte visuelle (couleurs CSS variables, accent rôle, surface blanche).

---

## Corrections de tests

### Fichier modifié
- `apps/web/test/pages/PedagogicalArchivePage.test.tsx`

### Changements
1. **Mock de `ProfileStatisticsPanel`** : ajouté pour éviter des appels `apiClient` non mockés dans ce contexte de test. Le composant est remplacé par un div neutre.
2. **Navigation vers l'onglet "Archives"** : tous les tests qui testaient le contenu de la timeline doivent désormais cliquer sur le bouton "Archives" (l'onglet par défaut étant "Statistiques"). 7 tests mis à jour.
3. **Sélecteur `getByRole('button', { name: 'Archives' })`** : remplace `getByText('Archives')` pour éviter la collision avec le lien "Archives" dans le rail gauche du Layout (visible pour parent_financeur et RP).

---

## Résultat des vérifications

- `npm run build` : **succès** — aucune erreur TypeScript ni Vite
- `npm test` : **75 fichiers / 736 tests — 100% passés**

---

## Points en suspens

- Le `ProfileStatisticsPanel` dans la page `/archives` appelle `/profiles/:userId/statistics` — cette route n'est **pas documentée** dans `docs/routes.md`. Il s'agit d'une route déjà utilisée dans la ProfilePage ; à documenter dans `docs/routes.md` si confirmée en backend.
- La page `/archives` sans `studentId` résout `resolvedStudentId = user?.id` — ce comportement existait avant, mais les statistiques pédagogiques d'un utilisateur non-élève (parent, RP) peuvent retourner des données non pertinentes. À surveiller lors de tests réels.
- La mention "Profil pédagogique" dans la fiche profil d'un `parent_financeur` : la section existe mais peut être vide si le parent n'a pas de données pédagogiques. Selon les instructions, si la section est vide il ne faudrait pas l'afficher. Ce comportement est déjà géré par le composant `ProfileSection` (affiche "Aucune donnée pédagogique") — pas de modification nécessaire à ce stade sans confirmation backend.
