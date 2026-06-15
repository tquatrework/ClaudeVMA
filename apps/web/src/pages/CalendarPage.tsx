import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

interface Activity {
  id: string
  title?: string
  startAt: string
  endAt: string
  type?: string
  status?: string
  studentId?: string
  teacherId?: string
}

type ActivityType = 'course' | 'meeting' | 'evaluation' | 'other'

const TYPE_LABELS: Record<ActivityType, string> = {
  course: 'Cours',
  meeting: 'Réunion',
  evaluation: 'Évaluation',
  other: 'Autre',
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  ongoing: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-700',
}

function toLocalInputValue(dateString?: string): string {
  if (!dateString) return ''
  const dateObj = new Date(dateString)
  if (isNaN(dateObj.getTime())) return ''
  // Format as YYYY-MM-DDTHH:MM for datetime-local input
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}` +
    `T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`
  )
}

export default function CalendarPage() {
  const { user, hasRole } = useAuth()
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create session form state
  const [isCreating, setIsCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newStartAt, setNewStartAt] = useState('')
  const [newEndAt, setNewEndAt] = useState('')
  const [newType, setNewType] = useState<ActivityType>('course')
  const [newStudentId, setNewStudentId] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const canCreateSession = hasRole('formateur', 'responsable_pedagogique', 'animateur_pedagogique', 'technicien_informatique')

  useEffect(() => {
    if (!user) return
    const calendarParam =
      user.role === 'formateur'
        ? `teacherId=${user.id}`
        : user.role === 'eleve'
          ? `studentId=${user.id}`
          : ''

    apiClient
      .get<Activity[]>(`/calendar${calendarParam ? `?${calendarParam}` : ''}`)
      .then(({ data }) => setActivities(Array.isArray(data) ? data : []))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError('Accès refusé')
        else setError('Impossible de charger le calendrier')
      })
      .finally(() => setIsLoading(false))
  }, [user])

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStartAt || !newEndAt) return
    setIsSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        title: newTitle.trim() || undefined,
        startAt: new Date(newStartAt).toISOString(),
        endAt: new Date(newEndAt).toISOString(),
        type: newType,
      }
      if (newStudentId.trim()) {
        payload.studentId = newStudentId.trim()
      }
      if (user?.role === 'formateur') {
        payload.teacherId = user.id
      }
      const { data } = await apiClient.post<Activity>('/calendar', payload)
      setActivities((prev) => [data, ...prev])
      setNewTitle('')
      setNewStartAt('')
      setNewEndAt('')
      setNewType('course')
      setNewStudentId('')
      setIsCreating(false)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la création de la séance'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  // Sort activities: upcoming first
  const sortedActivities = [...activities].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  )

  const upcomingActivities = sortedActivities.filter((a) => new Date(a.startAt) >= new Date())
  const pastActivities = sortedActivities.filter((a) => new Date(a.startAt) < new Date())

  return (
    <Layout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mon calendrier</h1>
            <p className="text-sm text-gray-500 mt-1">
              {activities.length} séance{activities.length !== 1 ? 's' : ''}
            </p>
          </div>
          {canCreateSession && !isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
            >
              Planifier une séance
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
          </div>
        )}

        {/* Create form */}
        {isCreating && (
          <form
            onSubmit={handleCreateSession}
            className="mb-6 bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm"
          >
            <h2 className="text-base font-semibold text-gray-800">Nouvelle séance</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre (optionnel)</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex : Cours de mathématiques - niveau Terminale"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Début <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newStartAt}
                  onChange={(e) => setNewStartAt(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fin <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newEndAt}
                  min={newStartAt}
                  onChange={(e) => setNewEndAt(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ActivityType)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {Object.entries(TYPE_LABELS).map(([typeValue, typeLabel]) => (
                    <option key={typeValue} value={typeValue}>
                      {typeLabel}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID élève (optionnel)
                </label>
                <input
                  type="text"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  placeholder="UUID de l'élève"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSaving || !newStartAt || !newEndAt}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSaving ? 'Planification…' : 'Planifier'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false)
                  setNewTitle('')
                  setNewStartAt('')
                  setNewEndAt('')
                  setNewStudentId('')
                }}
                className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-200"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {!isLoading && activities.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">Aucune activité planifiée</p>
            {canCreateSession && (
              <button
                onClick={() => setIsCreating(true)}
                className="mt-3 text-indigo-600 hover:underline text-sm"
              >
                Planifier la première séance
              </button>
            )}
          </div>
        )}

        {/* Upcoming activities */}
        {upcomingActivities.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              À venir ({upcomingActivities.length})
            </h2>
            <ul className="space-y-3">
              {upcomingActivities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </ul>
          </section>
        )}

        {/* Past activities */}
        {pastActivities.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Passées ({pastActivities.length})
            </h2>
            <ul className="space-y-3">
              {pastActivities.slice().reverse().map((activity) => (
                <ActivityCard key={activity.id} activity={activity} isPast />
              ))}
            </ul>
          </section>
        )}
      </div>
    </Layout>
  )
}

function ActivityCard({ activity, isPast = false }: { activity: Activity; isPast?: boolean }) {
  return (
    <li>
      <Link
        to={`/activities/${activity.id}`}
        className={`block p-4 border rounded-xl hover:shadow-sm transition-all ${
          isPast
            ? 'bg-gray-50 border-gray-100 hover:border-gray-200'
            : 'bg-white border-gray-200 hover:border-indigo-300'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className={`font-medium text-sm ${isPast ? 'text-gray-500' : 'text-gray-800'}`}>
            {activity.title ?? `Activité #${activity.id.slice(0, 8)}`}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {activity.type && (
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                {TYPE_LABELS[activity.type as ActivityType] ?? activity.type}
              </span>
            )}
            {activity.status && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  STATUS_COLORS[activity.status] ?? 'bg-gray-100 text-gray-500'
                }`}
              >
                {activity.status}
              </span>
            )}
          </div>
        </div>
        <p className={`text-xs mt-1 ${isPast ? 'text-gray-400' : 'text-gray-500'}`}>
          {new Date(activity.startAt).toLocaleString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {' → '}
          {new Date(activity.endAt).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </Link>
    </li>
  )
}

// Suppress unused warning — kept for potential parent usage
void toLocalInputValue
