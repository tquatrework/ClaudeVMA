/**
 * TeacherRequestDetailPage
 *
 * Détail d'une demande professeur — phase 3 spec complète.
 *
 * Routes API consommées :
 * - GET /api/v1/teacher-requests/{id}
 * - POST /api/v1/teacher-requests/{id}/candidates  (via TeacherCandidatesView — RP)
 * - POST /api/v1/teacher-requests/{id}/responses   (via TeacherCandidatesView — formateur)
 * - POST /api/v1/teacher-requests/{id}/select      (via TeacherCandidatesView — client)
 * - POST /api/v1/teacher-collaborations/{id}/stop-request (via StopCollaborationRequestForm)
 * - PATCH /api/v1/teacher-requests/{id}/status     (RP actions)
 * - DELETE /api/v1/teacher-requests/{id}           (suppression)
 */
import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import TeacherCandidatesView, {
  type TeacherCandidate,
} from '../components/teacher-requests/TeacherCandidatesView'
import StopCollaborationRequestForm from '../components/teacher-requests/StopCollaborationRequestForm'

interface TeacherRequest {
  id: string
  status: string
  createdAt: string
  description?: string
  studentId?: string
  teacherId?: string
  collaborationId?: string
  candidates?: TeacherCandidate[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  declined: 'Refusée',
  cancelled: 'Annulée',
  candidates_selected: 'Candidats sélectionnés',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  candidates_selected: 'bg-blue-100 text-blue-700',
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <span className="text-sm font-medium text-gray-500 w-36 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 break-all font-mono text-xs">{value}</span>
    </div>
  )
}

export default function TeacherRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { user, hasRole } = useAuth()
  const navigate = useNavigate()

  const [request, setRequest] = useState<TeacherRequest | null>(null)
  const [candidates, setCandidates] = useState<TeacherCandidate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isShowingStopForm, setIsShowingStopForm] = useState(false)

  const isResponsablePedagogique = hasRole('responsable_pedagogique')
  const isFormateur = hasRole('formateur')
  const isClient = hasRole('eleve', 'parent_financeur')
  const canDelete = hasRole('eleve', 'parent_financeur', 'responsable_pedagogique', 'technicien_informatique')

  useEffect(() => {
    if (!requestId) return
    apiClient
      .get<TeacherRequest>(`/teacher-requests/${requestId}`)
      .then(({ data }) => {
        setRequest(data)
        setCandidates(data.candidates ?? [])
      })
      .catch((error: unknown) => {
        const statusCode = (error as { response?: { status?: number } })?.response?.status
        if (statusCode === 403) setErrorMessage('Accès refusé')
        else if (statusCode === 404) setErrorMessage('Demande introuvable')
        else setErrorMessage('Erreur lors du chargement')
      })
      .finally(() => setIsLoading(false))
  }, [requestId])

  const updateStatus = async (newStatus: string) => {
    if (!requestId) return
    setIsUpdatingStatus(true)
    setErrorMessage(null)
    try {
      const { data } = await apiClient.patch<TeacherRequest>(
        `/teacher-requests/${requestId}/status`,
        { status: newStatus },
      )
      setRequest(data)
      const statusLabel = STATUS_LABELS[data.status] ?? data.status
      setSuccessMessage(`Statut mis à jour : ${statusLabel}`)
    } catch (error: unknown) {
      const apiMessage =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la mise à jour'
      setErrorMessage(apiMessage)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleDelete = async () => {
    if (!requestId || !window.confirm('Supprimer définitivement cette demande ?')) return
    try {
      await apiClient.delete(`/teacher-requests/${requestId}`)
      navigate('/teacher-requests')
    } catch (error: unknown) {
      const apiMessage =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la suppression'
      setErrorMessage(apiMessage)
    }
  }

  const handleStopCollaborationSuccess = () => {
    setIsShowingStopForm(false)
    setSuccessMessage("Demande d'arrêt avec préavis soumise au Responsable Pédagogique")
  }

  const handleRequestStatusChange = (newStatus: string) => {
    setRequest((previous) => (previous ? { ...previous, status: newStatus } : previous))
    setSuccessMessage('Formateur sélectionné — demande clôturée')
  }

  const isRequestActive =
    request?.status === 'pending' || request?.status === 'candidates_selected'

  return (
    <Layout>
      <div className="max-w-2xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            to="/teacher-requests"
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Demandes
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Détail de la demande</h1>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-600 ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center justify-between">
            <span>{successMessage}</span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-400 hover:text-green-600 ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {request && (
          <div className="space-y-5">
            {/* Request detail card */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-400 font-mono">{request.id}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Créée le {new Date(request.createdAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${
                    STATUS_COLORS[request.status] ?? 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {STATUS_LABELS[request.status] ?? request.status}
                </span>
              </div>

              {request.description && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {request.description}
                  </p>
                </div>
              )}

              {request.studentId && (
                <DetailRow label="Élève" value={request.studentId} />
              )}
              {request.teacherId && (
                <DetailRow label="Formateur affecté" value={request.teacherId} />
              )}
              {request.collaborationId && (
                <DetailRow label="Collaboration" value={request.collaborationId} />
              )}

              {/* RP status actions */}
              {isResponsablePedagogique && isRequestActive && (
                <div className="pt-4 flex flex-wrap gap-3 border-t border-gray-100">
                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => updateStatus('accepted')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    Accepter
                  </button>
                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => updateStatus('declined')}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 disabled:opacity-50"
                  >
                    Refuser
                  </button>
                </div>
              )}

              {/* Cancel (student / parent) */}
              {isClient && request.status === 'pending' && (
                <div className="pt-4 border-t border-gray-100">
                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => updateStatus('cancelled')}
                    className="text-sm text-red-500 hover:underline disabled:opacity-50"
                  >
                    Annuler la demande
                  </button>
                </div>
              )}

              {/* Delete */}
              {canDelete && (
                <div className="pt-2">
                  <button
                    onClick={handleDelete}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Supprimer définitivement
                  </button>
                </div>
              )}
            </div>

            {/* Candidates section */}
            <TeacherCandidatesView
              requestId={request.id}
              candidates={candidates}
              isRp={isResponsablePedagogique}
              isFormateur={isFormateur}
              isClient={isClient}
              currentUserId={user?.id}
              requestStatus={request.status}
              onCandidatesUpdated={setCandidates}
              onRequestStatusChange={handleRequestStatusChange}
            />

            {/* Stop collaboration section */}
            {request.collaborationId && (
              <div>
                {!isShowingStopForm ? (
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h2 className="text-base font-semibold text-gray-800 mb-3">
                      Collaboration en cours
                    </h2>
                    <button
                      onClick={() => setIsShowingStopForm(true)}
                      className="text-sm text-orange-500 border border-orange-200 px-4 py-2 rounded-lg hover:bg-orange-50 transition-colors"
                    >
                      Demander un arrêt avec préavis
                    </button>
                  </div>
                ) : (
                  <StopCollaborationRequestForm
                    collaborationId={request.collaborationId}
                    onSuccess={handleStopCollaborationSuccess}
                    onCancel={() => setIsShowingStopForm(false)}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
