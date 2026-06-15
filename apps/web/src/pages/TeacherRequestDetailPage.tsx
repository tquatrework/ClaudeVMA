import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
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
  assignmentId?: string
}

interface Proposal {
  id: string
  teacherId: string
  requestId: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: string
}

const STATUS_LABELS: Record<TeacherRequest['status'], string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  declined: 'Refusée',
  cancelled: 'Annulée',
}

const STATUS_COLORS: Record<TeacherRequest['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

export default function TeacherRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { user, hasRole } = useAuth()
  const navigate = useNavigate()

  const [request, setRequest] = useState<TeacherRequest | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Propose teacher panel state (RP only)
  const [isProposing, setIsProposing] = useState(false)
  const [proposedTeacherId, setProposedTeacherId] = useState('')
  const [isSendingProposal, setIsSendingProposal] = useState(false)

  // Termination panel state
  const [isTerminating, setIsTerminating] = useState(false)
  const [terminationReason, setTerminationReason] = useState('')
  const [isSendingTermination, setIsSendingTermination] = useState(false)

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
    setError(null)
    try {
      const { data } = await apiClient.patch<TeacherRequest>(`/requests/${requestId}/status`, {
        status: newStatus,
      })
      setRequest(data)
      setSuccessMessage(`Statut mis à jour : ${STATUS_LABELS[data.status as TeacherRequest['status']] ?? data.status}`)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la mise à jour'
      setError(message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!requestId || !window.confirm('Supprimer cette demande ?')) return
    try {
      await apiClient.delete(`/requests/${requestId}`)
      navigate('/teacher-requests')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la suppression'
      setError(message)
    }
  }

  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requestId || !proposedTeacherId.trim()) return
    setIsSendingProposal(true)
    setError(null)
    try {
      const { data } = await apiClient.post<Proposal>(`/requests/${requestId}/proposals`, {
        teacherId: proposedTeacherId.trim(),
      })
      setProposals((prev) => [...prev, data])
      setProposedTeacherId('')
      setIsProposing(false)
      setSuccessMessage('Proposition envoyée au formateur')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la proposition'
      setError(message)
    } finally {
      setIsSendingProposal(false)
    }
  }

  const handleAcceptProposal = async (proposalId: string) => {
    setError(null)
    try {
      await apiClient.post(`/proposals/${proposalId}/accept`)
      setProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, status: 'accepted' as const } : p)),
      )
      setSuccessMessage('Proposition acceptée')
      // Reload request to get updated status
      const { data } = await apiClient.get<TeacherRequest>(`/requests/${requestId}`)
      setRequest(data)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Erreur lors de l'acceptation"
      setError(message)
    }
  }

  const handleDeclareMainTeacher = async () => {
    if (!request?.assignmentId) return
    setError(null)
    try {
      await apiClient.post(`/assignments/${request.assignmentId}/main-teacher`)
      setSuccessMessage('Professeur principal déclaré')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la déclaration du professeur principal'
      setError(message)
    }
  }

  const handleTermination = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!request?.assignmentId) return
    setIsSendingTermination(true)
    setError(null)
    try {
      await apiClient.post(`/assignments/${request.assignmentId}/termination`, {
        reason: terminationReason.trim() || undefined,
      })
      setTerminationReason('')
      setIsTerminating(false)
      setSuccessMessage("Demande d'arrêt enregistrée")
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Erreur lors de la demande d'arrêt"
      setError(message)
    } finally {
      setIsSendingTermination(false)
    }
  }

  const isRP = hasRole('responsable_pedagogique')
  const isFormateur = hasRole('formateur')
  const canDelete = hasRole('eleve', 'parent_financeur', 'responsable_pedagogique', 'technicien_informatique')

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/teacher-requests" className="text-sm text-indigo-600 hover:underline">
            ← Demandes
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Détail de la demande</h1>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center justify-between">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-green-400 hover:text-green-600 ml-3">✕</button>
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
                  className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[request.status]}`}
                >
                  {STATUS_LABELS[request.status]}
                </span>
              </div>

              {request.description && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{request.description}</p>
                </div>
              )}

              {request.studentId && (
                <DetailRow label="Élève" value={request.studentId} />
              )}
              {request.teacherId && (
                <DetailRow label="Formateur affecté" value={request.teacherId} />
              )}
              {request.assignmentId && (
                <DetailRow label="Affectation" value={request.assignmentId} />
              )}

              {/* RP status actions */}
              {isRP && request.status === 'pending' && (
                <div className="pt-4 flex flex-wrap gap-3 border-t border-gray-100">
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
                  <button
                    onClick={() => setIsProposing(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
                  >
                    Proposer un formateur
                  </button>
                </div>
              )}

              {/* Declare main teacher (RP, assignment exists) */}
              {isRP && request.assignmentId && (
                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={handleDeclareMainTeacher}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Déclarer comme professeur principal
                  </button>
                </div>
              )}

              {/* Cancel (student / parent / cancelled allowed) */}
              {hasRole('eleve', 'parent_financeur') && request.status === 'pending' && (
                <div className="pt-4 border-t border-gray-100">
                  <button
                    disabled={isUpdating}
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

            {/* Propose teacher form (RP) */}
            {isRP && isProposing && (
              <form
                onSubmit={handleSendProposal}
                className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm"
              >
                <h2 className="text-base font-semibold text-gray-800">Proposer un formateur</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID du formateur <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={proposedTeacherId}
                    onChange={(e) => setProposedTeacherId(e.target.value)}
                    placeholder="UUID du formateur"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isSendingProposal || !proposedTeacherId.trim()}
                    className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSendingProposal ? 'Envoi…' : 'Envoyer la proposition'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProposing(false)
                      setProposedTeacherId('')
                    }}
                    className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-200"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}

            {/* Proposals list */}
            {proposals.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-base font-semibold text-gray-800 mb-4">Propositions</h2>
                <ul className="space-y-3">
                  {proposals.map((proposal) => (
                    <li
                      key={proposal.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          Formateur : {proposal.teacherId.slice(0, 12)}…
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(proposal.createdAt).toLocaleString('fr-FR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {proposal.status === 'accepted' ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            Acceptée
                          </span>
                        ) : proposal.status === 'declined' ? (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            Refusée
                          </span>
                        ) : isFormateur && user?.id === proposal.teacherId ? (
                          <button
                            onClick={() => handleAcceptProposal(proposal.id)}
                            className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700"
                          >
                            Accepter
                          </button>
                        ) : (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                            En attente
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Termination (assignment exists) */}
            {request.assignmentId && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-base font-semibold text-gray-800 mb-3">Arrêt de la relation</h2>
                {!isTerminating ? (
                  <button
                    onClick={() => setIsTerminating(true)}
                    className="text-sm text-red-500 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Demander un arrêt avec préavis
                  </button>
                ) : (
                  <form onSubmit={handleTermination} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Motif (optionnel)
                      </label>
                      <textarea
                        value={terminationReason}
                        onChange={(e) => setTerminationReason(e.target.value)}
                        placeholder="Expliquez la raison de l'arrêt…"
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={isSendingTermination}
                        className="bg-red-500 text-white px-5 py-2 rounded-lg text-sm hover:bg-red-600 disabled:opacity-50"
                      >
                        {isSendingTermination ? 'Envoi…' : 'Confirmer la demande d\'arrêt'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsTerminating(false)
                          setTerminationReason('')
                        }}
                        className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-200"
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                )}
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
      <span className="text-sm font-medium text-gray-500 w-32 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 break-all font-mono text-xs">{value}</span>
    </div>
  )
}
