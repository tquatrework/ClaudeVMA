# Audit routage — teacher-request-service — 2026-06-24

## Statut global : ⚠️ (1 route manquante signalée, préfixes conformes)

---

## 1. Préfixe global (main.ts)

Aucun `setGlobalPrefix` présent dans `main.ts`.
Conforme à la convention : nginx strip le préfixe `/api/v1/teacher-requests`, le service reçoit les sous-chemins à la racine.

---

## 2. Préfixe de chaque contrôleur

| Contrôleur | Fichier | Préfixe avant | Préfixe après | Statut |
|---|---|---|---|---|
| `TeacherRequestController` | `teacher-request.controller.ts` | `'requests'` | — | ✅ Conforme, inchangé |
| `ProposalController` | `teacher-request.controller.ts` | `'proposals'` | — | ✅ Conforme, inchangé |
| `AssignmentController` | `teacher-request.controller.ts` | `'assignments'` | — | ✅ Conforme, inchangé |

Les trois contrôleurs sont regroupés dans un seul fichier `teacher-request.controller.ts`.
Aucune correction n'était nécessaire sur les préfixes.

---

## 3. Routes accept/reject sur proposals

| Route | Présente ? |
|---|---|
| `POST /proposals/:proposalId/accept` | ✅ Oui |
| `POST /proposals/:proposalId/reject` | ❌ Non — absente |

La route `reject` n'existe pas dans `ProposalController`. Le contrôleur expose uniquement `accept`.
Elle doit être ajoutée (non faite dans cet audit — signalement uniquement selon la consigne).

---

## 4. Cohérence interne

- Les guards (`JwtAuthGuard`) et le décorateur `@CurrentUser()` sont définis dans `common/` et importés correctement dans le contrôleur. Aucune dépendance à un préfixe global.
- Le module `TeacherRequestModule` enregistre bien les trois contrôleurs : `TeacherRequestController`, `ProposalController`, `AssignmentController`.
- `app.module.ts` importe `TeacherRequestModule` et `HealthModule` sans préfixe parasite.

---

## 5. Fichiers modifiés

Aucun fichier modifié (audit uniquement, pas de commit).

---

## 6. Blocages / points en suspens

- **Route `POST /proposals/:proposalId/reject` manquante** : à implémenter dans `ProposalController` (symétrie avec `accept`). Implique une méthode `rejectProposal` dans `TeacherRequestService`.
- Les routes `GET /proposals/:id` et `GET /assignments/:id` mentionnées dans la convention ne sont pas présentes non plus. À confirmer si elles sont requises en phase 1.
