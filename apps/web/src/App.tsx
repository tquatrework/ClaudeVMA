import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
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
import CalendarPage from './pages/CalendarPage'
import ActivityDetailPage from './pages/ActivityDetailPage'
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
import MemoReadOnlyView from './pages/MemoReadOnlyView'
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
import EvaluationCatalogPage from './pages/EvaluationCatalogPage'
import EvaluationAttemptPage from './pages/EvaluationAttemptPage'
import TutorialCatalogPage from './pages/TutorialCatalogPage'
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
                allowedRoles={['eleve', 'formateur', 'responsable_pedagogique', 'parent_financeur']}
              >
                <PedagogicalLogPage />
              </ProtectedRoute>
            }
          />

          {/* Notebook — student-only: the page itself enforces the role check */}
          <Route
            path="/notebook/:studentId"
            element={
              <ProtectedRoute allowedRoles={['eleve', 'responsable_pedagogique', 'technicien_informatique']}>
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

          {/* Memos — liste réservée à l'élève */}
          <Route
            path="/memos"
            element={
              <ProtectedRoute allowedRoles={['eleve']}>
                <MemosPage />
              </ProtectedRoute>
            }
          />
          {/* Memos — lecture seule d'un mémo individuel (formateur, RP, AP) */}
          <Route
            path="/memos/:id"
            element={
              <ProtectedRoute
                allowedRoles={['formateur', 'responsable_pedagogique', 'animateur_pedagogique']}
              >
                <MemoReadOnlyView />
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

          {/* ── Phase 12 — Catalogue pédagogique ────────────────── */}
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
              <ProtectedRoute>
                <ExerciseDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/evaluations"
            element={
              <ProtectedRoute>
                <EvaluationCatalogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/evaluations/:evaluationId/attempt"
            element={
              <ProtectedRoute allowedRoles={['eleve']}>
                <EvaluationAttemptPage />
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
          <Route
            path="/community/forums"
            element={
              <ProtectedRoute
                allowedRoles={['eleve', 'formateur', 'responsable_pedagogique', 'animateur_pedagogique']}
              >
                <ForumCatalogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community/forums/:forumId"
            element={
              <ProtectedRoute
                allowedRoles={['eleve', 'formateur', 'responsable_pedagogique', 'animateur_pedagogique']}
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
              <ProtectedRoute allowedRoles={['eleve']}>
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
      </AuthProvider>
    </BrowserRouter>
  )
}
