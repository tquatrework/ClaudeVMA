import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import { useActivitySessions } from '../hooks/calendar/useActivitySessions'
import type { ActivitySession } from '../types/calendar'

type ActivityFilterStatus = 'all' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled'

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Planifiée',
  ongoing: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  ongoing: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-700',
}

const TYPE_LABELS: Record<string, string> = {
  course: 'Cours',
  meeting: 'Réunion',
  evaluation: 'Évaluation',
  other: 'Autre',
}

export default function ActivitiesPage() {
  const { user, hasRole } = useAuth()
  const [statusFilter, setStatusFilter] = useState<ActivityFilterStatus>('all')

  const {
    data,
    isLoading,
    error: fetchError,
    refetch,
  } = useActivitySessions(user?.id, hasRole('formateur'), hasRole('eleve'))

  const activitySessions = data ?? []

  const filteredSessions = activitySessions.filter((session) => {
    if (statusFilter === 'all') return true
    return session.status === statusFilter
  })

  // Sort by most recent first for activities list view
  const sortedSessions = [...filteredSessions].sort(
    (sessionA, sessionB) => new Date(sessionB.startAt).getTime() - new Date(sessionA.startAt).getTime(),
  )

  const completedCount = activitySessions.filter((s) => s.status === 'completed').length
  const ongoingCount = activitySessions.filter((s) => s.status === 'ongoing').length
  const scheduledCount = activitySessions.filter((s) => s.status === 'scheduled').length

  return (
    <Layout>
      <div className="max-w-3xl">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activités</h1>
            <p className="text-sm text-gray-500 mt-1">
              Suivi pédagogique des séances reportées
            </p>
          </div>
          <Link
            to="/calendar"
            className="text-sm border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Voir le calendrier
          </Link>
        </div>

        {/* Summary stats */}
        {!isLoading && activitySessions.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard label="Planifiées" count={scheduledCount} colorClass="text-blue-600" />
            <StatCard label="En cours" count={ongoingCount} colorClass="text-green-600" />
            <StatCard label="Terminées" count={completedCount} colorClass="text-gray-500" />
          </div>
        )}

        {/* Status filter */}
        {!isLoading && activitySessions.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {(['all', 'scheduled', 'ongoing', 'completed', 'cancelled'] as ActivityFilterStatus[]).map(
              (filterOption) => (
                <button
                  key={filterOption}
                  onClick={() => setStatusFilter(filterOption)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === filterOption
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filterOption === 'all' ? 'Toutes' : STATUS_LABELS[filterOption]}
                </button>
              ),
            )}
          </div>
        )}

        {/* Error state */}
        {fetchError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{fetchError}</span>
            <button
              onClick={refetch}
              className="text-red-500 hover:text-red-700 underline ml-3 text-xs"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <p className="text-gray-400 text-sm">Chargement des activités…</p>
        )}

        {/* Empty state */}
        {!isLoading && !fetchError && filteredSessions.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            {activitySessions.length === 0 ? (
              <>
                <p className="text-gray-400 text-sm font-medium">Aucune activité pour le moment</p>
                <p className="text-gray-400 text-xs mt-1">
                  Les séances planifiées depuis le calendrier apparaîtront ici.
                </p>
                <Link
                  to="/calendar"
                  className="mt-4 inline-block text-indigo-600 hover:underline text-sm"
                >
                  Aller au calendrier
                </Link>
              </>
            ) : (
              <p className="text-gray-400 text-sm">
                Aucune activité avec le statut «{' '}
                {STATUS_LABELS[statusFilter] ?? statusFilter} »
              </p>
            )}
          </div>
        )}

        {/* Activities list */}
        {!isLoading && sortedSessions.length > 0 && (
          <ul className="space-y-3">
            {sortedSessions.map((session) => (
              <ActivitySessionCard key={session.id} session={session} />
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}

function ActivitySessionCard({ session }: { session: ActivitySession }) {
  const sessionStartDate = new Date(session.startAt)
  const sessionEndDate = new Date(session.endAt)
  const isPastSession = sessionEndDate < new Date()

  return (
    <li>
      <Link
        to={`/activities/${session.id}`}
        className={`block p-4 border rounded-xl hover:shadow-sm transition-all ${
          isPastSession
            ? 'bg-gray-50 border-gray-100 hover:border-gray-200'
            : 'bg-white border-gray-200 hover:border-indigo-300'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-sm truncate ${isPastSession ? 'text-gray-500' : 'text-gray-800'}`}>
              {session.title ?? `Séance #${session.id.slice(0, 8)}`}
            </p>
            <p className={`text-xs mt-1 ${isPastSession ? 'text-gray-400' : 'text-gray-500'}`}>
              {sessionStartDate.toLocaleString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' → '}
              {sessionEndDate.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {session.type && (
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                {TYPE_LABELS[session.type] ?? session.type}
              </span>
            )}
            {session.status && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  STATUS_BADGE_COLORS[session.status] ?? 'bg-gray-100 text-gray-500'
                }`}
              >
                {STATUS_LABELS[session.status] ?? session.status}
              </span>
            )}
            {session.videoRoomId && (
              <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                Visio
              </span>
            )}
          </div>
        </div>

        {/* Participants summary */}
        {(session.studentId || session.teacherId) && (
          <div className="mt-2 flex gap-4 text-xs text-gray-400">
            {session.studentId && (
              <span>Élève : {session.studentId.slice(0, 8)}…</span>
            )}
            {session.teacherId && (
              <span>Formateur : {session.teacherId.slice(0, 8)}…</span>
            )}
          </div>
        )}
      </Link>
    </li>
  )
}

function StatCard({
  label,
  count,
  colorClass,
}: {
  label: string
  count: number
  colorClass: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold ${colorClass}`}>{count}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}
