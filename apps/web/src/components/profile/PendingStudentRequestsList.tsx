/**
 * PendingStudentRequestsList — demandes de rattachement élève (student_initiated)
 * en attente d'acceptation par le parent financeur.
 * Extrait de LinkedStudentsSection (lot 10 — normalisation, découpage > 300 lignes).
 */

import React, { useEffect, useState, useCallback } from 'react'
import {
  fetchParentLinkRequests,
  approveParentLinkRequest,
  rejectParentLinkRequest,
  type ParentLinkRequest,
} from '../../api/parentLinkRequest'
import { fetchStudentProfile } from '../../api/relations'
import { formatPersonDisplayName } from '../../utils/nameFormat'

const STUDENT_GENERIC_LABEL = 'Élève'

interface PendingStudentRequestsListProps {
  /** Appelé après acceptation d'une demande, pour rafraîchir la liste des élèves rattachés. */
  onApproved: () => void
}

export function PendingStudentRequestsList({ onApproved }: PendingStudentRequestsListProps) {
  const [pendingStudentRequests, setPendingStudentRequests] = useState<ParentLinkRequest[]>([])
  const [pendingStudentNames, setPendingStudentNames] = useState<Record<string, string>>({})
  const [isLoadingPendingRequests, setIsLoadingPendingRequests] = useState(true)
  const [pendingRequestsError, setPendingRequestsError] = useState<string | null>(null)
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<string>>(new Set())
  const [requestActionError, setRequestActionError] = useState<string | null>(null)

  const loadPendingStudentRequests = useCallback(async () => {
    setIsLoadingPendingRequests(true)
    setPendingRequestsError(null)
    try {
      const allRequests = await fetchParentLinkRequests()
      const studentInitiatedPending = allRequests.filter(
        (request) => request.status === 'pending' && request.direction === 'student_initiated',
      )
      setPendingStudentRequests(studentInitiatedPending)

      // Enrichissement : récupérer prénom + nom de chaque élève demandeur.
      //
      // ÉCART CONNU : `GET /parent-link-requests` ne renvoie que des ids, pas de nom
      // résolu (contrairement aux routes de relations). Le repli en cas d'échec reste
      // un libellé lisible — jamais l'UUID. Correctif durable : enrichir la route côté
      // serveur avec un `studentName`, comme cela a été fait pour `financeOwnerName`.
      const names: Record<string, string> = {}
      await Promise.allSettled(
        studentInitiatedPending.map(async (request) => {
          try {
            const profile = await fetchStudentProfile(request.studentId)
            names[request.studentId] = formatPersonDisplayName(
              profile.administrative?.firstName,
              profile.administrative?.lastName,
              profile.loginIdentifier,
              STUDENT_GENERIC_LABEL,
            )
          } catch {
            names[request.studentId] = formatPersonDisplayName(
              undefined,
              undefined,
              undefined,
              STUDENT_GENERIC_LABEL,
            )
          }
        }),
      )
      setPendingStudentNames(names)
    } catch {
      setPendingRequestsError('Impossible de charger les demandes en attente.')
    } finally {
      setIsLoadingPendingRequests(false)
    }
  }, [])

  useEffect(() => {
    loadPendingStudentRequests()
  }, [loadPendingStudentRequests])

  const handleApproveRequest = async (requestId: string) => {
    setProcessingRequestIds((previous) => new Set(previous).add(requestId))
    setRequestActionError(null)
    try {
      await approveParentLinkRequest(requestId)
      onApproved()
      await loadPendingStudentRequests()
    } catch {
      setRequestActionError("Impossible d'approuver la demande. Veuillez réessayer.")
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
      await loadPendingStudentRequests()
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
        Accepter la déclaration d'un élève
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
      ) : pendingStudentRequests.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune invitation en attente.</p>
      ) : (
        <ul className="space-y-3">
          {pendingStudentRequests.map((request) => {
            const isProcessing = processingRequestIds.has(request.id)
            return (
              <li
                key={request.id}
                className="p-4 bg-gray-50 border border-gray-200 rounded-xl"
              >
                <p className="text-sm font-medium text-gray-800 mb-1">
                  {pendingStudentNames[request.studentId] ?? 'Chargement…'} souhaite vous déclarer comme financeur
                </p>
                <p className="text-xs text-gray-500 mb-1">
                  Demande de rattachement élève
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
