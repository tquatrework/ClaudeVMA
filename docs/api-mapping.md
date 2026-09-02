# VisioMath — Matrice de routage API

Référence normative pour tout développement frontend.
Voir `docs/routes.md` pour la documentation complète des routes backend.

## Règle d'or

`apiClient` a pour base `/api/v1` (`VITE_API_BASE_URL`).
**L'URL passée à `apiClient` est exactement le chemin backend — jamais inventé, toujours issu de ce fichier ou de `docs/routes.md`.**

Légende : 🔒 = JWT requis · ⚠️ = gap gateway confirmé · (phase N) = non prioritaire en phase 1

---

## identity-access-service

| Helper `src/api/` | Fonction | URL `apiClient` | Gateway nginx | Backend reçoit |
|---|---|---|---|---|
| *(composants directs)* | login | `/auth/login` | `/api/v1/auth/` public | `/auth/login` |
| *(composants directs)* | refresh | `/auth/refresh` | `/api/v1/auth/` public | `/auth/refresh` |
| *(composants directs)* | check-email | `/accounts/check-email?email=` | `/api/v1/accounts/check-email` public | `/accounts/check-email` |
| *(composants directs)* | inscription élève | `/accounts/students` | `/api/v1/accounts/students` public | `/accounts/students` |
| *(composants directs)* | inscription formateur | `/accounts/teachers` | `/api/v1/accounts/teachers` public | `/accounts/teachers` |
| *(composants directs)* | inscription parent | `/accounts/parents` | `/api/v1/accounts/parents` public | `/accounts/parents` |
| *(composants directs)* | consentements | `/consents` | `/api/v1/consents` 🔒 | `/consents` |

---

## profile-service

| Helper `src/api/` | Fonction | URL `apiClient` | Gateway nginx | Backend reçoit |
|---|---|---|---|---|
| `relations.ts` | `fetchMyContacts` | `/relations/my-contacts` | `/api/v1/relations` 🔒 | `/relations/my-contacts` |
| `relations.ts` | `fetchLinkedStudents` | `/relations/finance-owner-student/:id` | `/api/v1/relations` 🔒 | `/relations/finance-owner-student/:id` |
| `relations.ts` | *(getStudentProfile)* | `/profiles/:studentId` | `/api/v1/profiles` 🔒 | `/profiles/:studentId` |
| `profile.ts` | `fetchProfileStatistics` | `/profiles/:userId/statistics` | `/api/v1/profiles` 🔒 | `/profiles/:userId/statistics` |
| `parentLinkRequest.ts` | `submitParentLinkRequest` | `/parent-link-requests` | `/api/v1/parent-link-requests` 🔒 | `/parent-link-requests` |
| `parentLinkRequest.ts` | `listParentLinkRequests` | `/parent-link-requests` | `/api/v1/parent-link-requests` 🔒 | `/parent-link-requests` |
| `parentLinkRequest.ts` | `approveParentLinkRequest` | `/parent-link-requests/:id/approve` | `/api/v1/parent-link-requests` 🔒 | `/parent-link-requests/:id/approve` |
| `parentLinkRequest.ts` | `rejectParentLinkRequest` | `/parent-link-requests/:id/reject` | `/api/v1/parent-link-requests` 🔒 | `/parent-link-requests/:id/reject` |

---

## communication-service

| Helper `src/api/` | Fonction | URL `apiClient` | Gateway nginx | Backend reçoit |
|---|---|---|---|---|
| `communication.ts` | `fetchContacts` | `/contacts` | `/api/v1/contacts` 🔒 | `/contacts` |
| `communication.ts` | `activateContact` | `/contacts/:id/activate` | `/api/v1/contacts` 🔒 | `/contacts/:id/activate` |
| `communication.ts` | `deleteContact` | `/contacts/:id` | `/api/v1/contacts` 🔒 | `/contacts/:id` |
| `communication.ts` | `updateContactVisibility` | `/contacts/:id/visibility` | `/api/v1/contacts` 🔒 | `/contacts/:id/visibility` |

---

## pedagogical-log-service

