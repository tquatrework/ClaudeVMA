import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ConsentsPage from './pages/ConsentsPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import ProfileEditPage from './pages/ProfileEditPage'
import TeacherRequestsPage from './pages/TeacherRequestsPage'
import TeacherRequestDetailPage from './pages/TeacherRequestDetailPage'
import TeacherRequestPage from './pages/TeacherRequestPage'
import CalendarPage from './pages/CalendarPage'
import ActivityDetailPage from './pages/ActivityDetailPage'
import VideoPage from './pages/VideoPage'
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
              <ProtectedRoute>
                <TeacherRequestsPage />
              </ProtectedRoute>
            }
          />
          {/* TeacherRequestPage — vue complète avec workspace RP, inbox formateur et formulaire élève/parent */}
          <Route
            path="/rp/teacher-requests"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'responsable_pedagogique',
                  'formateur',
                  'eleve',
                  'parent_financeur',
                ]}
              >
                <TeacherRequestPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher-requests/:requestId"
            element={
              <ProtectedRoute>
                <TeacherRequestDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <CalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activities"
            element={
              <ProtectedRoute>
                <ActivitiesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activities/:activityId"
            element={
              <ProtectedRoute>
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
            path="/messages"
            element={
              <ProtectedRoute>
                <MessagesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pedagogical-log"
            element={
              <ProtectedRoute>
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
              <ProtectedRoute>
                <ContactsPage />
              </ProtectedRoute>
            }
          />

          {/* Memos */}
          <Route
            path="/memos"
            element={
              <ProtectedRoute>
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

          {/* Contacts */}
          <Route
            path="/contacts"
            element={
              <ProtectedRoute>
                <ContactsPage />
              </ProtectedRoute>
            }
          />

          {/* ── Phase 9 — Finance ───────────────────────────────── */}
          <Route
            path="/finance/:ownerId"
            element={
              <ProtectedRoute>
                <FinancialProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance"
            element={
              <ProtectedRoute>
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
              <ProtectedRoute>
                <LegalDocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/legal"
            element={
              <ProtectedRoute>
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

          {/* ── Phase 11 — Archives pédagogiques ────────────────── */}
          <Route
            path="/archives/:studentId"
            element={
              <ProtectedRoute>
                <PedagogicalArchivePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/archives"
            element={
              <ProtectedRoute>
                <PedagogicalArchivePage />
              </ProtectedRoute>
            }
          />

          {/* ── Phase 12 — Catalogue pédagogique ────────────────── */}
          <Route
            path="/content/exercises"
            element={
              <ProtectedRoute>
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
              <ProtectedRoute>
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

          {/* Default redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
