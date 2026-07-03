# Fix : Bug 404 GET /teacher-requests/requests — Front élève

**Date** : 2026-06-29  
**Statut** : ✅ Corrigé

---

## Diagnostic

### Cause racine

Le frontend appelait `/teacher-requests/requests` (URL complète gateway : `GET /api/v1/teacher-requests/requests`).

Nginx route `location ^~ /api/v1/teacher-requests` et fait `proxy_pass http://teacher_request/requests` — il strip le préfixe `/api/v1/teacher-requests` et le remplace par `/requests`. Donc :

- `GET /api/v1/teacher-requests/requests` → backend reçoit `/requests/requests`
- Le contrôleur backend est `@Controller('requests')` : il n'a pas de route `/requests/requests` → **404**

### URL correctes (via gateway)

| Action | URL front (apiClient) | URL gateway | Backend reçoit |
|---|---|---|---|
| Liste demandes | `GET /teacher-requests` | `/api/v1/teacher-requests` | `/requests` |
| Détail demande | `GET /teacher-requests/:id` | `/api/v1/teacher-requests/:id` | `/requests/:id` |
| Créer demande | `POST /teacher-requests` | `/api/v1/teacher-requests` | `/requests` |
| Changer statut | `PATCH /teacher-requests/:id/status` | `/api/v1/teacher-requests/:id/status` | `/requests/:id/status` |
| Supprimer | `DELETE /teacher-requests/:id` | `/api/v1/teacher-requests/:id` | `/requests/:id` |
| Changer PP | `POST /teacher-requests/pp-change` | `/api/v1/teacher-requests/pp-change` | `/requests/pp-change` |
| Ajouter candidat | `POST /teacher-requests/:id/proposals` | `/api/v1/teacher-requests/:id/proposals` | `/requests/:id/proposals` |
| Sélectionner formateur | `POST /teacher-requests/:id/select` | `/api/v1/teacher-requests/:id/select` | `/requests/:id/select` |
| Répondre (formateur) | `POST /proposals/:id/accept|decline` | `/api/v1/proposals/:id/...` | `/proposals/:id/...` |

---

## Fichiers modifiés

### 1. `apps/web/src/pages/TeacherRequestPage.tsx`

**Corrections :**
- Ligne 70 : `GET /teacher-requests/requests` → `GET /teacher-requests`
- État vide (lignes 194-210) : condition ajoutée `&& !errorMessage` pour éviter doublon avec le bloc erreur
- Message état vide pour élève/parent : **"Vous n'avez pas pour l'instant de professeur attitré"**
- Message état vide pour RP : "Aucune demande" (inchangé)

### 2. `apps/web/src/pages/TeacherRequestsPage.tsx`

**Corrections (déjà appliquées par le linter avant intervention) :**
- Ligne 46 : `GET /teacher-requests/requests` → `GET /teacher-requests`
- Ligne 66 : `POST /teacher-requests/requests` → `POST /teacher-requests`

### 3. `apps/web/src/pages/TeacherRequestDetailPage.tsx`

**Corrections (déjà appliquées par le linter avant intervention) :**
- GET détail : `/teacher-requests/requests/${requestId}` → `/teacher-requests/${requestId}`
- PATCH status : `/teacher-requests/requests/${requestId}/status` → `/teacher-requests/${requestId}/status`
- DELETE : `/teacher-requests/requests/${requestId}` → `/teacher-requests/${requestId}`

### 4. `apps/web/src/components/teacher-requests/TeacherRequestInbox.tsx`

**Corrections :**
- Ligne 35 : `GET /teacher-requests/requests` → `GET /teacher-requests`
- Ligne 69 : `POST /teacher-requests/proposals/:id/...` → `POST /proposals/:id/...` (routing nginx distinct)

### 5. `apps/web/src/components/teacher-requests/TeacherCandidatesView.tsx`

**Corrections :**
- Ligne 61 : `POST /teacher-requests/requests/${requestId}/proposals` → `POST /teacher-requests/${requestId}/proposals`
- Ligne 113 : `POST /teacher-requests/requests/${requestId}/select` → `POST /teacher-requests/${requestId}/select`
- Ligne 87 : `POST /teacher-requests/proposals/:id/...` → `POST /proposals/:id/...` (linter)

---

## Message état vide implémenté

Dans `TeacherRequestPage.tsx`, quand la liste est vide et qu'il n'y a pas d'erreur :

```tsx
{!isLoading && requests.length === 0 && !errorMessage && (
  <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
    <p className="text-gray-500 text-sm font-medium">
      {isEleve || isParentFinanceur
        ? "Vous n'avez pas pour l'instant de professeur attitré"
        : 'Aucune demande'}
    </p>
    {canCreateRequest && (
      <button onClick={() => setIsShowingRequestForm(true)} ...>
        Créer la première demande
      </button>
    )}
  </div>
)}
```

---

## Impact sur les autres vues

- **Vue RP** (`RpTeacherSearchWorkspace`) : utilisait déjà `GET /teacher-requests` — non modifié, inchangé ✅
- **Vue formateur** (`TeacherRequestInbox`) : corrigé (GET liste + route proposals) ✅
- **Vue parent** : même page `TeacherRequestPage` que l'élève — bénéficie de la même correction ✅
- **`ChangePrincipalTeacherDialog`** : `POST /teacher-requests/pp-change` — correct, non modifié ✅
- **`SpecificTeacherRequestForm`** : `POST /teacher-requests` — correct, non modifié ✅

---

## Tests existants

Les tests du module teacher-request front se trouvent dans `apps/web/test/`. Aucun test de ce module n'a été modifié — seules les URLs runtime ont été corrigées.
