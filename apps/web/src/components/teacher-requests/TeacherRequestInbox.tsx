/**
 * TeacherRequestInbox
 *
 * Boîte de réception du formateur : affiche les demandes où il est candidat
 * avec statut "pending", lui permettant d'accepter ou refuser.
 *
 * Le formateur répond via POST /api/v1/teacher-requests/{id}/responses.
 */
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../../api/client'

interface TeacherRequestForInbox {
  id: string
  status: string
  createdAt: string
  description?: string
  studentId?: string
  candidateId?: string
}

interface TeacherRequestInboxProps {
  currentTeacherId: string
}

export default function TeacherRequestInbox({ currentTeacherId }: TeacherRequestInboxProps) {
  const [inboxRequests, setInboxRequests] = useState<TeacherRequestForInbox[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    apiClient
      .get<TeacherRequestForInbox[] | { data: TeacherRequestForInbox[] }>('/teacher-requests')
      .then(({ data }) => {
        const requestList = Array.isArray(data) ? data : (data as { data: TeacherRequestForInbox[] }).data ?? []
        // Filter requests where the teacher is a pending candidate
        const relevantRequests = requestList.filter(
          (request) =>
            request.status === 'pending' ||
            request.status === 'candidates_selected',
        )
        setInboxRequests(relevantRequests)
      })
      .catch((error: unknown) => {
        const statusCode = (error as { response?: { status?: number } })?.response?.status
        if (statusCode === 403) {
          setErrorMessage('Accès refusé')
        } else {
          setErrorMessage('Impossible de charger les demandes')
        }
      })
      .finally(() => setIsLoading(false))
  }, [currentTeacherId])

  const handleRespond = async (
    requestId: string,
    candidateId: string | undefined,
    responseStatus: 'accepted' | 'declined',
  ) => {
    setProcessingRequestId(requestId)
    setErrorMessage(null)

    try {
      const responseAction = responseStatus === 'accepted' ? 'accept' : 'decline'
      // candidateId is the proposal ID when available; fallback to requestId-based path
      const proposalId = candidateId ?? requestId
      await apiClient.post(`/proposals/${proposalId}/${responseAction}`, {})

      setInboxRequests((previous) =>
        previous.filter((request) => request.id !== requestId),
      )
      setSuccessMessage(
        responseStatus === 'accepted'
          ? 'Demande acceptée — vous serez contacté prochainement'
          : 'Demande refusée',
      )
    } catch (error: unknown) {
      const apiMessage =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la réponse'
      setErrorMessage(apiMessage)
    } finally {
      setProcessingRequestId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-gray-400 text-sm">Chargement des demandes reçues…</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">
          Demandes reçues
        </h2>
        {inboxRequests.length > 0 && (
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
            {inboxRequests.length} en attente
          </span>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-600 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-400 hover:text-green-600 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {inboxRequests.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          Aucune demande en attente de réponse
        </p>
      ) : (
        <ul className="space-y-3">
          {inboxRequests.map((request) => {
            const isProcessing = processingRequestId === request.id
            return (
              <li
                key={request.id}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/teacher-requests/${request.id}`}
                      className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                      Demande #{request.id.slice(0, 8)}
                    </Link>
                    <span className="text-xs text-gray-400">
                      {new Date(request.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                      })}
                    </span>
                  </div>
                  {request.description && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-3">
                      {request.description}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={isProcessing}
                    onClick={() =>
                      handleRespond(request.id, request.candidateId, 'accepted')
                    }
                    className="flex-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {isProcessing ? '…' : 'Accepter'}
                  </button>
                  <button
                    disabled={isProcessing}
                    onClick={() =>
                      handleRespond(request.id, request.candidateId, 'declined')
                    }
                    className="flex-1 bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-300 disabled:opacity-50 transition-colors"
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
