import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

interface Incident {
  id: string
  title: string
  description?: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  createdAt: string
  reporterId?: string
}

const STATUS_LABELS: Record<Incident['status'], string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Résolu',
  closed: 'Fermé',
}

const STATUS_COLORS: Record<Incident['status'], string> = {
  open: 'bg-red-100 text-red-700',
  in_progress: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
}

export default function IncidentsPage() {
  const { hasRole } = useAuth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form state
  const [isCreating, setIsCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const canCreateIncident = hasRole('technicien_informatique', 'eleve', 'formateur', 'parent_financeur', 'responsable_pedagogique', 'animateur_pedagogique')

  useEffect(() => {
    apiClient
      .get<Incident[]>('/incidents')
      .then(({ data }) => setIncidents(data))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError('Accès refusé')
        else setError('Impossible de charger les incidents')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setIsSaving(true)
    setError(null)
    try {
      const { data } = await apiClient.post<Incident>('/incidents', {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
      })
      setIncidents((prev) => [data, ...prev])
      setNewTitle('')
      setNewDescription('')
      setIsCreating(false)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Erreur lors de la création de l'incident"
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Incidents</h1>
            <p className="text-sm text-gray-500 mt-1">Déclaration et suivi des incidents techniques</p>
          </div>
          {canCreateIncident && !isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
            >
              Déclarer un incident
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

        {/* Create incident form */}
        {isCreating && (
          <form
            onSubmit={handleCreate}
            className="mb-6 bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm"
          >
            <h2 className="text-base font-semibold text-gray-800">Nouvel incident</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Titre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex : Connexion impossible depuis ce matin"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optionnel)
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Décrivez le problème rencontré…"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSaving || !newTitle.trim()}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSaving ? 'Envoi…' : 'Déclarer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false)
                  setNewTitle('')
                  setNewDescription('')
                }}
                className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-200"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {!isLoading && !error && incidents.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">Aucun incident déclaré</p>
            {canCreateIncident && (
              <button
                onClick={() => setIsCreating(true)}
                className="mt-3 text-indigo-600 hover:underline text-sm"
              >
                Déclarer le premier incident
              </button>
            )}
          </div>
        )}

        <ul className="space-y-3">
          {incidents.map((incident) => (
            <li key={incident.id}>
              <Link
                to={`/incidents/${incident.id}`}
                className="block p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{incident.title}</p>
                    {incident.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{incident.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(incident.createdAt).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[incident.status] ?? 'bg-gray-100 text-gray-500'}`}
                  >
                    {STATUS_LABELS[incident.status] ?? incident.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}
