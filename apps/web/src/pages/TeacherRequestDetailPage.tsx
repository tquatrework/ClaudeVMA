import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

interface TeacherRequest {
  id: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  createdAt: string
  description?: string
  studentId?: string
  teacherId?: string
}

export default function TeacherRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { hasRole } = useAuth()
  const [request, setRequest] = useState<TeacherRequest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (!requestId) return
    apiClient
      .get<TeacherRequest>(`/requests/${requestId}`)
      .then(({ data }) => setRequest(data))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError('Accès refusé')
        else if (status === 404) setError('Demande introuvable')
        else setError('Erreur lors du chargement')
      })
      .finally(() => setIsLoading(false))
  }, [requestId])

  const updateStatus = async (newStatus: string) => {
    if (!requestId) return
    setIsUpdating(true)
    try {
      const { data } = await apiClient.patch<TeacherRequest>(`/requests/${requestId}/status`, {
        status: newStatus,
      })
      setRequest(data)
    } catch {
      setError('Erreur lors de la mise à jour')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Détail de la demande</h1>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {request && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <DetailRow label="ID" value={request.id} />
            <DetailRow label="Statut" value={request.status} />
            <DetailRow label="Créée le" value={new Date(request.createdAt).toLocaleString('fr-FR')} />
            {request.description && (
              <DetailRow label="Description" value={request.description} />
            )}
            {request.studentId && <DetailRow label="Élève" value={request.studentId} />}
            {request.teacherId && <DetailRow label="Formateur" value={request.teacherId} />}

            {/* RP actions */}
            {hasRole('responsable_pedagogique') && request.status === 'pending' && (
              <div className="pt-4 flex gap-3 border-t border-gray-100">
                <button
                  disabled={isUpdating}
                  onClick={() => updateStatus('accepted')}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Accepter
                </button>
                <button
                  disabled={isUpdating}
                  onClick={() => updateStatus('declined')}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 disabled:opacity-50"
                >
                  Refuser
                </button>
              </div>
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
      <span className="text-sm text-gray-800 break-all">{value}</span>
    </div>
  )
}
