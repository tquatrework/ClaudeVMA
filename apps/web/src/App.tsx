import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import ProtectedRoute from './components/ProtectedRoute'

// Dashboards par rôle
import EleveDashboardPage from './pages/EleveDashboardPage'
import ParentDashboardPage from './pages/ParentDashboardPage'
import ProfesseurDashboardPage from './pages/ProfesseurDashboardPage'
import RpDashboardPage from './pages/RpDashboardPage'
import ApDashboardPage from './pages/ApDashboardPage'

// Pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ConsentsPage from './pages/ConsentsPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import ProfileEditPage from './pages/ProfileEditPage'
import TeacherRequestsPage from './pages/TeacherRequestsPage'
import TeacherRequestDetailPage from './pages/TeacherRequestDetailPage'
import TeacherValidationQueuePage from './pages/TeacherValidationQueuePage'
import RpUserDirectoryPage from './pages/RpUserDirectoryPage'
import CalendarPage from './pages/CalendarPage'
import ActivityDetailPage from './pages/ActivityDetailPage'
import CalendarProposalPage from './pages/CalendarProposalPage'
import VideoPage from './pages/VideoPage'
import VideoJoinPage from './pages/VideoJoinPage'
import MessagesPage from './pages/MessagesPage'
import PedagogicalLogPage from './pages/PedagogicalLogPage'
import NotebookPage from './pages/NotebookPage'
import AgreementsPage from './pages/AgreementsPage'
import AdminActivityPage from './pages/AdminActivityPage'
import ForbiddenPage from './pages/ForbiddenPage'
import IncidentsPage from './pages/IncidentsPage'
import IncidentDetailPage from './pages/IncidentDetailPage'
import MemosPage from './pages/MemosPage'
import ActivitiesPage from './pages/ActivitiesPage'
import PasswordResetPage from './pages/PasswordResetPage'
import RecoverIdentifierPage from './pages/RecoverIdentifierPage'
import StudentRegistrationPage from './pages/StudentRegistrationPage'
import TeacherRegistrationPage from './pages/TeacherRegistrationPage'
import ParentRegistrationPage from './pages/ParentRegistrationPage'
import AccountManagementPage from './pages/AccountManagementPage'
import DelegationsPage from './pages/DelegationsPage'
import ProfileVisibilitySettingsPage from './pages/ProfileVisibilitySettingsPage'
import ContactsPage from './pages/ContactsPage'
import FinancialProfilePage from './pages/FinancialProfilePage'
import AfFinanceDashboardPage from './pages/AfFinanceDashboardPage'
import TeacherPaymentRequestPage from './pages/TeacherPaymentRequestPage'
import LegalDocumentsPage from './pages/LegalDocumentsPage'
import LegalTemplateAdminPage from './pages/LegalTemplateAdminPage'
import PedagogicalArchivePage from './pages/PedagogicalArchivePage'
import ExerciseCatalogPage from './pages/ExerciseCatalogPage'
import ExerciseDetailPage from './pages/ExerciseDetailPage'
import ExerciseEditPage from './pages/ExerciseEditPage'
import EvaluationCatalogPage from './pages/EvaluationCatalogPage'
import EvaluationEditPage from './pages/EvaluationEditPage'
import EvaluationAttemptPage from './pages/EvaluationAttemptPage'
import EvaluationAttemptResumePage from './pages/EvaluationAttemptResumePage'
import TutorialCatalogPage from './pages/TutorialCatalogPage'
import TutorialDetailPage from './pages/TutorialDetailPage'
import TutorialEditPage from './pages/TutorialEditPage'
import QuizzPage from './pages/QuizzPage'
import QuizDetailPage from './pages/QuizDetailPage'
import QuizEditPage from './pages/QuizEditPage'
import ContentValidationQueuePage from './pages/ContentValidationQueuePage'
import OpenActivitiesPage from './pages/OpenActivitiesPage'
import OpenActivityDetailPage from './pages/OpenActivityDetailPage'
import ActivityGlobalExportPage from './pages/ActivityGlobalExportPage'
import ForumCatalogPage from './pages/ForumCatalogPage'
import ForumDetailPage from './pages/ForumDetailPage'
import ForumModerationPanel from './pages/ForumModerationPanel'
import PathCatalogPage from './pages/PathCatalogPage'
import PathDetailPage from './pages/PathDetailPage'
import TiAdminDashboard from './pages/TiAdminDashboard'
import ActivityLogPage from './pages/ActivityLogPage'
import TechnicalLogsPage from './pages/TechnicalLogsPage'
import VisibilityOverridePanel from './pages/VisibilityOverridePanel'
import SiteMetadataEditor from './pages/SiteMetadataEditor'
import HealthStatusPage from './pages/HealthStatusPage'
import WorkflowStatusPage from './pages/WorkflowStatusPage'
import WorkflowTimeline from './pages/WorkflowTimeline'
import WorkflowRetryPanel from './pages/WorkflowRetryPanel'
import WorkflowIncidentView from './pages/WorkflowIncidentView'
import ParentLinkRequestPage from './pages/ParentLinkRequestPage'
import ParentLinkRequestsInboxPage from './pages/ParentLinkRequestsInboxPage'
import MyStudentsPage from './pages/MyStudentsPage'
import NotificationsPage from './pages/NotificationsPage'
import GamesPage from './pages/GamesPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <NotificationsProvider>
        <Routes>
          {/* ── Public routes ────────────────────────────────────────── */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/register/student" element={<StudentRegistrationPage />} />
          <Route path="/register/teacher" element={<TeacherRegistrationPage />} />
          <Route path="/register/parent" element={<ParentRegistrationPage />} />
          <Route path="/password-reset" element={<PasswordResetPage />} />
          <Route path="/recover-identifier" element={<RecoverIdentifierPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />

          {/* ── Authenticated routes ─────────────────────────────────── */}
          <Route
            path="/consents"
            element={
              <ProtectedRoute>
                <ConsentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profiles/:userId"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profiles/:userId/edit"
            element={
              <ProtectedRoute>
                <ProfileEditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profiles/:userId/visibility"
            element={
              <ProtectedRoute>
                <ProfileVisibilitySettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher-requests"
            element={
              <ProtectedRoute
                allowedRoles={['eleve', 'parent_financeur', 'formateur', 'responsable_pedagogique']}
              >
                <TeacherRequestsPage />
              </ProtectedRoute>
            }
          />
          {/*
            File de validation des nouveaux formateurs — RP seul, comme
            `GET /profiles/teachers/pending-validation` : le TI peut trancher un
            dossier ouvert depuis la fiche, mais ne dispose pas de la file.
          */}
          <Route
            path="/rp/teacher-validations"
            element={
              <ProtectedRoute allowedRoles={['responsable_pedagogique']}>
                <TeacherValidationQueuePage />
              </ProtectedRoute>
            }
          />
          {/*
            « Visualisation » — nouveau le 2026-09-02 (reconstruction du rail RP,
            groupe « Gestion »). RP seul : c'est un accès administratif structuré
            aux différentes catégories d'utilisateurs, pas un écran ouvert à tous.
          */}
          <Route
            path="/rp/visualisation"
            element={
              <ProtectedRoute allowedRoles={['responsable_pedagogique']}>
                <RpUserDirectoryPage />
              </ProtectedRoute>
            }
          />
          {/*
            `/rp/teacher-requests` était une seconde page pour le même domaine, avec un
            second formulaire postant un autre corps sur `POST /teacher-requests`. Une
            route, un contrat : l'adresse survit en redirection pour ne pas casser les
            liens déjà en circulation.
          */}
          <Route
            path="/rp/teacher-requests"
            element={<Navigate to="/teacher-requests" replace />}
          />
          <Route
            path="/teacher-requests/:requestId"
            element={
              <ProtectedRoute
                allowedRoles={['eleve', 'parent_financeur', 'formateur', 'responsable_pedagogique']}
              >
                <TeacherRequestDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'parent_financeur',
                  'formateur',
                  'responsable_pedagogique',
                  'animateur_pedagogique',
                  'technicien_informatique',
                  'administrateur_financier',
                ]}
              >
                <CalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar/proposals/:activityId"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'formateur',
                  'responsable_pedagogique',
                  'animateur_pedagogique',
                ]}
              >
                <CalendarProposalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activities"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'parent_financeur',
                  'formateur',
                  'responsable_pedagogique',
                  'animateur_pedagogique',
                ]}
              >
                <ActivitiesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activities/:activityId"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'parent_financeur',
                  'formateur',
                  'responsable_pedagogique',
                  'animateur_pedagogique',
                ]}
              >
                <ActivityDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/video/:roomId"
            element={
              <ProtectedRoute>
                <VideoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/video-join/:roomId"
            element={
              <ProtectedRoute>
                <VideoJoinPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'parent_financeur',
                  'formateur',
                  'responsable_pedagogique',
                  'animateur_pedagogique',
                  'technicien_informatique',
                ]}
              >
                <MessagesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pedagogical-log"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'formateur',
                  'responsable_pedagogique',
                  'parent_financeur',
                  // Ajouté le 2026-08-20 : l'item de rail « Cahier de texte » est déjà
                  // proposé à l'AP (`navigationConfig.ts`), mais la route le renvoyait
                  // vers /forbidden — violation de la règle « pas de lien voué au
                  // refus » (docs/routes.md § pedagogical-log-service, GET ouvert à
                  // « Tout rôle authentifié »).
                  'animateur_pedagogique',
                ]}
              >
                <PedagogicalLogPage />
              </ProtectedRoute>
            }
          />

          {/* Carnet personnel — route générique unique depuis le 2026-08-27
              (chantier de généralisation pedagogical-log-service, PR #140) :
              plus de /notebook/:studentId, le titulaire est déduit du JWT
              côté serveur. Rôles limités à ceux explicitement demandés pour
              cette session (élève, formateur, AP) — voir routeAccessMap.ts. */}
          <Route
            path="/notebook/mine"
            element={
              <ProtectedRoute allowedRoles={['eleve', 'formateur', 'animateur_pedagogique']}>
                <NotebookPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/agreements/:requestId"
            element={
              <ProtectedRoute>
                <AgreementsPage />
              </ProtectedRoute>
            }
          />

          {/* Incidents */}
          <Route
            path="/incidents"
            element={
              <ProtectedRoute>
                <IncidentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/incidents/:incidentId"
            element={
              <ProtectedRoute>
                <IncidentDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Contacts */}
          <Route
            path="/contacts"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'parent_financeur',
                  'formateur',
                  'responsable_pedagogique',
                  'animateur_pedagogique',
                  'technicien_informatique',
                  'administrateur_financier',
                ]}
              >
                <ContactsPage />
              </ProtectedRoute>
            }
          />

          {/* Notifications */}
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />

          {/* Élèves suivis (formateur, RP, AP) */}
          <Route
            path="/my-students"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'formateur',
                  'responsable_pedagogique',
                  'animateur_pedagogique',
                  'parent_financeur',
                ]}
              >
                <MyStudentsPage />
              </ProtectedRoute>
            }
          />

          {/* Demandes de rattachement parent↔élève */}
          <Route
            path="/parent-link-requests"
            element={
              <ProtectedRoute allowedRoles={['parent_financeur']}>
                <ParentLinkRequestPage />
              </ProtectedRoute>
            }
          />
          {/* Boîte de réception des demandes de rattachement (élève, RP, TI) */}
          <Route
            path="/parent-link-requests/inbox"
            element={
              <ProtectedRoute
                allowedRoles={['eleve', 'responsable_pedagogique', 'technicien_informatique']}
              >
                <ParentLinkRequestsInboxPage />
              </ProtectedRoute>
            }
          />

          {/* Memos — liste réservée à l'élève. La lecture par un tiers relié
              (formateur, RP, AP, parent) se fait via `MemoReadOnlyModal`
              depuis /my-students, plus par une page dédiée — /memos/:id et
              MemoReadOnlyView (jamais atteints depuis l'UI, contrat serveur
              inexistant) sont retirés (chantier `feat/memo-formules`,
              2026-08-27). */}
          <Route
            path="/memos"
            element={
              <ProtectedRoute allowedRoles={['eleve']}>
                <MemosPage />
              </ProtectedRoute>
            }
          />

          {/* Internal-only */}
          <Route
            path="/admin/activity"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'responsable_pedagogique',
                  'animateur_pedagogique',
                  'technicien_informatique',
                  'administrateur_financier',
                ]}
              >
                <AdminActivityPage />
              </ProtectedRoute>
            }
          />

          {/* Account management (RP + TI) */}
          <Route
            path="/admin/accounts"
            element={
              <ProtectedRoute
                allowedRoles={['responsable_pedagogique', 'technicien_informatique']}
              >
                <AccountManagementPage />
              </ProtectedRoute>
            }
          />

          {/* Delegations */}
          <Route
            path="/delegations"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'responsable_pedagogique',
                  'technicien_informatique',
                  'administrateur_financier',
                ]}
              >
                <DelegationsPage />
              </ProtectedRoute>
            }
          />

          {/* ── Phase 9 — Finance ───────────────────────────────── */}
          <Route
            path="/finance/:ownerId"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'parent_financeur',
                  'administrateur_financier',
                  'responsable_pedagogique',
                  'technicien_informatique',
                ]}
              >
                <FinancialProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'parent_financeur',
                  'administrateur_financier',
                  'responsable_pedagogique',
                  'technicien_informatique',
                ]}
              >
                <FinancialProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/finance"
            element={
              <ProtectedRoute allowedRoles={['administrateur_financier']}>
                <AfFinanceDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher-payment-requests"
            element={
              <ProtectedRoute allowedRoles={['formateur', 'administrateur_financier']}>
                <TeacherPaymentRequestPage />
              </ProtectedRoute>
            }
          />

          {/* ── Phase 10 — Documents légaux ─────────────────────── */}
          <Route
            path="/legal/:ownerId"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'administrateur_financier',
                  'responsable_pedagogique',
                  'technicien_informatique',
                  'parent_financeur',
                ]}
              >
                <LegalDocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/legal"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'administrateur_financier',
                  'responsable_pedagogique',
                  'technicien_informatique',
                  'parent_financeur',
                ]}
              >
                <LegalDocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/legal/templates"
            element={
              <ProtectedRoute allowedRoles={['administrateur_financier']}>
                <LegalTemplateAdminPage />
              </ProtectedRoute>
            }
          />

          {/* ── Phase 11 — Statistiques et archives pédagogiques ─── */}
          {/* La personne consultée n'est pas forcément un élève : un AP y consulte
              les formateurs qu'il anime. Le paramètre s'appelle donc `personId`.
              `animateur_pedagogique` a été ajouté le 2026-08-11 : la navigation lui
              proposait déjà « Stats / Archives », mais la route le renvoyait sur
              /forbidden. */}
          <Route
            path="/archives/:personId"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'parent_financeur',
                  'formateur',
                  'animateur_pedagogique',
                  'responsable_pedagogique',
                  'administrateur_financier',
                  'technicien_informatique',
                ]}
              >
                <PedagogicalArchivePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/archives"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'parent_financeur',
                  'formateur',
                  'animateur_pedagogique',
                  'responsable_pedagogique',
                  'administrateur_financier',
                  'technicien_informatique',
                ]}
              >
                <PedagogicalArchivePage />
              </ProtectedRoute>
            }
          />

          {/* Quizz — branché sur la pile réelle le 2026-08-28 (content-catalog-service
              PR #152, learning-activity-service PR #151). RP et AP ajoutés aux rôles
              autorisés le même jour : ce sont, avec le formateur, les trois rôles créateurs
              documentés (docs/architecture.md > « Fonctionnalite Quizz ») — sans cet accès
              ils ne pourraient jamais atteindre le formulaire de création. */}
          <Route
            path="/content/quizz"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'formateur',
                  'animateur_pedagogique',
                  'responsable_pedagogique',
                ]}
              >
                <QuizzPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/quizz/:quizId"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'formateur',
                  'animateur_pedagogique',
                  'responsable_pedagogique',
                ]}
              >
                <QuizDetailPage />
              </ProtectedRoute>
            }
          />
          {/* Édition réservée à l'auteur (retour post-production du 2026-08-28) — mêmes rôles
              créateurs que le formulaire de création, le contrôle réel (auteur ou non) restant
              du côté serveur. */}
          <Route
            path="/content/quizz/:quizId/edit"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'formateur',
                  'animateur_pedagogique',
                  'responsable_pedagogique',
                ]}
              >
                <QuizEditPage />
              </ProtectedRoute>
            }
          />

          {/* ── Exercices — refonte du 2026-08-29 (blocs typés, auto-contrôle) ──
              Mêmes rôles créateurs que le Quizz (docs/architecture.md > « Refonte des
              Exercices ») : formateur/AP/RP créent, eleve/formateur/AP/RP passent. */}
          <Route
            path="/content/exercises"
            element={
              <ProtectedRoute
                allowedRoles={['eleve', 'formateur', 'responsable_pedagogique', 'animateur_pedagogique']}
              >
                <ExerciseCatalogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/exercises/:exerciseId"
            element={
              <ProtectedRoute
                allowedRoles={['eleve', 'formateur', 'responsable_pedagogique', 'animateur_pedagogique']}
              >
                <ExerciseDetailPage />
              </ProtectedRoute>
            }
          />
          {/* Édition réservée à l'auteur — mêmes rôles créateurs, le contrôle réel (auteur ou
              non) restant du côté serveur, même patron que `/content/quizz/:quizId/edit`. */}
          <Route
            path="/content/exercises/:exerciseId/edit"
            element={
              <ProtectedRoute
                allowedRoles={['formateur', 'animateur_pedagogique', 'responsable_pedagogique']}
              >
                <ExerciseEditPage />
              </ProtectedRoute>
            }
          />
          {/* Évaluations — refonte du 2026-09-02 (notation manuelle, demande de correction).
              Rôles alignés sur le contrat réel de learning-activity-service pour
              `POST /evaluation-attempts` : eleve, formateur, animateur_pedagogique,
              responsable_pedagogique — mêmes 4 rôles créateurs/passants que Quizz/Exercice. */}
          <Route
            path="/content/evaluations"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'formateur',
                  'animateur_pedagogique',
                  'responsable_pedagogique',
                ]}
              >
                <EvaluationCatalogPage />
              </ProtectedRoute>
            }
          />
          {/* Édition d'une Évaluation par son auteur — `PUT /evaluations/:id` ajoutée le
              2026-09-02 (barème informatif). Mêmes rôles créateurs que Quizz/Exercice. */}
          <Route
            path="/content/evaluations/:evaluationId/edit"
            element={
              <ProtectedRoute
                allowedRoles={['formateur', 'animateur_pedagogique', 'responsable_pedagogique']}
              >
                <EvaluationEditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/evaluations/:evaluationId/attempt"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'formateur',
                  'animateur_pedagogique',
                  'responsable_pedagogique',
                ]}
              >
                <EvaluationAttemptPage />
              </ProtectedRoute>
            }
          />
          {/* Reprise d'une tentative déjà démarrée — lien profond depuis l'onglet « Mon
              historique » de EvaluationCatalogPage, pas d'entrée de menu dédiée. */}
          <Route
            path="/content/evaluations/attempts/:attemptId"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'formateur',
                  'animateur_pedagogique',
                  'responsable_pedagogique',
                ]}
              >
                <EvaluationAttemptResumePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/tutorials"
            element={
              <ProtectedRoute
                allowedRoles={['eleve', 'formateur', 'responsable_pedagogique', 'animateur_pedagogique']}
              >
                <TutorialCatalogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/tutorials/:tutorialId"
            element={
              <ProtectedRoute
                allowedRoles={['eleve', 'formateur', 'responsable_pedagogique', 'animateur_pedagogique']}
              >
                <TutorialDetailPage />
              </ProtectedRoute>
            }
          />
          {/* Édition réservée à l'auteur — mêmes rôles créateurs, le contrôle réel (auteur ou
              non) restant du côté serveur, même patron que `/content/exercises/:exerciseId/edit`. */}
          <Route
            path="/content/tutorials/:tutorialId/edit"
            element={
              <ProtectedRoute
                allowedRoles={['formateur', 'animateur_pedagogique', 'responsable_pedagogique']}
              >
                <TutorialEditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/validation"
            element={
              <ProtectedRoute
                allowedRoles={['responsable_pedagogique', 'animateur_pedagogique']}
              >
                <ContentValidationQueuePage />
              </ProtectedRoute>
            }
          />

          {/* ── Phase 13 — Activités non pourvues ──────────────── */}
          <Route
            path="/open-activities"
            element={
              <ProtectedRoute allowedRoles={['formateur', 'responsable_pedagogique', 'animateur_pedagogique']}>
                <OpenActivitiesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/open-activities/:activityId"
            element={
              <ProtectedRoute allowedRoles={['formateur', 'responsable_pedagogique', 'animateur_pedagogique']}>
                <OpenActivityDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/activities/export"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'responsable_pedagogique',
                  'animateur_pedagogique',
                  'technicien_informatique',
                  'administrateur_financier',
                ]}
              >
                <ActivityGlobalExportPage />
              </ProtectedRoute>
            }
          />

          {/* ── Phase 14 — Community & parcours ─────────────── */}
          {/* Forums ouverts à tous les rôles le 2026-09-04 (menu du haut,
              demande explicite utilisateur) — voir routeAccessMap.ts pour le
              même élargissement côté canAccess(). */}
          <Route
            path="/community/forums"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'parent_financeur',
                  'formateur',
                  'responsable_pedagogique',
                  'animateur_pedagogique',
                  'technicien_informatique',
                  'administrateur_financier',
                ]}
              >
                <ForumCatalogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community/forums/:forumId"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'eleve',
                  'parent_financeur',
                  'formateur',
                  'responsable_pedagogique',
                  'animateur_pedagogique',
                  'technicien_informatique',
                  'administrateur_financier',
                ]}
              >
                <ForumDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community/forums/:forumId/moderation"
            element={
              <ProtectedRoute
                allowedRoles={['animateur_pedagogique', 'responsable_pedagogique']}
              >
                <ForumModerationPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community/paths"
            element={
              <ProtectedRoute
                allowedRoles={['eleve', 'formateur', 'responsable_pedagogique', 'animateur_pedagogique']}
              >
                <PathCatalogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community/paths/:pathId"
            element={
              <ProtectedRoute
                allowedRoles={['eleve', 'formateur', 'responsable_pedagogique', 'animateur_pedagogique']}
              >
                <PathDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community/games"
            element={
              // 'responsable_pedagogique' ajouté le 2026-09-02 (reconstruction du
              // rail RP, groupe « Contenu » — demande explicite « Jeux »).
              // Page 100% statique (ressources externes, aucun appel API) :
              // l'élargir à un rôle de plus ne change ni le contenu ni le
              // comportement pour les élèves déjà autorisés.
              <ProtectedRoute allowedRoles={['eleve', 'responsable_pedagogique']}>
                <GamesPage />
              </ProtectedRoute>
            }
          />

          {/* ── Phase 15 — Admin observabilité ──────────────── */}
          <Route
            path="/admin/observability"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'technicien_informatique',
                  'responsable_pedagogique',
                  'administrateur_financier',
                ]}
              >
                <TiAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/observability/activity-log"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'technicien_informatique',
                  'responsable_pedagogique',
                  'administrateur_financier',
                ]}
              >
                <ActivityLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/observability/technical-logs"
            element={
              <ProtectedRoute allowedRoles={['technicien_informatique']}>
                <TechnicalLogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/observability/visibility-overrides"
            element={
              <ProtectedRoute allowedRoles={['technicien_informatique']}>
                <VisibilityOverridePanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/observability/site-metadata"
            element={
              <ProtectedRoute allowedRoles={['technicien_informatique']}>
                <SiteMetadataEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/observability/health"
            element={
              <ProtectedRoute
                allowedRoles={['technicien_informatique', 'responsable_pedagogique']}
              >
                <HealthStatusPage />
              </ProtectedRoute>
            }
          />

          {/* ── Phase 16 — Orchestration ────────────────────── */}
          <Route
            path="/admin/orchestration/workflows"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'technicien_informatique',
                  'responsable_pedagogique',
                  'administrateur_financier',
                ]}
              >
                <WorkflowStatusPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/orchestration/workflows/:workflowInstanceId"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'technicien_informatique',
                  'responsable_pedagogique',
                  'administrateur_financier',
                ]}
              >
                <WorkflowTimeline />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/orchestration/retry"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'technicien_informatique',
                  'responsable_pedagogique',
                  'administrateur_financier',
                ]}
              >
                <WorkflowRetryPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/orchestration/incidents"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'technicien_informatique',
                  'responsable_pedagogique',
                  'administrateur_financier',
                ]}
              >
                <WorkflowIncidentView />
              </ProtectedRoute>
            }
          />

          {/* ── Dashboards par rôle ────────────────────────── */}
          <Route
            path="/dashboard/eleve"
            element={
              <ProtectedRoute allowedRoles={['eleve']}>
                <EleveDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/parent"
            element={
              <ProtectedRoute allowedRoles={['parent_financeur']}>
                <ParentDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/professeur"
            element={
              <ProtectedRoute allowedRoles={['formateur']}>
                <ProfesseurDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/rp"
            element={
              <ProtectedRoute allowedRoles={['responsable_pedagogique']}>
                <RpDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/ap"
            element={
              <ProtectedRoute allowedRoles={['animateur_pedagogique']}>
                <ApDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Default redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </NotificationsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
