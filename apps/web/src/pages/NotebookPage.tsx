/**
 * PersonalNotebookPage (NotebookPage) — carnet personnel de l'élève.
 * Réservé à l'élève propriétaire et au TI (pour incidents).
 * Parent financeur : accès refusé (PLOG-FB-001).
 * RP : accès refusé en Phase 1.
 *
 * Routes API :
 *   GET    /students/:studentId/notebook
 *   POST   /students/:studentId/notebook
 *   PATCH  /students/:studentId/notebook/:id
 *   DELETE /students/:studentId/notebook/:id
 */

import React, { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import {
  fetchNotebookEntries,
  createNotebookEntry,
  updateNotebookEntry,
  deleteNotebookEntry,
  type NotebookEntry,
} from '../api/pedagogicalLogNotebook'

/**
 * Carnet personnel — réservé à l'élève propriétaire (FRONT-BR-004, PLOG-FB-001).
 * Un parent ne doit jamais accéder à cette page.
 * Le contrôle frontend est un garde-fou ergonomique ; le backend bloque également.
 */
export default function NotebookPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const { user, hasRole } = useAuth()

  // PLOG-FB-001 — parent_financeur cannot see the notebook
  if (hasRole('parent_financeur')) {
    return <Navigate to="/forbidden" replace />
  }

  // RP also cannot access in Phase 1
  if (hasRole('responsable_pedagogique')) {
    return <Navigate to="/forbidden" replace />
  }

  // An élève can only see their own notebook
  if (hasRole('eleve') && user?.id !== studentId) {
    return <Navigate to="/forbidden" replace />
  }

  return <NotebookContent studentId={studentId!} />
}

function NotebookContent({ studentId }: { studentId: string }) {
  const { user, hasRole } = useAuth()

  const [entries, setEntries] = useState<NotebookEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [newContent, setNewContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Edit state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const isOwner = user?.id === studentId
  const canWrite = isOwner && hasRole('eleve')

  useEffect(() => {
    fetchNotebookEntries(studentId)
      .then((fetchedEntries) => setEntries(fetchedEntries))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setErrorMessage('Accès refusé')
        else setErrorMessage('Impossible de charger le carnet personnel')
      })
      .finally(() => setIsLoading(false))
  }, [studentId])

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContent.trim()) return
    setIsSaving(true)
    setErrorMessage(null)
    try {
      const newEntry = await createNotebookEntry(studentId, { content: newContent.trim() })
      setEntries((prev) => [newEntry, ...prev])
      setNewContent('')
    } catch {
      setErrorMessage("Erreur lors de l'ajout de la note")
    } finally {
      setIsSaving(false)
    }
  }

  const startEdit = (entry: NotebookEntry) => {
    setEditingEntryId(entry.id)
    setEditContent(entry.content)
  }

  const cancelEdit = () => {
    setEditingEntryId(null)
    setEditContent('')
  }

  const handleSaveEdit = async (entryId: string) => {
    if (!editContent.trim()) return
    setIsSavingEdit(true)
    setErrorMessage(null)
    try {
      const updatedEntry = await updateNotebookEntry(studentId, entryId, {
        content: editContent.trim(),
      })
      setEntries((prev) => prev.map((e) => (e.id === entryId ? updatedEntry : e)))
      setEditingEntryId(null)
      setEditContent('')
    } catch {
      setErrorMessage('Erreur lors de la modification')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!window.confirm('Supprimer cette note ?')) return
    setErrorMessage(null)
    try {
      await deleteNotebookEntry(studentId, entryId)
      setEntries((prev) => prev.filter((e) => e.id !== entryId))
    } catch {
      setErrorMessage('Erreur lors de la suppression')
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mon carnet personnel</h1>
          <p className="text-xs text-indigo-600 mt-1">Espace privé — visible uniquement par vous</p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600 ml-3">
              ✕
            </button>
          </div>
        )}

        {/* Write form — élève propriétaire only */}
        {canWrite && (
          <form
            onSubmit={handleAddEntry}
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
        )}

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {!isLoading && entries.length === 0 && !errorMessage && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">Aucune note pour l'instant</p>
          </div>
        )}

        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              {editingEntryId === entry.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                    className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(entry.id)}
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
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{entry.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-400">
                      {new Date(entry.createdAt).toLocaleString('fr-FR')}
                      {entry.updatedAt && entry.updatedAt !== entry.createdAt && (
                        <span className="ml-2 italic">
                          · modifié {new Date(entry.updatedAt).toLocaleString('fr-FR')}
                        </span>
                      )}
                    </p>
                    {canWrite && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(entry)}
                          className="text-xs text-indigo-500 hover:underline"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="text-xs text-red-400 hover:underline"
                        >
                          Supprimer
                        </button>
                      </div>
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
