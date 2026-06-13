import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

interface LogEntry {
  id: string
  content: string
  authorId: string
  sessionId?: string
  createdAt: string
  updatedAt?: string
}

export default function PedagogicalLogPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const { user, hasRole } = useAuth()

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newContent, setNewContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Edit state
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const canAddEntry = hasRole('formateur', 'responsable_pedagogique', 'animateur_pedagogique')
  const isOwnLog = user?.id === studentId

  useEffect(() => {
    if (!studentId) return
    apiClient
      .get<LogEntry[]>(`/logs/student/${studentId}`)
      .then(({ data }) => setLogs(Array.isArray(data) ? data : []))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError('Accès refusé')
        else setError('Impossible de charger le cahier de texte')
      })
      .finally(() => setIsLoading(false))
  }, [studentId])

  const handleAddEntry = async (e: React.FormEvent) => {
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
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Erreur lors de la création de l'entrée"
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const startEdit = (logEntry: LogEntry) => {
    setEditingLogId(logEntry.id)
    setEditContent(logEntry.content)
  }

  const cancelEdit = () => {
    setEditingLogId(null)
    setEditContent('')
  }

  const handleSaveEdit = async (logId: string) => {
    if (!editContent.trim()) return
    setIsSavingEdit(true)
    try {
      const { data } = await apiClient.patch<LogEntry>(`/logs/${logId}`, {
        content: editContent.trim(),
      })
      setLogs((prev) => prev.map((log) => (log.id === logId ? data : log)))
      setEditingLogId(null)
      setEditContent('')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la modification'
      setError(message)
    } finally {
      setIsSavingEdit(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Cahier de texte</h1>
          {studentId && (
            <p className="text-sm text-gray-500 mt-1">
              Élève : <span className="font-mono text-xs">{studentId}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
          </div>
        )}

        {/* New entry form — visible to formateurs and RP */}
        {canAddEntry && (
          <form
            onSubmit={handleAddEntry}
            className="mb-6 bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm"
          >
            <h2 className="text-sm font-semibold text-gray-700">Nouvelle entrée</h2>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Décrivez la séance, les notions abordées, les difficultés observées…"
              rows={4}
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
        )}

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {!isLoading && logs.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">Aucune entrée dans le cahier de texte</p>
            {canAddEntry && (
              <p className="text-xs text-gray-300 mt-1">
                Utilisez le formulaire ci-dessus pour ajouter la première entrée.
              </p>
            )}
          </div>
        )}

        <ul className="space-y-3">
          {logs.map((log) => (
            <li key={log.id} className="bg-white border border-gray-200 rounded-xl p-4">
              {editingLogId === log.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                    className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleSaveEdit(log.id)}
                      disabled={isSavingEdit || !editContent.trim()}
                      className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isSavingEdit ? 'Sauvegarde…' : 'Enregistrer'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-200"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{log.content}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-xs text-gray-400">
                      <span>{new Date(log.createdAt).toLocaleString('fr-FR')}</span>
                      {log.updatedAt && log.updatedAt !== log.createdAt && (
                        <span className="ml-2 italic">
                          · modifié {new Date(log.updatedAt).toLocaleString('fr-FR')}
                        </span>
                      )}
                    </div>
                    {/* Can edit if author or RP/TI */}
                    {(log.authorId === user?.id ||
                      hasRole('responsable_pedagogique', 'technicien_informatique')) && (
                      <button
                        onClick={() => startEdit(log)}
                        className="text-xs text-indigo-500 hover:underline"
                      >
                        Modifier
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}
