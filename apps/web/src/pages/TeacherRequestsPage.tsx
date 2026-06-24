import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

interface TeacherRequest {
  id: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  createdAt: string
  description?: string
  studentId?: string
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

export default function TeacherRequestsPage() {
  const { user, hasRole } = useAuth()
  const [requests, setRequests] = useState<TeacherRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form state
  const [isCreating, setIsCreating] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [newStudentId, setNewStudentId] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const canCreate = hasRole('eleve', 'parent_financeur', 'responsable_pedagogique')

  useEffect(() => {
    apiClient
      .get<TeacherRequest[]>('/teacher-requests')
      .then(({ data }) => setRequests(Array.isArray(data) ? data : []))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError('Accès refusé')
        else setError('Impossible de charger les demandes')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDescription.trim()) return
    setIsSaving(true)
    setError(null)
    try {
      const payload: Record<string, string> = { description: newDescription.trim() }
      if (newStudentId.trim()) {
        payload.studentId = newStudentId.trim()
      }
      const { data } = await apiClient.post<TeacherRequest>('/teacher-requests', payload)
      setRequests((prev) => [data, ...prev])
      setNewDescription('')
      setNewStudentId('')
      setIsCreating(false)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la création de la demande'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const statusFilter = (status: TeacherRequest['status'] | 'all') => {
    if (status === 'all') return requests
    return requests.filter((r) => r.status === status)
  }

  const [activeFilter, setActiveFilter] = useState<TeacherRequest['status'] | 'all'>('all')
  const visibleRequests = statusFilter(activeFilter)

  return (
    <Layout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Demandes professeur</h1>
            <p className="text-sm text-gray-500 mt-1">
              {requests.length} demande{requests.length !== 1 ? 's' : ''}
            </p>
          </div>
          {canCreate && !isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
            >
              Nouvelle demande
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">
              ✕
            </button>
          </div>
        )}

        {/* Create form */}
        {isCreating && (
          <form
            onSubmit={handleCreate}
            className="mb-6 bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm"
          >
            <h2 className="text-base font-semibold text-gray-800">Nouvelle demande professeur</h2>

            {hasRole('responsable_pedagogique') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID de l'élève (optionnel)
                </label>
                <input
                  type="text"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  placeholder="UUID de l'élève concerné"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Décrivez le besoin pédagogique, le niveau, les disponibilités souhaitées…"
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSaving || !newDescription.trim()}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSaving ? 'Envoi…' : 'Soumettre la demande'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false)
                  setNewDescription('')
                  setNewStudentId('')
                }}
                className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-200"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {/* Filter tabs */}
        {!isLoading && requests.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {(['all', 'pending', 'accepted', 'declined', 'cancelled'] as const).map((filterValue) => (
              <button
                key={filterValue}
                onClick={() => setActiveFilter(filterValue)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  activeFilter === filterValue
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {filterValue === 'all' ? 'Toutes' : STATUS_LABELS[filterValue]}
                {filterValue === 'all'
                  ? ` (${requests.length})`
                  : ` (${requests.filter((r) => r.status === filterValue).length})`}
              </button>
            ))}
          </div>
        )}

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {!isLoading && visibleRequests.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">
              {activeFilter === 'all' ? 'Aucune demande' : `Aucune demande avec le statut « ${STATUS_LABELS[activeFilter]} »`}
            </p>
            {canCreate && activeFilter === 'all' && (
              <button
                onClick={() => setIsCreating(true)}
                className="mt-3 text-indigo-600 hover:underline text-sm"
              >
                Créer la première demande
              </button>
            )}
          </div>
        )}

        <ul className="space-y-3">
          {visibleRequests.map((req) => (
            <li key={req.id}>
              <Link
                to={`/teacher-requests/${req.id}`}
                className="block p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">
                    Demande #{req.id.slice(0, 8)}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status]}`}
                  >
                    {STATUS_LABELS[req.status]}
                  </span>
                </div>
                {req.description && (
                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">{req.description}</p>
                )}
                {req.studentId && (
                  <p className="mt-1 text-xs text-gray-400">Élève : {req.studentId.slice(0, 8)}…</p>
                )}
                <p className="mt-2 text-xs text-gray-400">
                  {new Date(req.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}
