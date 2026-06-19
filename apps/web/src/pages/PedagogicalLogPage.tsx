/**
 * PedagogicalLogPage — cahier de texte partagé.
 * Accessible aux formateurs (écriture), RP (écriture + pages spéciales),
 * élèves et parents (lecture seule).
 * Le filtrage de visibilité est géré côté serveur.
 *
 * Routes API :
 *   GET    /pedagogical-logs
 *   POST   /pedagogical-logs         (formateur, RP)
 *   PUT    /pedagogical-logs/:id     (auteur)
 *   DELETE /pedagogical-logs/:id     (auteur ou RP)
 *   POST   /students/:studentId/pedagogical-log/special-pages  (RP uniquement)
 */

import React, { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import {
  fetchPedagogicalLogs,
  createLogPage,
  updateLogPage,
  deleteLogPage,
  type PedagogicalLogPage as LogPage,
  type LogVisibility,
  type CreateLogPagePayload,
} from '../api/pedagogicalLog'
import SpecialLogPageVisibilityDialog from '../components/pedagogical-log/SpecialLogPageVisibilityDialog'

export default function PedagogicalLogPage() {
  const { user, hasRole } = useAuth()

  const [logPages, setLogPages] = useState<LogPage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // New page form
  const [newContent, setNewContent] = useState('')
  const [selectedVisibility, setSelectedVisibility] = useState<LogVisibility>('eleve_parent_formateur')
  const [isSaving, setIsSaving] = useState(false)

  // Edit state
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Delete state
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null)

  // Special page dialog (RP only)
  const [isSpecialPageDialogOpen, setIsSpecialPageDialogOpen] = useState(false)

  const canWrite = hasRole('formateur', 'responsable_pedagogique')
  const isResponsablePedagogique = hasRole('responsable_pedagogique')
  const isReadOnly = !canWrite

  useEffect(() => {
    setIsLoading(true)
    fetchPedagogicalLogs()
      .then((pages) => setLogPages(pages))
      .catch((err) => {
        const httpStatus = err?.response?.status
        if (httpStatus === 403) setErrorMessage('Accès refusé')
        else setErrorMessage('Impossible de charger le cahier de texte')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const handleAddPage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContent.trim()) return
    setIsSaving(true)
    setErrorMessage(null)
    try {
      const payload: CreateLogPagePayload = {
        content: newContent.trim(),
        visibility: selectedVisibility,
      }
      const newPage = await createLogPage(payload)
      setLogPages((prev) => [newPage, ...prev])
      setNewContent('')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la création de la page'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSpecialPageCreated = (newPage: LogPage) => {
    setLogPages((prev) => [newPage, ...prev])
    setIsSpecialPageDialogOpen(false)
  }

  const startEdit = (logPage: LogPage) => {
    setEditingLogId(logPage.id)
    setEditContent(logPage.content)
  }

  const cancelEdit = () => {
    setEditingLogId(null)
    setEditContent('')
  }

  const handleSaveEdit = async (logId: string) => {
    if (!editContent.trim()) return
    setIsSavingEdit(true)
    setErrorMessage(null)
    try {
      const updatedPage = await updateLogPage(logId, editContent.trim())
      setLogPages((prev) => prev.map((p) => (p.id === logId ? updatedPage : p)))
      setEditingLogId(null)
      setEditContent('')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la modification'
      setErrorMessage(message)
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeletePage = async (logId: string) => {
    if (!window.confirm('Supprimer cette entrée du cahier de texte ?')) return
    setDeletingLogId(logId)
    setErrorMessage(null)
    try {
      await deleteLogPage(logId)
      setLogPages((prev) => prev.filter((p) => p.id !== logId))
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la suppression'
      setErrorMessage(message)
    } finally {
      setDeletingLogId(null)
    }
  }

  const canDeletePage = (logPage: LogPage): boolean => {
    return logPage.authorId === user?.id || isResponsablePedagogique
  }

  const canEditPage = (logPage: LogPage): boolean => {
    return logPage.authorId === user?.id
  }

  const visibilityLabel: Record<LogVisibility, string> = {
    eleve_parent_formateur: 'Élève + Parent + Formateur',
    eleve_formateur: 'Élève + Formateur',
    formateur_rp: 'Formateur + RP uniquement',
    special: 'Page spéciale',
  }

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Cahier de texte</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isReadOnly
              ? 'Suivi séance par séance — consultation uniquement'
              : 'Suivi séance par séance — vous pouvez ajouter des entrées'}
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600 ml-3">
              ✕
            </button>
          </div>
        )}

        {/* Read-only banner for eleve and parent */}
        {isReadOnly && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
            Vous consultez le cahier de texte en lecture seule.
          </div>
        )}

        {/* New entry form — visible to formateurs and RP */}
        {canWrite && (
          <div className="mb-6 space-y-3">
            <form
              onSubmit={handleAddPage}
              className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm"
            >
              <h2 className="text-sm font-semibold text-gray-700">Nouvelle entrée</h2>

              <div>
                <label htmlFor="visibility-select" className="block text-xs text-gray-500 mb-1">
                  Visibilité
                </label>
                <select
                  id="visibility-select"
                  value={selectedVisibility}
                  onChange={(e) => setSelectedVisibility(e.target.value as LogVisibility)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="eleve_parent_formateur">Élève + Parent + Formateur</option>
                  <option value="eleve_formateur">Élève + Formateur</option>
                  <option value="formateur_rp">Formateur + RP uniquement</option>
                </select>
              </div>

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

            {/* RP special page button */}
            {isResponsablePedagogique && (
              <button
                onClick={() => setIsSpecialPageDialogOpen(true)}
                className="text-sm text-purple-600 border border-purple-200 px-4 py-2 rounded-lg hover:bg-purple-50 transition-colors"
              >
                Créer une page spéciale (RP)
              </button>
            )}
          </div>
        )}

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {!isLoading && logPages.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">Aucune entrée dans le cahier de texte</p>
            {canWrite && (
              <p className="text-xs text-gray-300 mt-1">
                Utilisez le formulaire ci-dessus pour ajouter la première entrée.
              </p>
            )}
          </div>
        )}

        <ul className="space-y-3">
          {logPages.map((logPage) => (
            <li
              key={logPage.id}
              className={`bg-white border rounded-xl p-4 ${
                logPage.isSpecialPage ? 'border-purple-200 bg-purple-50' : 'border-gray-200'
              }`}
            >
              {editingLogId === logPage.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                    className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleSaveEdit(logPage.id)}
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
                  {logPage.isSpecialPage && (
                    <span className="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mb-2">
                      Page spéciale{logPage.hiddenFromStudent ? ' — masquée à l\'élève' : ''}
                    </span>
                  )}
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{logPage.content}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-xs text-gray-400 space-x-2">
                      <span>{new Date(logPage.createdAt).toLocaleString('fr-FR')}</span>
                      <span className="text-gray-300">·</span>
                      <span className="italic">{logPage.authorRole}</span>
                      <span className="text-gray-300">·</span>
                      <span className="italic">{visibilityLabel[logPage.visibility]}</span>
                    </div>
                    <div className="flex gap-2">
                      {canEditPage(logPage) && (
                        <button
                          onClick={() => startEdit(logPage)}
                          className="text-xs text-indigo-500 hover:underline"
                        >
                          Modifier
                        </button>
                      )}
                      {canDeletePage(logPage) && (
                        <button
                          onClick={() => handleDeletePage(logPage.id)}
                          disabled={deletingLogId === logPage.id}
                          className="text-xs text-red-400 hover:underline disabled:opacity-50"
                        >
                          {deletingLogId === logPage.id ? 'Suppression…' : 'Supprimer'}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Special page dialog — RP only */}
      {isSpecialPageDialogOpen && (
        <SpecialLogPageVisibilityDialog
          studentId={user?.id ?? ''}
          onCreated={handleSpecialPageCreated}
          onClose={() => setIsSpecialPageDialogOpen(false)}
        />
      )}
    </Layout>
  )
}
