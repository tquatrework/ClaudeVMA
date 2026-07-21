/**
 * PedagogicalLogPage — cahier de texte d'un élève.
 * Accessible aux formateurs (écriture), RP (écriture + pages spéciales), élèves et parents (lecture).
 * Le filtrage de visibilité est géré côté serveur.
 *
 * Routes API :
 *   GET    /students/:studentId/pedagogical-log
 *   POST   /students/:studentId/pedagogical-log         (formateur, RP, AP, TI)
 *   POST   /students/:studentId/pedagogical-log/special-pages  (RP uniquement)
 *   PATCH  /logs/:id
 *   DELETE /logs/:id     (auteur ou RP)
 */

import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
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
import { NewLogPageForm } from '../components/pedagogical-log/NewLogPageForm'
import { PedagogicalLogEntryItem } from '../components/pedagogical-log/PedagogicalLogEntryItem'

export default function PedagogicalLogPage() {
  const { studentId } = useParams<{ studentId: string }>()
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

  const canWrite = hasRole('formateur', 'responsable_pedagogique', 'animateur_pedagogique', 'technicien_informatique')
  const isResponsablePedagogique = hasRole('responsable_pedagogique')
  const isReadOnly = !canWrite

  useEffect(() => {
    setIsLoading(true)
    fetchPedagogicalLogs()
      .then((pages) => setLogPages(pages))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setErrorMessage('Accès refusé')
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

        {/* New entry form — visible to formateurs, RP, AP, TI */}
        {canWrite && (
          <NewLogPageForm
            newContent={newContent}
            onNewContentChange={setNewContent}
            selectedVisibility={selectedVisibility}
            onVisibilityChange={setSelectedVisibility}
            isSaving={isSaving}
            onSubmit={handleAddPage}
            isResponsablePedagogique={isResponsablePedagogique}
            onOpenSpecialPageDialog={() => setIsSpecialPageDialogOpen(true)}
          />
        )}

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {!isLoading && logPages.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">Aucune entrée dans le cahier de texte</p>
            {canWrite && (
              <p className="text-xs text-gray-300 mt-1">
                Utilisez le formulaire ci-dessus pour ajouter la première page.
              </p>
            )}
          </div>
        )}

        <ul className="space-y-3">
          {logPages.map((logPage) => (
            <PedagogicalLogEntryItem
              key={logPage.id}
              logPage={logPage}
              visibilityLabel={visibilityLabel}
              isEditing={editingLogId === logPage.id}
              editContent={editContent}
              onEditContentChange={setEditContent}
              onStartEdit={() => startEdit(logPage)}
              onCancelEdit={cancelEdit}
              onSaveEdit={() => handleSaveEdit(logPage.id)}
              isSavingEdit={isSavingEdit}
              canEdit={canEditPage(logPage)}
              canDelete={canDeletePage(logPage)}
              onDelete={() => handleDeletePage(logPage.id)}
              isDeleting={deletingLogId === logPage.id}
            />
          ))}
        </ul>
      </div>

      {/* Special page dialog — RP only */}
      {isSpecialPageDialogOpen && (
        <SpecialLogPageVisibilityDialog
          studentId={studentId ?? user?.id ?? ''}
          onCreated={handleSpecialPageCreated}
          onClose={() => setIsSpecialPageDialogOpen(false)}
        />
      )}
    </Layout>
  )
}
