/**
 * useQuizImportConstraints — plafond de taille d'import de Quizz, lu au serveur.
 *
 * `GET /quizzes/import/constraints` publie le plafond réellement appliqué. Le
 * front le lit **avant** d'ouvrir le sélecteur de fichier, pour :
 * 1. l'**annoncer** à l'utilisateur, avant qu'il ne choisisse un fichier ;
 * 2. **refuser localement** un fichier trop lourd, sans le faire transiter.
 *
 * Même patron que `useProfileAvatarConstraints` (`src/hooks/profile/`).
 */

import { useEffect, useState } from 'react'
import { fetchQuizImportConstraints } from '../../api/quizImport'
import {
  FALLBACK_QUIZ_IMPORT_CONSTRAINTS,
  normalizeQuizImportConstraints,
} from '../../utils/quizImport'
import type { QuizImportConstraints } from '../../types/quiz'

export interface UseQuizImportConstraintsResult {
  /** Toujours exploitable : valeurs du serveur, ou repli. Jamais `null`. */
  importConstraints: QuizImportConstraints
  isLoadingImportConstraints: boolean
}

/**
 * @param isEnabled `false` pour un lecteur qui ne peut pas importer de Quizz :
 *   inutile d'appeler le serveur pour une contrainte qu'il ne lira jamais.
 */
export function useQuizImportConstraints(isEnabled = true): UseQuizImportConstraintsResult {
  const [importConstraints, setImportConstraints] = useState<QuizImportConstraints>(
    FALLBACK_QUIZ_IMPORT_CONSTRAINTS,
  )
  const [isLoadingImportConstraints, setIsLoadingImportConstraints] = useState(isEnabled)

  useEffect(() => {
    if (!isEnabled) {
      setIsLoadingImportConstraints(false)
      return
    }

    let isCancelled = false
    setIsLoadingImportConstraints(true)

    const loadConstraints = async () => {
      try {
        const serverConstraints = await fetchQuizImportConstraints()
        if (isCancelled) return
        setImportConstraints(normalizeQuizImportConstraints(serverConstraints))
      } catch (caughtError) {
        // Panne à journaliser pour le développeur, jamais un message de plus à
        // l'écran : l'utilisateur voit la limite de repli et peut agir.
        if (!isCancelled) {
          console.warn('[quiz-import] contraintes d’envoi illisibles :', caughtError)
        }
      } finally {
        if (!isCancelled) setIsLoadingImportConstraints(false)
      }
    }

    void loadConstraints()

    return () => {
      isCancelled = true
    }
  }, [isEnabled])

  return { importConstraints, isLoadingImportConstraints }
}