| Helper `src/api/` | Fonction | URL `apiClient` | Gateway nginx | Backend reçoit |
|---|---|---|---|---|
| `pedagogicalLog.ts` | `fetchPedagogicalLogs` | `/pedagogical-logs` | `/api/v1/pedagogical-logs` 🔒 | `/pedagogical-logs` |
| `pedagogicalLog.ts` | `createPedagogicalLog` | `/pedagogical-logs` | `/api/v1/pedagogical-logs` 🔒 | `/pedagogical-logs` |
| `pedagogicalLog.ts` | `updatePedagogicalLog` | `/pedagogical-logs/:id` | `/api/v1/pedagogical-logs` 🔒 | `/pedagogical-logs/:id` |
| `pedagogicalLog.ts` | `deletePedagogicalLog` | `/pedagogical-logs/:id` | `/api/v1/pedagogical-logs` 🔒 | `/pedagogical-logs/:id` |
| `pedagogicalLog.ts` | *(special-pages)* | `/students/:id/pedagogical-log/special-pages` | `/api/v1/students` 🔒 | `/students/:id/pedagogical-log/special-pages` |
| `pedagogicalLog.ts` | `fetchMemos` | `/memos` | `/api/v1/memos` 🔒 | `/memos` |
| `pedagogicalLog.ts` | `fetchMemoChapters` | `/memos/chapters` | `/api/v1/memos` 🔒 | `/memos/chapters` |
| `pedagogicalLog.ts` | `searchMemos` | `/memos/search` | `/api/v1/memos` 🔒 | `/memos/search` |
| `pedagogicalLog.ts` | `createMemo` | `/memos` | `/api/v1/memos` 🔒 | `/memos` |
| `pedagogicalLog.ts` | `createMemoChapter` | `/memos/chapters` | `/api/v1/memos` 🔒 | `/memos/chapters` |
| `pedagogicalLog.ts` | `updateMemo` | `/memos/:id` | `/api/v1/memos` 🔒 | `/memos/:id` |
| `pedagogicalLog.ts` | `deleteMemo` | `/memos/:id` | `/api/v1/memos` 🔒 | `/memos/:id` |
| `pedagogicalLog.ts` | `fetchMemoById` | `/memos/:id` | `/api/v1/memos` 🔒 | `/memos/:id` |
| `pedagogicalLog.ts` | `fetchNotebookEntries` | `/students/:id/notebook` | `/api/v1/students` 🔒 | `/students/:id/notebook` |
| `pedagogicalLog.ts` | `createNotebookEntry` | `/students/:id/notebook` | `/api/v1/students` 🔒 | `/students/:id/notebook` |
| `pedagogicalLog.ts` | `updateNotebookEntry` | `/students/:id/notebook/:entryId` | `/api/v1/students` 🔒 | `/students/:id/notebook/:entryId` |
| `pedagogicalLog.ts` | `deleteNotebookEntry` | `/students/:id/notebook/:entryId` | `/api/v1/students` 🔒 | `/students/:id/notebook/:entryId` |

---

## archive-document-service

| Helper `src/api/` | Fonction | URL `apiClient` | Gateway nginx | Backend reçoit |
|---|---|---|---|---|
| `archiveDocument.ts` | `fetchPedagogicalArchives` | `/archives/students/:id/pedagogical-archives` | `/api/v1/archives` 🔒 | `/archives/students/:id/pedagogical-archives` |
| `archiveDocument.ts` | `createArchiveLink` | `/archives/students/:id/archive-links` | `/api/v1/archives` 🔒 | `/archives/students/:id/archive-links` |
| `archiveDocument.ts` | `fetchArchiveTimeline` | `/archives/students/:id/archive-timeline` | `/api/v1/archives` 🔒 | `/archives/students/:id/archive-timeline` |
| `archiveDocument.ts` | `downloadArchiveDocument` | `/documents/:id/download` | `/api/v1/documents` 🔒 | `/documents/:id/download` |

---

## admin-observability-service

| Helper `src/api/` | Fonction | URL `apiClient` | Gateway nginx | Backend reçoit |
|---|---|---|---|---|
| `adminObservability.ts` | `fetchActivityLog` | `/admin/activity-log` | `/api/v1/admin` 🔒 | `/admin/activity-log` |
| `adminObservability.ts` | `fetchTechnicalLogs` | `/admin/technical-logs` | `/api/v1/admin` 🔒 | `/admin/technical-logs` |
| `adminObservability.ts` | `createVisibilityOverride` | `/admin/visibility-overrides` | `/api/v1/admin` 🔒 | `/admin/visibility-overrides` |
| `adminObservability.ts` | `deleteVisibilityOverride` | `/admin/visibility-overrides/:id` | `/api/v1/admin` 🔒 | `/admin/visibility-overrides/:id` |
| `adminObservability.ts` | `fetchHealthStatus` | `/admin/health` | `/api/v1/admin` 🔒 | `/admin/health` |
| `adminObservability.ts` | `updateSiteMetadata` | `/admin/site-metadata/:id` | `/api/v1/admin` 🔒 | `/admin/site-metadata/:id` |

---

## finance-credit-service

Cas particulier : le préfixe `/finance/` est **strippé** par nginx avant transmission au backend.
`/finance/financial-profiles/:id` → gateway strip → backend reçoit `/financial-profiles/:id`

| Helper `src/api/` | Fonction | URL `apiClient` | Gateway nginx | Backend reçoit |
|---|---|---|---|---|
| `finance.ts` | `fetchFinancialProfile` | `/finance/financial-profiles/:id` | `/api/v1/finance/` 🔒 strip | `/financial-profiles/:id` |
| `finance.ts` | `updateFinancialProfile` | `/finance/financial-profiles/:id` | `/api/v1/finance/` 🔒 strip | `/financial-profiles/:id` |
| `finance.ts` | `createPayment` | `/finance/payments` | `/api/v1/finance/` 🔒 strip | `/payments` |
| `finance.ts` | `fetchFinancialArchives` | `/finance/financial-archives/:id` | `/api/v1/finance/` 🔒 strip | `/financial-archives/:id` |

