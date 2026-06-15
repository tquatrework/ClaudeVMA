import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

interface Incident {
  id: string
  title: string
  description?: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  createdAt: string
  updatedAt?: string
  reporterId?: string
}

const STATUS_OPTIONS: Array<{ value: Incident['status']; label: string }> = [
  { value: 'open', label: 'Ouvert' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'resolved', label: 'Résolu' },
  { value: 'closed', label: 'Fermé' },
]

const STATUS_COLORS: Record<Incident['status'], string> = {
  open: 'bg-red-100 text-red-700',
  in_progress: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
}

export default function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>()
  const { hasRole } = useAuth()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const canUpdateStatus = hasRole('technicien_informatique', 'responsable_pedagogique')

  useEffect(() => {
    if (!incidentId) return
    apiClient
      .get<Incident>(`/incidents/${incidentId}`)
      .then(({ data }) => setIncident(data))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError('Accès refusé')
        else if (status === 404) setError('Incident introuvable')
        else setError('Erreur lors du chargement')
      })
      .finally(() => setIsLoading(false))
  }, [incidentId])

  const handleStatusChange = async (newStatus: Incident['status']) => {
    if (!incidentId) return
    setIsUpdating(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const { data } = await apiClient.put<Incident>(`/incidents/${incidentId}/status`, {
        status: newStatus,
      })
      setIncident(data)
      setSuccessMessage('Statut mis à jour')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la mise à jour du statut'
      setError(message)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/incidents" className="text-sm text-indigo-600 hover:underline">
            ← Incidents
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Détail de l'incident</h1>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            {successMessage}
          </div>
        )}

        {incident && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{incident.title}</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Déclaré le {new Date(incident.createdAt).toLocaleString('fr-FR')}
                </p>
              </div>
              <span
                className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[incident.status] ?? 'bg-gray-100 text-gray-500'}`}
              >
                {STATUS_OPTIONS.find((o) => o.value === incident.status)?.label ?? incident.status}
              </span>
            </div>

            {incident.description && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{incident.description}</p>
              </div>
            )}

            {incident.reporterId && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Rapporteur</p>
                <p className="text-sm text-gray-600 font-mono">{incident.reporterId}</p>
              </div>
            )}

            {incident.updatedAt && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Dernière mise à jour</p>
                <p className="text-sm text-gray-600">
                  {new Date(incident.updatedAt).toLocaleString('fr-FR')}
                </p>
              </div>
            )}

            {canUpdateStatus && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-3">Changer le statut</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.filter((option) => option.value !== incident.status).map((option) => (
                    <button
                      key={option.value}
                      disabled={isUpdating}
                      onClick={() => handleStatusChange(option.value)}
                      className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 disabled:opacity-50 transition-colors"
                    >
                      {isUpdating ? '…' : `Passer en « ${option.label} »`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
