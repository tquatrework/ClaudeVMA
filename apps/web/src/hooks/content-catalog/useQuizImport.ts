/**
 * useQuizImport — sélection, envoi et compte-rendu d'un import de Quizz depuis
 * un fichier CSV/Excel (`docs/architecture.md` > « Import de Quizz depuis un
 * tableur »).
 *
 * Le contrat serveur ne porte pas le titre du Quizz créé (seul `quizId`,
 * `docs/architecture.md` point 3) : ce hook le relit via `GET /quizzes/:id`
 * (`fetchQuiz`, déjà accessible à l'auteur quel que soit le statut de
 * validation) pour que l'écran de résultat affiche un titre plutôt qu'un id
 * technique — l'échec de cette relecture n'invalide jamais la création déjà
 * confirmée par le serveur (`status: 'created'`).
 */

import { useCallback, useState } from 'react'
import { fetchQuiz } from '../../api/quizzes'
import { importQuizzes } from '../../api/quizImport'
import {
  getQuizImportTooLargeMessage,
  getQuizImportUploadErrorMessage,
  getQuizImportWrongExtensionMessage,
  hasAcceptedQuizImportExtension,
  isQuizImportFileTooLarge,
} from '../../utils/quizImport'
import { useQuizImportConstraints } from './useQuizImportConstraints'
import type { QuizImportBlockResult, QuizImportConstraints } from '../../types/quiz'

/** Un résultat de bloc, enrichi du titre du Quizz créé (absent du contrat serveur). */
export interface QuizImportBlockResultWithTitle extends QuizImportBlockResult {
  title: string | null
}

export interface UseQuizImportResult {
  importConstraints: QuizImportConstraints
  isLoadingImportConstraints: boolean
  selectedFile: File | null
  /** Validation locale (extension, taille) — `null` si le fichier choisi est acceptable. */
  selectionError: string | null
  selectFile: (file: File | null) => void
  submitImport: () => Promise<void>
  isSubmittingImport: boolean
  submitError: string | null
  results: QuizImportBlockResultWithTitle[] | null
  reset: () => void
}

export function useQuizImport(): UseQuizImportResult {
  const { importConstraints, isLoadingImportConstraints } = useQuizImportConstraints()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [isSubmittingImport, setIsSubmittingImport] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [results, setResults] = useState<QuizImportBlockResultWithTitle[] | null>(null)

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
      if (!hasAcceptedQuizImportExtension(file.name)) {
        setSelectedFile(null)
        setSelectionError(getQuizImportWrongExtensionMessage(file.name))
        return
      }

      if (isQuizImportFileTooLarge(file, importConstraints.maxFileSizeBytes)) {
        setSelectedFile(null)
        setSelectionError(
          getQuizImportTooLargeMessage(file.size, importConstraints.maxFileSizeBytes),
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
      const blockResults = await importQuizzes(selectedFile)

      const enrichedResults = await Promise.all(
        blockResults.map(async (block): Promise<QuizImportBlockResultWithTitle> => {
          if (block.status !== 'created' || !block.quizId) {
            return { ...block, title: null }
          }
          try {
            const createdQuiz = await fetchQuiz(block.quizId)
            return { ...block, title: createdQuiz.title }
          } catch {
            // Le Quizz a bien été créé (le serveur l'a confirmé) : un échec de
            // relecture du titre n'invalide jamais cette création.
            return { ...block, title: null }
          }
        }),
      )

      setResults(enrichedResults)
      setSelectedFile(null)
    } catch (caughtError: unknown) {
      setSubmitError(
        getQuizImportUploadErrorMessage(caughtError, {
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
