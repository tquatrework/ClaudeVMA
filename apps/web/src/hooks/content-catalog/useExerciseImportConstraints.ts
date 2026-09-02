/**
 * useExerciseImportConstraints — plafond de taille d'import d'Exercice, lu au
 * serveur.
 *
 * `GET /exercises/import/constraints` publie le plafond réellement appliqué. Le
 * front le lit **avant** d'ouvrir le sélecteur de fichier, pour :
 * 1. l'**annoncer** à l'utilisateur, avant qu'il ne choisisse un fichier ;
 * 2. **refuser localement** un fichier trop lourd, sans le faire transiter.
 *
 * Même patron que `useQuizImportConstraints`.
 */

import { useEffect, useState } from 'react'
import { fetchExerciseImportConstraints } from '../../api/exerciseImport'
import {
  FALLBACK_EXERCISE_IMPORT_CONSTRAINTS,
  normalizeExerciseImportConstraints,
} from '../../utils/exerciseImport'
import type { ExerciseImportConstraints } from '../../types/exercise'

export interface UseExerciseImportConstraintsResult {
  /** Toujours exploitable : valeurs du serveur, ou repli. Jamais `null`. */
  importConstraints: ExerciseImportConstraints
  isLoadingImportConstraints: boolean
}

/**
 * @param isEnabled `false` pour un lecteur qui ne peut pas importer d'Exercice :
 *   inutile d'appeler le serveur pour une contrainte qu'il ne lira jamais.
 */
export function useExerciseImportConstraints(isEnabled = true): UseExerciseImportConstraintsResult {
  const [importConstraints, setImportConstraints] = useState<ExerciseImportConstraints>(
    FALLBACK_EXERCISE_IMPORT_CONSTRAINTS,
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
        const serverConstraints = await fetchExerciseImportConstraints()
        if (isCancelled) return
        setImportConstraints(normalizeExerciseImportConstraints(serverConstraints))
      } catch (caughtError) {
        // Panne à journaliser pour le développeur, jamais un message de plus à
        // l'écran : l'utilisateur voit la limite de repli et peut agir.
        if (!isCancelled) {
          console.warn('[exercise-import] contraintes d’envoi illisibles :', caughtError)
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
