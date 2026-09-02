/**
 * useExerciseImport — sélection, envoi et compte-rendu d'un import d'Exercices
 * depuis un fichier CSV/Excel (`docs/architecture.md` > « Import d'Exercice
 * depuis un tableur »).
 *
 * Le contrat serveur ne porte pas le titre de l'Exercice créé (seul
 * `exerciseId`) : ce hook le relit via `GET /exercises/:id` (`fetchExercise`,
 * déjà accessible à l'auteur quel que soit le statut de validation) pour que
 * l'écran de résultat affiche un titre plutôt qu'un id technique — l'échec de
 * cette relecture n'invalide jamais la création déjà confirmée par le serveur
 * (`status: 'created'`). Même patron que `useQuizImport`.
 */

import { useCallback, useState } from 'react'
import { fetchExercise } from '../../api/exercises'
import { importExercises } from '../../api/exerciseImport'
import {
  getExerciseImportTooLargeMessage,
  getExerciseImportUploadErrorMessage,
  getExerciseImportWrongExtensionMessage,
  hasAcceptedExerciseImportExtension,
  isExerciseImportFileTooLarge,
} from '../../utils/exerciseImport'
import { useExerciseImportConstraints } from './useExerciseImportConstraints'
import type { ExerciseImportBlockResult, ExerciseImportConstraints } from '../../types/exercise'

/** Un résultat de bloc, enrichi du titre de l'Exercice créé (absent du contrat serveur). */
export interface ExerciseImportBlockResultWithTitle extends ExerciseImportBlockResult {
  title: string | null
}

export interface UseExerciseImportResult {
  importConstraints: ExerciseImportConstraints
  isLoadingImportConstraints: boolean
  selectedFile: File | null
  /** Validation locale (extension, taille) — `null` si le fichier choisi est acceptable. */
  selectionError: string | null
  selectFile: (file: File | null) => void
  submitImport: () => Promise<void>
  isSubmittingImport: boolean
  submitError: string | null
  results: ExerciseImportBlockResultWithTitle[] | null
  reset: () => void
}

export function useExerciseImport(): UseExerciseImportResult {
  const { importConstraints, isLoadingImportConstraints } = useExerciseImportConstraints()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [isSubmittingImport, setIsSubmittingImport] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [results, setResults] = useState<ExerciseImportBlockResultWithTitle[] | null>(null)

  const selectFile = useCallback(
    (file: File | null) => {
      setSubmitError(null)
      setResults(null)

      if (!file) {
        setSelectedFile(null)
        setSelectionError(null)
        return
      }

      // Refus local, sans partir sur le réseau : mêmes deux contrôles que
      // l'avatar (extension, puis taille), avant tout envoi.
      if (!hasAcceptedExerciseImportExtension(file.name)) {
        setSelectedFile(null)
        setSelectionError(getExerciseImportWrongExtensionMessage(file.name))
        return
      }

      if (isExerciseImportFileTooLarge(file, importConstraints.maxFileSizeBytes)) {
        setSelectedFile(null)
        setSelectionError(
          getExerciseImportTooLargeMessage(file.size, importConstraints.maxFileSizeBytes),
        )
        return
      }

      setSelectedFile(file)
      setSelectionError(null)
    },
    [importConstraints.maxFileSizeBytes],
  )

  const submitImport = useCallback(async () => {
    if (!selectedFile) return

    setIsSubmittingImport(true)
    setSubmitError(null)

    try {
      const blockResults = await importExercises(selectedFile)

      const enrichedResults = await Promise.all(
        blockResults.map(async (block): Promise<ExerciseImportBlockResultWithTitle> => {
          if (block.status !== 'created' || !block.exerciseId) {
            return { ...block, title: null }
          }
          try {
            const createdExercise = await fetchExercise(block.exerciseId)
            return { ...block, title: createdExercise.title }
          } catch {
            // L'exercice a bien été créé (le serveur l'a confirmé) : un échec de
            // relecture du titre n'invalide jamais cette création.
            return { ...block, title: null }
          }
        }),
      )

      setResults(enrichedResults)
      setSelectedFile(null)
    } catch (caughtError: unknown) {
      setSubmitError(
        getExerciseImportUploadErrorMessage(caughtError, {
          maxFileSizeBytes: importConstraints.maxFileSizeBytes,
          attemptedFileSizeBytes: selectedFile.size,
        }),
      )
    } finally {
      setIsSubmittingImport(false)
    }
  }, [selectedFile, importConstraints.maxFileSizeBytes])

  const reset = useCallback(() => {
    setSelectedFile(null)
    setSelectionError(null)
    setSubmitError(null)
    setResults(null)
  }, [])

  return {
    importConstraints,
    isLoadingImportConstraints,
    selectedFile,
    selectionError,
    selectFile,
    submitImport,
    isSubmittingImport,
    submitError,
    results,
    reset,
  }
}
