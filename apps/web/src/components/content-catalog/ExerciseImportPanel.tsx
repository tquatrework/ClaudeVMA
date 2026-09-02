/**
 * ExerciseImportPanel — import de plusieurs Exercices d'un coup depuis un fichier
 * CSV/Excel (`docs/architecture.md` > « Import d'Exercice depuis un tableur
 * (CSV/Excel), et modèle de type identique pour l'import de Quizz », arbitrage du
 * 2026-09-02).
 *
 * Repris directement du patron de `QuizImportPanel` (même mécanisme d'import déjà
 * en place côté Quizz) : placé à côté du bouton de création manuelle existant
 * (`ExerciseCreationSection`), visible aux mêmes créateurs (formateur, AP, RP).
 * Deux temps :
 * 1. sélection d'un fichier .csv/.xlsx, avec la limite de taille annoncée avant
 *    sélection (lue côté serveur, `useExerciseImportConstraints`), et un lien de
 *    téléchargement du fichier modèle ;
 * 2. après envoi, un compte-rendu **par bloc d'Exercice détecté** dans le fichier
 *    — jamais un état succès/échec global, un bloc en erreur n'empêchant jamais
 *    les autres blocs valides d'être créés.
 */

import React, { useId, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExerciseImport } from '../../hooks/content-catalog/useExerciseImport'
import { useImportTemplateDownload } from '../../hooks/content-catalog/useImportTemplateDownload'
import { fetchExerciseImportTemplate } from '../../api/exerciseImport'
import { ErrorMessage } from '../ui/ErrorMessage'
import { StatusBadge } from '../ui/StatusBadge'
import {
  EXERCISE_IMPORT_BLOCK_STATUS_BADGE_CLASSES,
  EXERCISE_IMPORT_BLOCK_STATUS_LABELS,
  EXERCISE_IMPORT_FILE_INPUT_ACCEPT,
  EXERCISE_IMPORT_LABELS,
  getExerciseImportBlockFallbackLabel,
  getExerciseImportMaxSizeHint,
} from '../../utils/exerciseImport'
import { EXERCISE_STATUS_LABELS } from '../../utils/exerciseLabels'

const TEMPLATE_FILENAME = 'modele-import-exercices.csv'

interface ExerciseImportPanelProps {
  /** Après un import réussi (au moins la réponse reçue, résultats affichés) : les listes changent. */
  onImported: () => void
  onCancel: () => void
}

export function ExerciseImportPanel({ onImported, onCancel }: ExerciseImportPanelProps) {
  const navigate = useNavigate()
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    importConstraints,
    selectedFile,
    selectionError,
    selectFile,
    submitImport,
    isSubmittingImport,
    submitError,
    results,
    reset,
  } = useExerciseImport()

  const { downloadTemplate, isDownloadingTemplate, downloadError } = useImportTemplateDownload(
    fetchExerciseImportTemplate,
    TEMPLATE_FILENAME,
  )

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0] ?? null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await submitImport()
    if (fileInputRef.current) fileInputRef.current.value = ''
    // Rafraîchit catalogue et « Mes Exercices » dès que le serveur a répondu, que
    // l'import ait réussi ou échoué (refetch idempotent) — le compte-rendu par
    // bloc reste affiché tant que l'utilisateur ne l'a pas fermé, pour ne rien
    // lui faire perdre (règle du 2026-08-10, « Chargement des données »).
    onImported()
  }

  const handleClose = () => {
    reset()
    onCancel()
  }

  if (results) {
    const createdCount = results.filter((block) => block.status === 'created').length
    const errorCount = results.length - createdCount

    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            {EXERCISE_IMPORT_LABELS.resultsTitle}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {createdCount} exercice{createdCount > 1 ? 's' : ''} créé{createdCount > 1 ? 's' : ''}
            {errorCount > 0 ? `, ${errorCount} en erreur` : ''}.
          </p>
        </div>

        <ul className="space-y-2">
          {results.map((block) => (
            <li
              key={block.blockIndex}
              className="border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {block.title ?? getExerciseImportBlockFallbackLabel(block.blockIndex)}
                </p>
                {block.status === 'created' && block.validationStatus && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {EXERCISE_STATUS_LABELS[block.validationStatus]}
                  </p>
                )}
                {block.status === 'error' && block.errors && block.errors.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {block.errors.map((rowError, index) => (
                      <li key={index} className="text-xs text-red-600">
                        Ligne {rowError.row} : {rowError.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge
                  status={block.status}
                  label={EXERCISE_IMPORT_BLOCK_STATUS_LABELS[block.status]}
                  badgeClasses={EXERCISE_IMPORT_BLOCK_STATUS_BADGE_CLASSES}
                />
                {block.status === 'created' && block.exerciseId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/content/exercises/${block.exerciseId}`)}
                    className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors"
                  >
                    Voir la fiche
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
          >
            {EXERCISE_IMPORT_LABELS.closeResultsAction}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-xl p-5 space-y-4"
    >
      <h3 className="text-base font-semibold text-gray-900">{EXERCISE_IMPORT_LABELS.modalTitle}</h3>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 space-y-2">
        <p className="text-sm text-gray-800">
          {getExerciseImportMaxSizeHint(importConstraints.maxFileSizeBytes)}
        </p>
        <button
          type="button"
          onClick={() => void downloadTemplate()}
          disabled={isDownloadingTemplate}
          className="text-sm font-medium text-indigo-700 hover:text-indigo-800 disabled:opacity-50 underline"
        >
          {isDownloadingTemplate ? 'Téléchargement du modèle…' : 'Télécharger le fichier modèle'}
        </button>
        {downloadError && <ErrorMessage message={downloadError} />}
      </div>

      <div>
        <label htmlFor={fileInputId} className="block text-xs text-gray-600 mb-1">
          {EXERCISE_IMPORT_LABELS.fileInputLabel}
        </label>
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          accept={EXERCISE_IMPORT_FILE_INPUT_ACCEPT}
          onChange={handleFileSelected}
          disabled={isSubmittingImport}
          className="block w-full text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50"
        />
      </div>

      {selectionError && <ErrorMessage message={selectionError} />}
      {submitError && <ErrorMessage message={submitError} />}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={!selectedFile || isSubmittingImport}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmittingImport ? EXERCISE_IMPORT_LABELS.submitting : EXERCISE_IMPORT_LABELS.submitAction}
        </button>
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmittingImport}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50"
        >
          {EXERCISE_IMPORT_LABELS.cancelAction}
        </button>
      </div>
    </form>
  )
}
