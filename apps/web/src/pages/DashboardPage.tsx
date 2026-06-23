import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiClient from '../api/client'
import Layout from '../components/Layout'
import { fetchLinkedStudents, fetchStudentProfile } from '../api/relations'

interface Notification {
  id: string
  message: string
  read: boolean
  createdAt: string
}

interface PaginatedNotifications {
  data: Notification[]
  meta?: { total?: number; page?: number }
}

interface DashboardData {
  role?: string
  widgets?: string[]
  upcomingActivitiesCount?: number
  unreadMessagesCount?: number
  pendingRequestsCount?: number
}

interface TeacherRequest {
  id: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'candidates_selected'
  createdAt: string
  description?: string
  studentId?: string
  teacherId?: string
}

interface AdminProfile {
  firstName?: string
  lastName?: string
}

interface Activity {
  id: string
  title?: string
  startAt: string
  endAt: string
  type?: string
}

interface LinkedStudentEntry {
  studentId: string
  displayName: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  candidates_selected: 'bg-blue-100 text-blue-700',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  declined: 'Refusée',
  cancelled: 'Annulée',
  candidates_selected: 'Candidats sélectionnés',
}

const ACTIVE_STATUSES = new Set(['pending', 'candidates_selected'])

export default function DashboardPage() {
  const { user, hasRole } = useAuth()
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [recentRequests, setRecentRequests] = useState<TeacherRequest[]>([])
  const [profileNames, setProfileNames] = useState<Record<string, string>>({})
  const [requestFilter, setRequestFilter] = useState<'active' | 'all'>('active')
  const [upcomingActivities, setUpcomingActivities] = useState<Activity[]>([])
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudentEntry[]>([])
  const [isLoadingLinkedStudents, setIsLoadingLinkedStudents] = useState(false)
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true)
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true)
  const [isLoadingRequests, setIsLoadingRequests] = useState(true)
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true)

  useEffect(() => {
    if (!user) return

    // Load dashboard meta
    apiClient
      .get<DashboardData>('/dashboards/me')
      .then(({ data }) => setDashboardData(data))
      .catch(() => { /* non-blocking */ })
      .finally(() => setIsLoadingDashboard(false))

    // Load notifications (paginated)
    apiClient
      .get<PaginatedNotifications | Notification[]>('/notifications')
      .then(({ data }) => {
        const notificationList = Array.isArray(data) ? data : (data.data ?? [])
        setNotifications(notificationList)
      })
      .catch(() => { /* non-blocking */ })
      .finally(() => setIsLoadingNotifications(false))

    // Load recent requests — sorted by date desc, then resolve profiles for names
    apiClient
      .get<TeacherRequest[]>('/requests')
      .then(async ({ data }) => {
        const sorted = (Array.isArray(data) ? data : [])
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10)
        setRecentRequests(sorted)

        // Resolve profile names for all unique student/teacher IDs
        const userIds = [
          ...new Set(
            sorted.flatMap((r) => [r.studentId, r.teacherId].filter(Boolean) as string[])
          ),
        ]
        if (userIds.length === 0) return

        const results = await Promise.allSettled(
          userIds.map((id) =>
            apiClient.get<{ administrativeProfile?: AdminProfile }>(`/profiles/${id}`)
          )
        )
        const names: Record<string, string> = {}
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const profile = result.value.data.administrativeProfile
            const displayName = [profile?.firstName, profile?.lastName]
              .filter(Boolean)
              .join(' ')
            if (displayName) names[userIds[index]] = displayName
          }
        })
        setProfileNames(names)
      })
      .catch(() => { /* non-blocking */ })
      .finally(() => setIsLoadingRequests(false))

    // Load upcoming calendar activities
    const calendarParam =
      user.role === 'formateur'
        ? `teacherId=${user.id}`
        : user.role === 'eleve'
          ? `studentId=${user.id}`
          : ''

    apiClient
      .get<Activity[]>(`/calendar${calendarParam ? `?${calendarParam}` : ''}`)
      .then(({ data }) => {
        const sorted = (Array.isArray(data) ? data : [])
          .filter((activity) => new Date(activity.startAt) >= new Date())
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
          .slice(0, 3)
        setUpcomingActivities(sorted)
      })
      .catch(() => { /* non-blocking */ })
      .finally(() => setIsLoadingCalendar(false))

    // Load linked students for parent_financeur
    if (user.role === 'parent_financeur') {
      setIsLoadingLinkedStudents(true)
      fetchLinkedStudents(user.id)
        .then(async (links) => {
          const studentEntries = await Promise.all(
            links.map(async (link) => {
              try {
                const profile = await fetchStudentProfile(link.studentId)
                const firstName = profile.administrativeProfile?.firstName ?? ''
                const lastName = profile.administrativeProfile?.lastName ?? ''
                const displayName = [firstName, lastName].filter(Boolean).join(' ') || link.studentId
                return { studentId: link.studentId, displayName }
              } catch {
                return { studentId: link.studentId, displayName: link.studentId }
              }
            }),
          )
          setLinkedStudents(studentEntries)
        })
        .catch(() => { /* non-blocking */ })
        .finally(() => setIsLoadingLinkedStudents(false))
    }
  }, [user])

  const unreadNotificationCount = notifications.filter((n) => !n.read).length
  const pendingRequestCount = recentRequests.filter((r) => r.status === 'pending').length

  const markNotificationRead = async (notificationId: string) => {
    try {
      await apiClient.post(`/notifications/${notificationId}/read`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      )
    } catch {
      /* non-blocking */
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      await apiClient.delete(`/notifications/${notificationId}`)
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
    } catch {
      /* non-blocking */
    }
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Bonjour{user ? `, ${user.loginIdentifier}` : ''}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Rôle :{' '}
              <span className="font-medium text-indigo-600">{user?.role}</span>
              {' · '}
              Statut :{' '}
              <span
                className={`font-medium ${
                  user?.validationStatus === 'active'
                    ? 'text-green-600'
                    : user?.validationStatus === 'suspended'
                      ? 'text-red-600'
                      : 'text-yellow-600'
                }`}
              >
                {user?.validationStatus}
              </span>
            </p>
          </div>
          {user?.validationStatus === 'pending' && (
            <Link
              to="/consents"
              className="text-sm bg-yellow-100 text-yellow-800 border border-yellow-200 px-4 py-2 rounded-lg hover:bg-yellow-200 transition-colors"
            >
              Signer les consentements
            </Link>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Notifications"
            value={isLoadingNotifications ? '…' : String(unreadNotificationCount)}
            isHighlighted={unreadNotificationCount > 0}
            color="red"
          />
          <StatCard
            label="Demandes en attente"
            value={isLoadingRequests ? '…' : String(pendingRequestCount)}
            isHighlighted={pendingRequestCount > 0}
            color="yellow"
          />
          <StatCard
            label="Prochaines séances"
            value={isLoadingCalendar ? '…' : String(upcomingActivities.length)}
            isHighlighted={false}
            color="blue"
          />
          <StatCard
            label="Profil"
            value={isLoadingDashboard ? '…' : (dashboardData ? 'Actif' : '—')}
            isHighlighted={false}
            color="green"
            linkTo={user ? `/profiles/${user.id}` : undefined}
          />
        </div>

        {/* Quick-access cards */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Accès rapide</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <QuickCard to="/calendar" label="Calendrier" />
            <QuickCard to="/messages" label="Messages" />
            <QuickCard to="/teacher-requests" label="Demandes prof." />

            {hasRole('eleve') && user && (
              <QuickCard to={`/notebook/${user.id}`} label="Mon carnet" />
            )}
            {hasRole('eleve', 'parent_financeur', 'formateur', 'responsable_pedagogique') && user && (
              <QuickCard to="/pedagogical-log" label="Cahier de texte" />
            )}
            <QuickCard to="/memos" label="Mémos" />
            {hasRole('parent_financeur') && (
              <QuickCard to="/parent-link-requests/new" label="Rattacher un élève" />
            )}
            {hasRole('eleve', 'responsable_pedagogique', 'technicien_informatique') && (
              <QuickCard to="/parent-link-requests/inbox" label="Demandes de rattachement" />
            )}
            {hasRole('technicien_informatique', 'responsable_pedagogique') && (
              <QuickCard to="/incidents" label="Incidents" />
            )}
            {hasRole(
              'responsable_pedagogique',
              'animateur_pedagogique',
              'technicien_informatique',
              'administrateur_financier',
            ) && <QuickCard to="/admin/activity" label="Activité interne" />}
          </div>
        </section>

        {/* Upcoming activities */}
        {!isLoadingCalendar && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-700">Prochaines séances</h2>
              <Link to="/calendar" className="text-sm text-indigo-600 hover:underline">
                Voir tout
              </Link>
            </div>
            {upcomingActivities.length === 0 ? (
              <p className="text-gray-400 text-sm">Aucune séance à venir</p>
            ) : (
              <ul className="space-y-2">
                {upcomingActivities.map((activity) => (
                  <li key={activity.id}>
                    <Link
                      to={`/activities/${activity.id}`}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-sm transition-all"
                    >
                      <span className="text-sm font-medium text-gray-800">
                        {activity.title ?? `Séance #${activity.id.slice(0, 8)}`}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0 ml-4">
                        {new Date(activity.startAt).toLocaleString('fr-FR', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Linked students — parent_financeur only */}
        {hasRole('parent_financeur') && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-700">Mes élèves</h2>
              <Link to="/my-students" className="text-sm text-indigo-600 hover:underline">
                Voir tout
              </Link>
            </div>

            {isLoadingLinkedStudents ? (
              <p className="text-gray-400 text-sm">Chargement…</p>
            ) : linkedStudents.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-sm mb-3">Aucun élève rattaché.</p>
                <Link
                  to="/parent-link-requests/new"
                  className="text-sm text-indigo-600 hover:underline"
                >
                  Rattacher un élève
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {linkedStudents.map((student) => (
                  <li key={student.studentId}>
                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                      <span className="text-sm font-medium text-gray-800">{student.displayName}</span>
                      <div className="flex gap-2">
                        <Link
                          to={`/profiles/${student.studentId}`}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Profil
                        </Link>
                        <Link
                          to={`/calendar?studentId=${student.studentId}`}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Calendrier
                        </Link>
                        <Link
                          to={`/pedagogical-log?studentId=${student.studentId}`}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Cahier
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Recent requests */}
        {!isLoadingRequests && recentRequests.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-700">Demandes professeur récentes</h2>
              <Link to="/teacher-requests" className="text-sm text-indigo-600 hover:underline">
                Voir tout
              </Link>
            </div>

            {/* Filter toggle */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setRequestFilter('active')}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  requestFilter === 'active'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                Non traitées ({recentRequests.filter((r) => ACTIVE_STATUSES.has(r.status)).length})
              </button>
              <button
                onClick={() => setRequestFilter('all')}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  requestFilter === 'all'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                Toutes ({recentRequests.length})
              </button>
            </div>

            {(() => {
              const visibleRequests = requestFilter === 'active'
                ? recentRequests.filter((r) => ACTIVE_STATUSES.has(r.status))
                : recentRequests

              if (visibleRequests.length === 0) {
                return (
                  <p className="text-gray-400 text-sm py-2">
                    Aucune demande non traitée
                  </p>
                )
              }

              return (
                <ul className="space-y-2">
                  {visibleRequests.slice(0, 5).map((request) => {
                    const studentName = request.studentId ? profileNames[request.studentId] : undefined
                    const teacherName = request.teacherId ? profileNames[request.teacherId] : undefined

                    return (
                      <li key={request.id}>
                        <Link
                          to={`/teacher-requests/${request.id}`}
                          className="flex items-start justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-sm transition-all"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {studentName
                                ? `Élève : ${studentName}`
                                : `Demande #${request.id.slice(0, 8)}`}
                            </p>
                            {teacherName && (
                              <p className="text-xs text-gray-500 truncate mt-0.5">
                                Formateur : {teacherName}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(request.createdAt).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 ml-3 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[request.status] ?? 'bg-gray-100 text-gray-500'}`}
                          >
                            {STATUS_LABELS[request.status] ?? request.status}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )
            })()}
          </section>
        )}

        {/* Notifications */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-700">
              Notifications
              {unreadNotificationCount > 0 && (
                <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                  {unreadNotificationCount}
                </span>
              )}
            </h2>
          </div>

          {isLoadingNotifications ? (
            <p className="text-gray-400 text-sm">Chargement…</p>
          ) : notifications.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune notification</p>
          ) : (
            <ul className="space-y-2">
              {notifications.slice(0, 8).map((notification) => (
                <li
                  key={notification.id}
                  className={`p-3 rounded-lg border text-sm flex items-start justify-between gap-3 ${
                    notification.read
                      ? 'bg-white border-gray-200 text-gray-600'
                      : 'bg-indigo-50 border-indigo-200 text-gray-800 font-medium'
                  }`}
                >
                  <span className="flex-1">{notification.message}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {!notification.read && (
                      <button
                        onClick={() => markNotificationRead(notification.id)}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Lu
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  )
}

interface StatCardProps {
  label: string
  value: string
  isHighlighted: boolean
  color: 'red' | 'yellow' | 'blue' | 'green'
  linkTo?: string
}

function StatCard({ label, value, isHighlighted, color, linkTo }: StatCardProps) {
  const colorClasses: Record<StatCardProps['color'], string> = {
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
  }

  const content = (
    <div
      className={`p-4 bg-white border rounded-xl text-center ${
        isHighlighted ? 'border-indigo-200 shadow-sm' : 'border-gray-200'
      }`}
    >
      <p className={`text-2xl font-bold ${isHighlighted ? colorClasses[color] : 'text-gray-700'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )

  if (linkTo) {
    return (
      <Link to={linkTo} className="block hover:opacity-90 transition-opacity">
        {content}
      </Link>
    )
  }
  return content
}

function QuickCard({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all text-sm font-medium text-gray-700 text-center"
    >
      {label}
    </Link>
  )
}
