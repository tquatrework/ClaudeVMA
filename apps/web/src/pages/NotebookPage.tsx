import React, { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

interface NotebookEntry {
  id: string
  content: string
  createdAt: string
}

/**
 * Carnet personnel — réservé à l'élève propriétaire (FRONT-BR-004, FRONT-FB-001).
 * Un parent ne doit jamais accéder à cette page.
 * Le contrôle frontend est un garde-fou ergonomique ; le backend bloque également.
 */
export default function NotebookPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const { user, hasRole } = useAuth()

  // FRONT-FB-001 — parent cannot see the notebook
  if (hasRole('parent_financeur')) {
    return <Navigate to="/forbidden" replace />
  }

  // An élève can only see their own notebook
  if (hasRole('eleve') && user?.id !== studentId) {
    return <Navigate to="/forbidden" replace />
  }

  return <NotebookContent studentId={studentId!} />
}

function NotebookContent({ studentId }: { studentId: string }) {
  const [entries, setEntries] = useState<NotebookEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newContent, setNewContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    apiClient
      .get<NotebookEntry[]>(`/students/${studentId}/notebook`)
      .then(({ data }) => setEntries(data))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError('Accès refusé')
        else setError('Impossible de charger le carnet personnel')
      })
      .finally(() => setIsLoading(false))
  }, [studentId])

  const addEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContent.trim()) return
    setIsSaving(true)
    try {
      const { data } = await apiClient.post<NotebookEntry>(`/students/${studentId}/notebook`, {
        content: newContent.trim(),
      })
      setEntries((prev) => [data, ...prev])
      setNewContent('')
    } catch {
      setError('Erreur lors de l\'ajout')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mon carnet personnel</h1>
          <p className="text-xs text-indigo-600 mt-1">Espace privé — visible uniquement par vous</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <form
          onSubmit={addEntry}
          className="mb-6 bg-white border border-indigo-100 rounded-xl p-4 space-y-3"
        >
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Écrire une note personnelle…"
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
          <button
            type="submit"
            disabled={isSaving || !newContent.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? 'Ajout…' : 'Ajouter une note'}
          </button>
        </form>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm"
            >
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{entry.content}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(entry.createdAt).toLocaleString('fr-FR')}
              </p>
            </li>
          ))}
          {!isLoading && entries.length === 0 && (
            <li className="text-gray-400 text-sm">Aucune note pour l'instant</li>
          )}
        </ul>
      </div>
    </Layout>
  )
}
