/**
 * EvaluationCorrectionQueueList — file des demandes de correction en attente, pour le professeur
 * (accepter/refuser) et le RP (accepter en override d'escalade, y compris depuis `all_declined`).
 *
 * Accepter est « premier arrivé premier servi » — un second `accept` échoue explicitement (400),
 * affiché comme message d'erreur de ligne plutôt qu'une exception silencieuse.
 */

import React, { useState } from 'react'
import { getErrorMessage } from '../../utils/apiError'
import {
  EVALUATION_CORRECTION_STATUS_BADGE_CLASSES,
  EVALUATION_CORRECTION_STATUS_LABELS,
} from '../../utils/evaluationLabels'
import { formatLocalDateTime } from '../../utils/dateFormat'
import { StatusBadge } from '../ui/StatusBadge'
import type { EvaluationCorrectionRequest } from '../../types/evaluationAttempt'

interface EvaluationCorrectionQueueListProps {
  items: EvaluationCorrectionRequest[]
  onAccept: (correctionRequestId: string) => Promise<void>
  onDecline: (correctionRequestId: string) => Promise<void>
  /** Le RP peut accepter mais jamais refuser (route réservée au professeur lié). */
  canDecline: boolean
}

export function EvaluationCorrectionQueueList({
  items,
  onAccept,
  onDecline,
  canDecline,
}: EvaluationCorrectionQueueListProps) {
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [rowErrorById, setRowErrorById] = useState<Record<string, string>>({})

  if (items.length === 0) {
    return <p className="text-gray-400 text-sm italic py-4">Aucune demande de correction en attente.</p>
  }

  const handleAccept = async (id: string) => {
    setPendingActionId(id)
    setRowErrorById((previous) => ({ ...previous, [id]: '' }))
    try {
      await onAccept(id)
    } catch (error: unknown) {
      setRowErrorById((previous) => ({
        ...previous,
        [id]: getErrorMessage(error, 'Impossible de prendre en charge cette demande.'),
      }))
    } finally {
      setPendingActionId(null)
    }
  }

  const handleDecline = async (id: string) => {
    setPendingActionId(id)
    setRowErrorById((previous) => ({ ...previous, [id]: '' }))
    try {
      await onDecline(id)
    } catch (error: unknown) {
      setRowErrorById((previous) => ({
        ...previous,
        [id]: getErrorMessage(error, 'Impossible de refuser cette demande.'),
      }))
    } finally {
      setPendingActionId(null)
    }
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">
                Demande de correction — tentative du {formatLocalDateTime(item.createdAt)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {item.linkedTeacherIds.length} professeur(s) lié(s), {item.declinedByTeacherIds.length}{' '}
                refus enregistré(s)
              </p>
            </div>
            <StatusBadge
              status={item.status}
              label={EVALUATION_CORRECTION_STATUS_LABELS[item.status]}
              badgeClasses={EVALUATION_CORRECTION_STATUS_BADGE_CLASSES}
            />
          </div>

          {rowErrorById[item.id] && <p className="text-xs text-red-600">{rowErrorById[item.id]}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleAccept(item.id)}
              disabled={pendingActionId === item.id}
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {pendingActionId === item.id ? 'Envoi…' : 'Prendre en charge'}
            </button>
            {canDecline && (
              <button
                type="button"
                onClick={() => handleDecline(item.id)}
                disabled={pendingActionId === item.id}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Refuser
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
