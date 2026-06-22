import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import {
  fetchParentLinkRequests,
  approveParentLinkRequest,
  rejectParentLinkRequest,
  ParentLinkRequest,
} from '../api/parentLinkRequest'

export default function ParentLinkRequestsInboxPage() {
  const [pendingRequests, setPendingRequests] = useState<ParentLinkRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    fetchParentLinkRequests()
      .then((requests) => {
        const pending = requests.filter((request) => request.status === 'pending')
        setPendingRequests(pending)
      })
      .catch(() => setLoadError('Impossible de charger les demandes de rattachement'))
      .finally(() => setIsLoading(false))
  }, [])

  const handleApprove = async (requestId: string) => {
    setProcessingIds((previous) => new Set(previous).add(requestId))
    setActionError(null)
    try {
      const updatedRequest = await approveParentLinkRequest(requestId)
      setPendingRequests((previous) =>
        previous.map((request) =>
          request.id === requestId ? { ...request, ...updatedRequest } : request,
        ).filter((request) => request.status === 'pending'),
      )
    } catch {
      setActionError('Impossible de traiter la demande. Veuillez réessayer.')
    } finally {
      setProcessingIds((previous) => {
        const updated = new Set(previous)
        updated.delete(requestId)
        return updated
      })
    }
  }

  const handleReject = async (requestId: string) => {
    setProcessingIds((previous) => new Set(previous).add(requestId))
    setActionError(null)
    try {
      const updatedRequest = await rejectParentLinkRequest(requestId)
      setPendingRequests((previous) =>
        previous.map((request) =>
          request.id === requestId ? { ...request, ...updatedRequest } : request,
        ).filter((request) => request.status === 'pending'),
      )
    } catch {
      setActionError('Impossible de traiter la demande. Veuillez réessayer.')
    } finally {
      setProcessingIds((previous) => {
        const updated = new Set(previous)
        updated.delete(requestId)
        return updated
      })
    }
  }

  return (
    <Layout>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Demandes de rattachement</h1>
        <p className="text-sm text-gray-500 mb-6">
          Demandes de rattachement parent↔élève en attente de votre décision.
        </p>

        {actionError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {actionError}
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-400">Chargement…</p>
        ) : loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : pendingRequests.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune demande en attente.</p>
        ) : (
          <ul className="space-y-4">
            {pendingRequests.map((request) => {
              const isProcessing = processingIds.has(request.id)
              return (
                <li
                  key={request.id}
                  className="p-4 bg-white border border-gray-200 rounded-xl"
                >
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-800">
                      Demande de rattachement
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      Parent : <span className="font-mono text-xs">{request.parentId}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Reçue le{' '}
                      {new Date(request.requestedAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={isProcessing}
                      className="bg-green-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      Accepter
                    </button>
                    <button
                      onClick={() => handleReject(request.id)}
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
    </Layout>
  )
}
