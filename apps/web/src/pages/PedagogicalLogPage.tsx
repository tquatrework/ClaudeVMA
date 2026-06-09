import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import apiClient from '../api/client'
import Layout from '../components/Layout'

interface LogEntry {
  id: string
  content: string
  authorId: string
  sessionId?: string
  createdAt: string
}

export default function PedagogicalLogPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newContent, setNewContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!studentId) return
    apiClient
      .get<LogEntry[]>(`/logs/student/${studentId}`)
      .then(({ data }) => setLogs(data))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError('Accès refusé')
        else setError('Impossible de charger le cahier de texte')
      })
      .finally(() => setIsLoading(false))
  }, [studentId])

  const addEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContent.trim() || !studentId) return
    setIsSaving(true)
    try {
      const { data } = await apiClient.post<LogEntry>('/logs', {
        studentId,
        content: newContent.trim(),
      })
      setLogs((prev) => [data, ...prev])
      setNewContent('')
    } catch {
      setError('Erreur lors de la création de l\'entrée')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Cahier de texte</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* New entry form */}
        <form
          onSubmit={addEntry}
          className="mb-6 bg-white border border-gray-200 rounded-xl p-4 space-y-3"
        >
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Saisir une nouvelle entrée…"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
          <button
            type="submit"
            disabled={isSaving || !newContent.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? 'Ajout…' : 'Ajouter une entrée'}
          </button>
        </form>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        <ul className="space-y-3">
          {logs.map((log) => (
            <li key={log.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-800">{log.content}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(log.createdAt).toLocaleString('fr-FR')}
              </p>
            </li>
          ))}
          {!isLoading && logs.length === 0 && (
            <li className="text-gray-400 text-sm">Aucune entrée dans le cahier de texte</li>
          )}
        </ul>
      </div>
    </Layout>
  )
}
