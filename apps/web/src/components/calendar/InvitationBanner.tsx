import React, { useState } from 'react'
import apiClient from '../../api/client'
import { CalendarEvent, InviteeStatus } from './calendarTypes'

interface InvitationEntry {
  event: CalendarEvent
  status: InviteeStatus
}

interface InvitationBannerProps {
  invitations: InvitationEntry[]
  userId: string
  onStatusChange: (eventId: string, newStatus: InviteeStatus) => void
}

export default function InvitationBanner({
  invitations,
  userId,
  onStatusChange,
}: InvitationBannerProps) {
  const pendingInvitations = invitations.filter((inv) => inv.status === 'pending')

  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  if (pendingInvitations.length === 0) return null

  const handleAccept = async (eventId: string) => {
    setProcessingIds((prev) => new Set(prev).add(eventId))
    try {
      await apiClient.post(`/events/${eventId}/invitees/${userId}/accept`)
      onStatusChange(eventId, 'accepted')
    } catch {
      // silently ignore — user can retry
    } finally {
      setProcessingIds((prev) => {
        const updated = new Set(prev)
        updated.delete(eventId)
        return updated
      })
    }
  }

  const handleDecline = async (eventId: string) => {
    setProcessingIds((prev) => new Set(prev).add(eventId))
    try {
      await apiClient.post(`/events/${eventId}/invitees/${userId}/decline`)
      onStatusChange(eventId, 'declined')
    } catch {
      // silently ignore — user can retry
    } finally {
      setProcessingIds((prev) => {
        const updated = new Set(prev)
        updated.delete(eventId)
        return updated
      })
    }
  }

  return (
    <section
      className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4"
      aria-label="Invitations en attente"
    >
      <h2 className="text-sm font-semibold text-blue-800 mb-3">
        Invitations en attente ({pendingInvitations.length})
      </h2>
      <ul className="space-y-3">
        {pendingInvitations.map(({ event }) => {
          const isProcessing = processingIds.has(event.id)
          return (
            <li
              key={event.id}
              className="flex items-center justify-between gap-4 bg-white rounded-lg px-4 py-3 border border-blue-100"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {event.title ?? `Événement #${event.id.slice(0, 8)}`}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(event.startAt).toLocaleString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleAccept(event.id)}
                  disabled={isProcessing}
                  className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-green-700 disabled:opacity-50"
                >
                  Accepter
                </button>
                <button
                  onClick={() => handleDecline(event.id)}
                  disabled={isProcessing}
                  className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-200 disabled:opacity-50"
                >
                  Refuser
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
