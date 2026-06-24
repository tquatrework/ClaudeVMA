# Audit frontend — rôle parent_financeur
Date : 2026-06-23  
Scope : apps/web/src/

---

## Ce qui EXISTE

### 1. Authentification & rôle
- `AuthContext.tsx` : `parent_financeur` est un membre de l'union `UserRole`. Méthode `hasRole()` disponible partout.
- `useAuth.ts` hook pour consommer le contexte.
- `isInternalRole()` exclut explicitement le parent (correct).

### 2. Inscription
- `ParentRegistrationPage.tsx` (`/register/parent`) — formulaire complet : email, loginIdentifier, mot de passe. Appel `POST /accounts/parents`.

### 3. Rattachement parent↔élève (flux complet)
- `api/parentLinkRequest.ts` — 4 fonctions : `createParentLinkRequest`, `fetchParentLinkRequests`, `approveParentLinkRequest`, `rejectParentLinkRequest`.
- `ParentLinkRequestPage.tsx` (`/parent-link-requests/new`) — formulaire de demande de rattachement par studentId + liste "Mes demandes" avec statuts (pending/approved/rejected). Protégée par `allowedRoles: ['parent_financeur']`.
- `ParentLinkRequestsInboxPage.tsx` (`/parent-link-requests/inbox`) — boîte de réception pour eleve/RP/TI. Boutons Accepter/Refuser.
- Dashboard `DashboardPage.tsx` : QuickCard "Rattacher un élève" → `/parent-link-requests/new` (visible uniquement pour parent_financeur).

### 4. Navigation (Layout.tsx)
Le parent voit dans la navbar :
- Tableau de bord (tous)
- Calendrier (tous)
- Activités (tous)
- Messages (tous)
- Demandes prof (tous)
- Mémos (tous)
- **Finances** → `/finance` (parent_financeur | administrateur_financier)
- **Documents légaux** → `/legal` (eleve | parent_financeur | formateur | administrateur_financier)
- **Archives** → `/archives` (tous sauf TI/AF)

Le parent NE voit PAS dans la navbar :
- Mon carnet (eleve only)
- Incidents (TI/RP only)
- Admin, Comptes, Délégations, Espace AF (internes)
- Paiements formateur (formateur/AF)
- **Aucun lien vers "Mes élèves" ou une liste d'élèves liés**
- **Aucun lien vers `/parent-link-requests/new` dans la navbar** (uniquement dans le dashboard QuickCard)

### 5. Pages accessibles au parent (sans restriction de rôle ou avec parent inclus)
- `/dashboard` — tableau de bord générique + QuickCard "Rattacher un élève"
- `/calendar` — calendrier (parent_financeur : aucun type d'événement créable, `calendarTypes.ts` ligne 48 : `parent_financeur: []`)
- `/activities` et `/activities/:id` — lecture seule (`isParent` détecté, pas de boutons action)
- `/pedagogical-log` — lecture seule (read-only banner affiché, `canWrite` exclut parent)
- `/archives` — accès avec restriction `notebook_entry` côté serveur + côté client (`canAccessNotebook = !isParentFinanceur`)
- `/messages` — accès complet
- `/teacher-requests` et `/teacher-requests/:id` — le parent peut créer (`canCreate` inclut `parent_financeur`) et supprimer des demandes
- `/finance` — profil financier du parent
- `/legal` — documents légaux
- `/memos` — redirigé ou bloqué (MemosPage.tsx ligne 30 : `if (hasRole('parent_financeur'))` → comportement bloquant)
- `/profiles/:userId` — lecture selon droits serveur

### 6. Restrictions correctement implémentées
- `NotebookPage.tsx` : `if (hasRole('parent_financeur')) { /* bloqué PLOG-FB-001 */ }`
- `VideoJoinPage.tsx` : `isParent` détecté — le join vidéo est interdit (VID-FB-001)
- `RecordingListPanel.tsx` : `isParent` → les enregistrements sont masqués
- `RecordingCommentTimeline.tsx` : `isParent` → les commentaires sont masqués
- `PedagogicalArchivePage.tsx` : `canAccessNotebook = !isParentFinanceur`
- `MemosPage.tsx` : parent bloqué (mémo réservé à l'élève)

---

## LACUNES IDENTIFIÉES

### GAP 1 — CRITIQUE : Aucune page "Mes élèves"
Il n'existe **aucune page ni composant** listant les élèves rattachés au parent connecté.  
Une fois la demande de rattachement approuvée, le parent n'a aucun écran pour :
- voir la liste de ses élèves liés
- naviguer vers le profil/calendrier/cahier de texte d'un élève spécifique
- savoir quel élève il suit

L'API `/profiles/:userId` permet de lire un profil d'élève lié, mais il n'y a aucune UI pour les lister.

### GAP 2 — Pas de lien navbar vers le rattachement
`/parent-link-requests/new` n'est exposé que via le QuickCard du dashboard.  
Il n'y a aucun lien dans la barre de navigation pour le parent_financeur.

### GAP 3 — Dashboard générique, non personnalisé pour le parent
Le `DashboardPage` est identique pour tous les rôles. Pour le parent :
- La section "Demandes professeur récentes" n'a pas de sens s'il n'est pas directement concerné
- Il n'y a aucune section "Mes élèves" dans le dashboard
- Il n'y a aucun widget dédié (solde crédits, prochaine séance de ses élèves, etc.)

### GAP 4 — Archives non contextualisées pour le parent
`/archives` (sans studentId) résout `studentId = user?.id` ce qui est la logique élève.  
Le parent devrait accéder aux archives **d'un de ses élèves** (`/archives/:studentId`), mais sans page "Mes élèves", il ne peut pas naviguer vers cette URL avec le bon studentId.

### GAP 5 — Cahier de texte non contextualisé
Même problème : `PedagogicalLogPage` charge les logs sans studentId précis. Le parent voit les logs de l'utilisateur connecté, pas de son élève.

### GAP 6 — Calendrier non filtré par élève
Le calendrier ne distingue pas "mes séances en tant que parent de X". Pas de sélecteur d'élève.

---

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `apps/web/src/pages/ParentLinkRequestPage.tsx` | Formulaire rattachement (EXISTS) |
| `apps/web/src/pages/ParentLinkRequestsInboxPage.tsx` | Inbox élève/RP/TI (EXISTS) |
| `apps/web/src/pages/ParentRegistrationPage.tsx` | Inscription parent (EXISTS) |
| `apps/web/src/api/parentLinkRequest.ts` | API client rattachement (EXISTS) |
| `apps/web/src/components/Layout.tsx` | Nav — pas de lien "Mes élèves" (GAP) |
| `apps/web/src/pages/DashboardPage.tsx` | Dashboard — QuickCard rattachement mais pas de section élèves (PARTIAL) |
| `apps/web/src/pages/PedagogicalArchivePage.tsx` | Archives — restriction notebook OK, mais sans sélecteur élève (GAP) |
| `apps/web/src/pages/PedagogicalLogPage.tsx` | Cahier de texte — read-only OK, mais sans contexte élève (GAP) |

---

## Résumé
- Infrastructure minimale du parent : ✅ (inscription, rattachement, accès finances/legal/archives)
- Flux rattachement parent↔élève : ✅ complet des deux côtés
- Restrictions de rôle (notebook, vidéo, mémos) : ✅ correctement implémentées
- Page "Mes élèves" : ❌ inexistante
- Navigation contextualisée (voir le profil/calendrier/log d'UN élève lié) : ❌ inexistante
- Dashboard dédié parent : ❌ inexistant (dashboard générique)
