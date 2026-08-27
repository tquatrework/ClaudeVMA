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
 *   5. **Formulaire replié par défaut (2026-08-21)** : le formulaire de
 *      nouvelle entrée ne s'affiche plus automatiquement au chargement — il
 *      poussait la liste des entrées existantes hors écran. Un bouton
 *      « Nouvelle entrée » l'ouvre à la demande, au même endroit qu'avant ; la
 *      liste reste immédiatement visible par défaut.
 *
 * Sélection de l'élève consulté : un élève consulte toujours son propre
 * cahier ; formateur/parent/RP/AP choisissent parmi leurs élèves liés
 * (`GET /relations/my-contacts`, premier élève sélectionné par défaut — pas
 * d'option « Tous », le cahier de texte se lit un élève à la fois).
 *
 * Liens et pièces jointes (2026-08-26) : un lien s'insère directement dans
 * le texte de `sessionSummary`/`homework` via `InsertLinkButton` (syntaxe
 * légère `[texte](url)`, `src/utils/lightMarkup.ts`) — plus de champ
 * `resourceLinks` structuré séparé (retiré après retour utilisateur réel).
 * Le formulaire de création et l'édition inline sont gérés par les hooks
 * `useNewLogEntryForm`/`useLogEntryEditing` (extraits pour rester sous
 * 300 lignes) ; les pièces jointes des entrées déjà créées vivent dans
 * `LogEntryAttachments` (via `LogEntryList`).
 *
 * Pièce jointe choisie **pendant** la saisie de la nouvelle entrée
 * (2026-08-27, défaut majeur remonté par test utilisateur) : les réglages
 * système (`useAttachmentSettings`) sont désormais lus **avant** de
 * construire `useNewLogEntryForm`, qui en a besoin pour valider localement le
 * fichier choisi et l'envoyer juste après la création de l'entrée — voir ce
 * hook pour le détail de la séquence.
 *
 * Pièce jointe sur une entrée déjà créée (révisé le 2026-08-27, second
 * correctif du jour) : l'ajout, retiré une première fois de
 * `LogEntryAttachments`, est réintroduit **en mode édition uniquement** —
 * modifier une entrée existante redonne le même niveau de contrôle qu'une
 * entrée non encore validée. `attachmentSettings` est donc transmis à
 * `LogEntryList` (et de là à chaque `PedagogicalLogEntryItem`), en plus de
 * `NewLogPageForm`.
 */

import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import { useMyContacts } from '../hooks/relations/useMyContacts'
import { usePedagogicalLog } from '../hooks/pedagogical-log/usePedagogicalLog'
import { useAttachmentSettings } from '../hooks/pedagogical-log/useAttachmentSettings'
import { useNewLogEntryForm } from '../hooks/pedagogical-log/useNewLogEntryForm'
import { useLogEntryEditing } from '../hooks/pedagogical-log/useLogEntryEditing'
import { isStudentLikeContact } from '../utils/relationAccess'
import { getAttachmentMaxSizeHint } from '../utils/logAttachment'
import type { PedagogicalLogPage as LogPage } from '../api/pedagogicalLog'
import SpecialLogPageVisibilityDialog from '../components/pedagogical-log/SpecialLogPageVisibilityDialog'
import { NewLogPageForm } from '../components/pedagogical-log/NewLogPageForm'
import LogStudentSelector from '../components/pedagogical-log/LogStudentSelector'
import LogDateRangeFilter from '../components/pedagogical-log/LogDateRangeFilter'
import LogEntryList from '../components/pedagogical-log/LogEntryList'
import { ErrorMessage } from '../components/ui/ErrorMessage'

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

  const canWriteNormalEntry = isFormateur && Boolean(studentId)

  // Réglages système des pièces jointes — lus une seule fois par la page (pas
  // par entrée), utiles seulement au formateur qui peut en joindre. Lus
  // **avant** `useNewLogEntryForm`, qui en a besoin pour valider localement
  // un fichier choisi pendant la saisie (2026-08-27).
  const { attachmentSettings } = useAttachmentSettings(canWriteNormalEntry)

  // ─── Formulaire de création (points 1, 2, liens du 2026-08-26, pièce
  // jointe choisie pendant la saisie du 2026-08-27) ─────────────────────────
  const newEntryForm = useNewLogEntryForm(createEntry, isCreating, attachmentSettings)

  // ─── Page spéciale RP — mécanisme inchangé ───────────────────────────────
  const [isSpecialPageDialogOpen, setIsSpecialPageDialogOpen] = useState(false)
  const handleSpecialPageCreated = (newPage: LogPage) => {
    addLocalEntry(newPage)
    setIsSpecialPageDialogOpen(false)
  }

  // ─── Édition inline (point 3, et liens du 2026-08-26) ─────────────────────
  const entryEditing = useLogEntryEditing(updateEntry)

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

            {canWriteNormalEntry && !newEntryForm.isNewEntryFormOpen && (
              <button
                type="button"
                onClick={newEntryForm.openForm}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Nouvelle entrée
              </button>
            )}

            {canWriteNormalEntry && newEntryForm.isNewEntryFormOpen && (
              <NewLogPageForm
                date={newEntryForm.date}
                onDateChange={newEntryForm.onDateChange}
                sessionSummary={newEntryForm.sessionSummary}
                onSessionSummaryChange={newEntryForm.onSessionSummaryChange}
                homework={newEntryForm.homework}
                onHomeworkChange={newEntryForm.onHomeworkChange}
                selectedVisibility={newEntryForm.visibility}
                onVisibilityChange={newEntryForm.onVisibilityChange}
                isSaving={newEntryForm.isSaving}
                errorMessage={createError}
                onSubmit={newEntryForm.handleSubmit}
                onCancel={newEntryForm.handleCancel}
                attachmentsEnabled={attachmentSettings.attachmentsEnabled}
                maxFileBytesHint={getAttachmentMaxSizeHint(attachmentSettings.maxFileBytes)}
                pendingAttachmentName={newEntryForm.pendingAttachmentName}
                pendingAttachmentSizeLabel={newEntryForm.pendingAttachmentSizeLabel}
                attachmentError={newEntryForm.attachmentError}
                onSelectAttachment={newEntryForm.onSelectAttachment}
                onRemoveAttachment={newEntryForm.onRemoveAttachment}
              />
            )}
            {!canWriteNormalEntry && createError && (
              <ErrorMessage message={createError} onClose={dismissCreateError} />
            )}
            {/* Échec d'envoi de la pièce jointe survenu après une création réussie :
                le formulaire s'est déjà refermé, l'entrée existe — on garde le
                message d'erreur visible au niveau de la page (2026-08-27). */}
            {!newEntryForm.isNewEntryFormOpen && newEntryForm.attachmentError && (
              <ErrorMessage
                message={newEntryForm.attachmentError}
                onClose={newEntryForm.dismissAttachmentError}
                variant="warning"
              />
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
              attachmentSettings={attachmentSettings}
              editingLogId={entryEditing.editingLogId}
              editValues={entryEditing.editValues}
              onEditValuesChange={entryEditing.onEditValuesChange}
              editContent={entryEditing.editContent}
              onEditContentChange={entryEditing.onEditContentChange}
              onStartEdit={entryEditing.startEdit}
              onCancelEdit={entryEditing.cancelEdit}
              onSaveEdit={entryEditing.saveEdit}
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
