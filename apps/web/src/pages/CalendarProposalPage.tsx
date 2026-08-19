/**
 * CalendarProposalPage — `/calendar/proposals/:activityId`, vue asymétrique
 * proposeur/destinataire d'une proposition de créneau (chantier calendrier de
 * disponibilités, point 3).
 *
 * - Le **destinataire** (`participantIds` contient `user.id`, statut `proposed`) voit
 *   « Accepter »/« Refuser ».
 * - Le **proposeur** (`creatorId === user.id`) voit le statut en lecture seule, jamais les
 *   actions d'un destinataire.
 * - Un `403`/`404` (ni créateur ni participant, ou activité inconnue) est traduit en français
 *   générique par `useActivityProposal` — jamais d'UUID ni de jargon technique affiché.
 */

import React from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useActivityProposal } from '../hooks/calendar/useActivityProposal'
import {
  ACTIVITY_STATUS_BADGE_CLASSES,
  getActivityStatusLabel,
  getActivityTypeLabel,
} from '../utils/activityLabels'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { StatusBadge } from '../components/ui/StatusBadge'

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CalendarProposalPage() {
  const { activityId } = useParams<{ activityId: string }>()
  const { user } = useAuth()

  const {
    activity,
    isLoading,
    loadError,
    respond,
    isResponding,
    respondError,
    clearRespondError,
  } = useActivityProposal(activityId)

  const isRecipient = Boolean(user && activity?.participantIds.includes(user.id))
  const isProposer = Boolean(user && activity?.creatorId === user.id)
  const canRespond = isRecipient && activity?.status === 'proposed'

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/calendar" className="text-sm text-indigo-600 hover:underline">
            ← Calendrier
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Proposition de créneau</h1>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {loadError && <ErrorMessage message={loadError} className="mb-4" />}

        {!isLoading && !loadError && !activity && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-500 text-sm font-medium">Proposition introuvable.</p>
          </div>
        )}

        {activity && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-gray-800">
                  {activity.title ?? getActivityTypeLabel(activity.type)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{getActivityTypeLabel(activity.type)}</p>
              </div>
              <StatusBadge
                status={activity.status}
                label={getActivityStatusLabel(activity.status)}
                badgeClasses={ACTIVITY_STATUS_BADGE_CLASSES}
                size="md"
              />
            </div>

            <DetailRow label="Début" value={formatDateTime(activity.startTime)} />
            <DetailRow label="Fin" value={formatDateTime(activity.endTime)} />
            {activity.description && (
              <DetailRow label="Description" value={activity.description} />
            )}

            {respondError && (
              <ErrorMessage message={respondError} onClose={clearRespondError} />
            )}

            {canRespond && (
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => respond('accept')}
                  disabled={isResponding}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isResponding ? 'Envoi…' : 'Accepter'}
                </button>
                <button
                  type="button"
                  onClick={() => respond('decline')}
                  disabled={isResponding}
                  className="flex-1 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {isResponding ? 'Envoi…' : 'Refuser'}
                </button>
              </div>
            )}

            {isProposer && !isRecipient && (
              <p className="text-xs text-gray-400 pt-2">
                Vous êtes à l'origine de cette proposition — en attente de réponse du destinataire.
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <span className="text-sm font-medium text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 whitespace-pre-wrap">{value}</span>
    </div>
  )
}
