/**
 * PedagogicalLogPage — cahier de texte d'un élève (`/pedagogical-log`).
 *
 * Refonte du 2026-08-20 (`docs/routes.md` § pedagogical-log-service) :
 *   1. Catégorie de visibilité corrigée (`parent_formateur` remplace
 *      `eleve_formateur`), libellés centralisés dans `utils/pedagogicalLogLabels.ts`.
 *   2. Formulaire de création à 3 champs optionnels (date, déroulement, à
 *      faire) au lieu d'un texte libre.
 *   3. Écriture réservée au formateur titulaire de la relation — élève,
 *      parent et RP sont désormais strictement lecteurs sur les entrées
 *      normales (le mécanisme des pages spéciales RP reste inchangé).
 *   4. **Bug corrigé** : la page appelait `GET /pedagogical-logs`, route
 *      jamais montée côté contrôleur (`404` réel) — et lisait `studentId`
 *      via `useParams` alors que tous les appelants (`MyStudentsPage`,
 *      `ParentDashboardPage`) le passent en **query param** (`?studentId=`),
 *      jamais en segment de route (`/pedagogical-log` n'a pas de `:studentId`).
 *      Corrigé : lecture via `useSearchParams`, appel de
 *      `GET /students/:studentId/pedagogical-log`, triée du plus récent au
 *      plus ancien par le serveur (jamais re-triée en sens inverse ici).
 *      Recherche par date via `from`/`to`.
 *
 * Sélection de l'élève consulté : un élève consulte toujours son propre
 * cahier ; formateur/parent/RP/AP choisissent parmi leurs élèves liés
 * (`GET /relations/my-contacts`, premier élève sélectionné par défaut — pas
 * d'option « Tous », le cahier de texte se lit un élève à la fois).
 */

import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import { useMyContacts } from '../hooks/relations/useMyContacts'
import { usePedagogicalLog } from '../hooks/pedagogical-log/usePedagogicalLog'
import { isStudentLikeContact } from '../utils/relationAccess'
import { todayIsoCalendarDate } from '../utils/dateFormat'
import type { LogVisibility, PedagogicalLogPage as LogPage } from '../api/pedagogicalLog'
import SpecialLogPageVisibilityDialog from '../components/pedagogical-log/SpecialLogPageVisibilityDialog'
import { NewLogPageForm } from '../components/pedagogical-log/NewLogPageForm'
import type { LogEntryEditValues } from '../components/pedagogical-log/PedagogicalLogEntryItem'
import LogStudentSelector from '../components/pedagogical-log/LogStudentSelector'
import LogDateRangeFilter from '../components/pedagogical-log/LogDateRangeFilter'
import LogEntryList from '../components/pedagogical-log/LogEntryList'
import { ErrorMessage } from '../components/ui/ErrorMessage'

const EMPTY_EDIT_VALUES: LogEntryEditValues = { date: '', sessionSummary: '', homework: '' }

