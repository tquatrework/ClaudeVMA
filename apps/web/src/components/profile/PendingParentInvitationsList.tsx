/**
 * PendingParentInvitationsList — invitations de parents financeurs (parent_initiated)
 * en attente d'acceptation par l'élève.
 * Extrait de ParentFinanceurSection (lot 10 — normalisation, découpage > 300 lignes).
 */

import React, { useEffect, useState, useCallback } from 'react'
import {
  fetchParentLinkRequests,
  approveParentLinkRequest,
  rejectParentLinkRequest,
  type ParentLinkRequest,
} from '../../api/parentLinkRequest'
import { fetchStudentProfile } from '../../api/relations'

function formatFullName(
  firstName?: string,
  lastName?: string,
  loginIdentifier?: string | null,
  fallbackId?: string,
): string {
  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(' ')
  }
  if (loginIdentifier) return loginIdentifier
  return fallbackId ? `Financeur (${fallbackId.slice(0, 8)}…)` : 'Financeur inconnu'
}

interface PendingParentInvitationsListProps {
  /** Appelé après acceptation d'une invitation, pour rafraîchir la liste des parents rattachés. */
  onApproved: () => void
}

export function PendingParentInvitationsList({ onApproved }: PendingParentInvitationsListProps) {
  const [pendingParentRequests, setPendingParentRequests] = useState<ParentLinkRequest[]>([])
  const [pendingParentNames, setPendingParentNames] = useState<Record<string, string>>({})
  const [isLoadingPendingRequests, setIsLoadingPendingRequests] = useState(true)
  const [pendingRequestsError, setPendingRequestsError] = useState<string | null>(null)
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<string>>(new Set())
  const [requestActionError, setRequestActionError] = useState<string | null>(null)

  const loadPendingParentRequests = useCallback(async () => {
    setIsLoadingPendingRequests(true)
    setPendingRequestsError(null)
    try {
      const allRequests = await fetchParentLinkRequests()
      const parentInitiatedPending = allRequests.filter(
        (request) => request.status === 'pending' && request.direction === 'parent_initiated',
      )
      setPendingParentRequests(parentInitiatedPending)

      // Enrichissement : récupérer prénom + nom de chaque parent demandeur
      const names: Record<string, string> = {}
      await Promise.allSettled(
        parentInitiatedPending.map(async (request) => {
          try {
            const profile = await fetchStudentProfile(request.parentId)
            names[request.parentId] = formatFullName(
              profile.administrativeProfile?.firstName,
              profile.administrativeProfile?.lastName,
              profile.loginIdentifier,
              request.parentId,
            )
          } catch {
            names[request.parentId] = formatFullName(
              undefined,
              undefined,
              undefined,
              request.parentId,
            )
          }
        }),
      )
      setPendingParentNames(names)
    } catch {
      setPendingRequestsError('Impossible de charger les invitations en attente.')
    } finally {
      setIsLoadingPendingRequests(false)
    }
  }, [])

  useEffect(() => {
    loadPendingParentRequests()
  }, [loadPendingParentRequests])

  const handleApproveRequest = async (requestId: string) => {
    setProcessingRequestIds((previous) => new Set(previous).add(requestId))
    setRequestActionError(null)
    try {
      await approveParentLinkRequest(requestId)
      onApproved()
      await loadPendingParentRequests()
    } catch {
      setRequestActionError('Impossible d\'approuver la demande. Veuillez réessayer.')
    } finally {
      setProcessingRequestIds((previous) => {
        const updated = new Set(previous)
        updated.delete(requestId)
        return updated
      })
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    setProcessingRequestIds((previous) => new Set(previous).add(requestId))
    setRequestActionError(null)
    try {
      await rejectParentLinkRequest(requestId)
      await loadPendingParentRequests()
    } catch {
      setRequestActionError('Impossible de refuser la demande. Veuillez réessayer.')
    } finally {
      setProcessingRequestIds((previous) => {
        const updated = new Set(previous)
        updated.delete(requestId)
        return updated
      })
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-base font-semibold text-gray-800 mb-3">
        Accepter l'invitation d'un parent financeur
      </h3>

      {requestActionError && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {requestActionError}
        </div>
      )}

      {isLoadingPendingRequests ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : pendingRequestsError ? (
        <p className="text-sm text-red-600">{pendingRequestsError}</p>
      ) : pendingParentRequests.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune invitation en attente.</p>
      ) : (
        <ul className="space-y-3">
          {pendingParentRequests.map((request) => {
            const isProcessing = processingRequestIds.has(request.id)
            return (
              <li
                key={request.id}
                className="p-4 bg-gray-50 border border-gray-200 rounded-xl"
              >
                <p className="text-sm font-medium text-gray-800 mb-1">
                  {pendingParentNames[request.parentId] ?? 'Chargement…'} souhaite vous rattacher
                </p>
                <p className="text-xs text-gray-500 mb-1">
                  Demande de rattachement parent financeur
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  Reçue le{' '}
                  {new Date(request.requestedAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveRequest(request.id)}
                    disabled={isProcessing}
                    className="bg-green-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    Accepter
                  </button>
                  <button
                    onClick={() => handleRejectRequest(request.id)}
                    disabled={isProcessing}
                    className="bg-red-100 text-red-700 text-sm px-4 py-1.5 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors border border-red-200"
                  >
                    Refuser
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