---

## legal-document-service

| Helper `src/api/` | Fonction | URL `apiClient` | Gateway nginx | Backend reçoit |
|---|---|---|---|---|
| `legal.ts` | `fetchLegalDocuments` | `/legal-documents/:ownerId` | `/api/v1/legal-documents` 🔒 | `/legal-documents/:ownerId` |
| `legal.ts` | `signDocument` | `/legal-documents/:id/sign` | `/api/v1/legal-documents` 🔒 | `/legal-documents/:id/sign` |
| `legal.ts` | `downloadSecureCopy` | `/legal-documents/:id/secure-copy` | `/api/v1/legal-documents` 🔒 | `/legal-documents/:id/secure-copy` |
| `legal.ts` | `createLegalTemplate` | `/legal-templates` | `/api/v1/legal-templates` 🔒 | `/legal-templates` |
| `legal.ts` | `updateLegalTemplate` | `/legal-templates/:id` | `/api/v1/legal-templates` 🔒 | `/legal-templates/:id` |

---

## orchestration-service

Cas particulier : le préfixe `/orchestration/` est **strippé** par nginx avant transmission.
`/orchestration/workflows` → gateway strip → backend reçoit `/workflows`

| Helper `src/api/` | Fonction | URL `apiClient` | Gateway nginx | Backend reçoit |
|---|---|---|---|---|
| `orchestration.ts` | `fetchWorkflowDefinitions` | `/orchestration/workflows` | `/api/v1/orchestration/` 🔒 strip | `/workflows` |
| `orchestration.ts` | `startWorkflow` | `/orchestration/workflows/:id/start` | `/api/v1/orchestration/` 🔒 strip | `/workflows/:id/start` |
| `orchestration.ts` | `fetchWorkflowInstance` | `/orchestration/workflows/:id` | `/api/v1/orchestration/` 🔒 strip | `/workflows/:id` |
| `orchestration.ts` | `suspendWorkflow` | `/orchestration/workflows/:id/suspend` | `/api/v1/orchestration/` 🔒 strip | `/workflows/:id/suspend` |
| `orchestration.ts` | `resumeWorkflow` | `/orchestration/workflows/:id/resume` | `/api/v1/orchestration/` 🔒 strip | `/workflows/:id/resume` |
| `orchestration.ts` | `dispatchCommand` | `/orchestration/commands` | `/api/v1/orchestration/` 🔒 strip | `/commands` |
| `orchestration.ts` | `fetchEventHistory` | `/orchestration/events/:correlationId` | `/api/v1/orchestration/` 🔒 strip | `/events/:correlationId` |

---

## Services sans helper API isolé

Ces services n'ont pas encore de fichier dédié dans `src/api/`. Les appels sont directs dans les composants ou à créer lors du développement des pages concernées.

| Service | Préfixes gateway | URL apiClient à utiliser |
|---|---|---|
| calendar-service | `/api/v1/calendars` · `/api/v1/events` · `/api/v1/activities` · `/api/v1/reminders` | `/calendars/...` · `/events/...` · `/activities/...` · `/reminders/...` |
| video-session-service | `/api/v1/video-sessions` | `/video-sessions/...` |
| dashboard-notification-service | `/api/v1/notifications` · `/api/v1/dashboard` | `/notifications/...` · `/dashboard/...` |
| teacher-request-service | `/api/v1/teacher-requests` | `/teacher-requests/...` |

---

---

## Helpers phase 2/3 (non bloquants phase 1)

| Helper | Service | Ressources |
|---|---|---|
| `communityPath.ts` | community-path-service | `/forums` · `/paths` |
| `learningActivity.ts` | learning-activity-service | `/open-activities` · `/activities` |
| `contentCatalog.ts` | content-catalog-service | `/exercises` · `/tutorials` (Évaluations retirées le 2026-09-02, voir `evaluations.ts`) |
| `exercises.ts` | content-catalog-service | `/exercises` (définition, validation) |
| `exerciseAttempts.ts` | learning-activity-service | `/exercise-attempts` |
| `quizzes.ts` | content-catalog-service | `/quizzes` (définition, validation) |
| `quizAttempts.ts` | learning-activity-service | `/quiz-attempts` |
| `evaluations.ts` | content-catalog-service | `/evaluations` (définition, validation — refonte du 2026-09-02) |
| `evaluationAttempts.ts` | learning-activity-service | `/evaluation-attempts` (passage chronométré, refonte du 2026-09-02) |
| `evaluationCorrections.ts` | learning-activity-service | `/evaluation-corrections` (demande de correction, refonte du 2026-09-02) |

---

_Mettre à jour ce fichier à chaque ajout ou modification de helper API frontend._
