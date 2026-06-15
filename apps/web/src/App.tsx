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
            path="/pedagogical-log/:studentId"
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

          {/* Default redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