export default function PedagogicalLogPage() {
  const { user, hasRole } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const isEleve = hasRole('eleve')
  const isFormateur = hasRole('formateur')
  const isResponsablePedagogique = hasRole('responsable_pedagogique')

  const needsStudentSelection = !isEleve
  const { contacts, isLoading: isLoadingContacts, error: contactsError } = useMyContacts()
  const studentContacts = needsStudentSelection ? contacts.filter(isStudentLikeContact) : []

  const studentIdFromUrl = searchParams.get('studentId') ?? ''
  const studentId = isEleve
    ? user?.id ?? ''
    : studentIdFromUrl || studentContacts[0]?.userId || ''

  const handleSelectStudent = (nextStudentId: string) => {
    setSearchParams(nextStudentId ? { studentId: nextStudentId } : {})
  }

  // ─── Recherche par date (point 4) ────────────────────────────────────────
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const {
    entries,
    isLoading,
    errorMessage,
    dismissError,
    createEntry,
    isCreating,
    createError,
    dismissCreateError,
    updateEntry,
    updatingLogId,
    updateError,
    deleteEntry,
    deletingLogId,
    deleteError,
    addLocalEntry,
  } = usePedagogicalLog(studentId, { from: fromDate || undefined, to: toDate || undefined })

  // ─── Formulaire de création (points 1 et 2) ──────────────────────────────
  const [newDate, setNewDate] = useState(todayIsoCalendarDate())
  const [newSessionSummary, setNewSessionSummary] = useState('')
  const [newHomework, setNewHomework] = useState('')
  const [newVisibility, setNewVisibility] = useState<LogVisibility>('eleve_parent_formateur')

  const handleAddPage = async (event: React.FormEvent) => {
    event.preventDefault()
    const success = await createEntry({
      date: newDate || undefined,
      sessionSummary: newSessionSummary.trim() || undefined,
      homework: newHomework.trim() || undefined,
      visibility: newVisibility,
    })
    if (success) {
      setNewSessionSummary('')
      setNewHomework('')
      setNewDate(todayIsoCalendarDate())
    }
  }

  // ─── Page spéciale RP — mécanisme inchangé ───────────────────────────────
  const [isSpecialPageDialogOpen, setIsSpecialPageDialogOpen] = useState(false)
  const handleSpecialPageCreated = (newPage: LogPage) => {
    addLocalEntry(newPage)
    setIsSpecialPageDialogOpen(false)
  }

  // ─── Édition inline (point 3 : réservée au formateur pour une entrée normale) ──
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<LogEntryEditValues>(EMPTY_EDIT_VALUES)
  const [editContent, setEditContent] = useState('')

  const startEdit = (entry: LogPage) => {
    setEditingLogId(entry.id)
    if (entry.isSpecialPage) {
      setEditContent(entry.content ?? '')
    } else {
      setEditValues({
        date: entry.date ?? '',
        sessionSummary: entry.sessionSummary ?? '',
        homework: entry.homework ?? '',
      })
    }
  }

  const cancelEdit = () => {
    setEditingLogId(null)
    setEditValues(EMPTY_EDIT_VALUES)
    setEditContent('')
  }

  const handleSaveEdit = async (entry: LogPage) => {
    const payload = entry.isSpecialPage
      ? { content: editContent.trim() }
      : {
          date: editValues.date || undefined,
          sessionSummary: editValues.sessionSummary.trim() || undefined,
          homework: editValues.homework.trim() || undefined,
        }
    const success = await updateEntry(entry.id, payload)
    if (success) cancelEdit()
  }

  const handleDeletePage = async (entry: LogPage) => {
    if (!window.confirm('Supprimer cette entrée du cahier de texte ?')) return
    await deleteEntry(entry.id)
  }

  const viewerContext = {
    userId: user?.id,
    isFormateur,
    isResponsablePedagogique,
    isTechnicienInformatique: hasRole('technicien_informatique'),
  }

  const canWriteNormalEntry = isFormateur && Boolean(studentId)
  const isReadOnly = !isFormateur && !isResponsablePedagogique

  return (
    <Layout>
      <div className="max-w-2xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cahier de texte</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isReadOnly
              ? 'Suivi séance par séance — consultation uniquement'
              : 'Suivi séance par séance'}
          </p>
        </div>

        {needsStudentSelection && (
          <LogStudentSelector
            studentContacts={studentContacts}
            selectedStudentId={studentId}
            onSelectStudent={handleSelectStudent}
            isLoadingContacts={isLoadingContacts}
            contactsError={contactsError}
          />
        )}

        {!studentId ? (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">
              Sélectionnez un élève pour consulter son cahier de texte.
            </p>
          </div>
        ) : (
          <>
            {errorMessage && <ErrorMessage message={errorMessage} onClose={dismissError} />}

            {isReadOnly && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
                Vous consultez le cahier de texte en lecture seule.
              </div>
            )}

            <LogDateRangeFilter
              fromDate={fromDate}
              toDate={toDate}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
              onClear={() => {
                setFromDate('')
                setToDate('')
              }}
            />

            {canWriteNormalEntry && (
              <NewLogPageForm
                date={newDate}
                onDateChange={setNewDate}
                sessionSummary={newSessionSummary}
                onSessionSummaryChange={setNewSessionSummary}
                homework={newHomework}
                onHomeworkChange={setNewHomework}
                selectedVisibility={newVisibility}
                onVisibilityChange={setNewVisibility}
                isSaving={isCreating}
                errorMessage={createError}
                onSubmit={handleAddPage}
              />
            )}
            {!canWriteNormalEntry && createError && (
              <ErrorMessage message={createError} onClose={dismissCreateError} />
            )}

            {isResponsablePedagogique && (
              <button
                onClick={() => setIsSpecialPageDialogOpen(true)}
                className="text-sm text-purple-600 border border-purple-200 px-4 py-2 rounded-lg hover:bg-purple-50 transition-colors"
              >
                Créer une page spéciale (RP)
              </button>
            )}

            {/* Erreur de modification : affichée en ligne, sur l'entrée en cours d'édition (LogEntryList/PedagogicalLogEntryItem). */}
            {deleteError && <ErrorMessage message={deleteError} variant="warning" />}

            <LogEntryList
              entries={entries}
              isLoading={isLoading}
              canWriteNormalEntry={canWriteNormalEntry}
              viewer={viewerContext}
              editingLogId={editingLogId}
              editValues={editValues}
              onEditValuesChange={setEditValues}
              editContent={editContent}
              onEditContentChange={setEditContent}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onSaveEdit={handleSaveEdit}
              updatingLogId={updatingLogId}
              updateError={updateError}
              onDelete={handleDeletePage}
              deletingLogId={deletingLogId}
            />
          </>
        )}
      </div>

      {isSpecialPageDialogOpen && studentId && (
        <SpecialLogPageVisibilityDialog
          studentId={studentId}
          onCreated={handleSpecialPageCreated}
          onClose={() => setIsSpecialPageDialogOpen(false)}
        />
      )}
    </Layout>
  )
}
