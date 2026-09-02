/**
 * useExerciseQuestionParts — blocs de catégorie `question` de plusieurs Exercices, indexés par
 * `exerciseId`. Utilisé par `EvaluationScoringFields` (mode « par question » du barème
 * informatif, arbitrage du 2026-09-02) pour lister les questions référençables.
 *
 * `enabled` évite un chargement inutile tant que la granularité « par question » n'est pas
 * choisie — réutilise `fetchExercise` (aucune route dédiée « questions uniquement » côté
 * serveur).
 */

import { useEffect, useRef, useState } from 'react'
import { fetchExercise } from '../../api/exercises'
import { getErrorMessage } from '../../utils/apiError'
import type { PublicExercisePart } from '../../types/exercise'

export interface UseExerciseQuestionPartsResult {
  partsByExerciseId: Record<string, PublicExercisePart[]>
  isLoading: boolean
  error: string | null
}

export function useExerciseQuestionParts(
  exerciseIds: string[],
  enabled: boolean,
): UseExerciseQuestionPartsResult {
  const [partsByExerciseId, setPartsByExerciseId] = useState<Record<string, PublicExercisePart[]>>(
    {},
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isIgnoredRef = useRef(false)

  const idsKey = exerciseIds.join('|')

  useEffect(() => {
    if (!enabled || exerciseIds.length === 0) {
      setPartsByExerciseId({})
      setIsLoading(false)
      setError(null)
      return
    }

    isIgnoredRef.current = false
    setIsLoading(true)
    setError(null)

    Promise.all(exerciseIds.map((exerciseId) => fetchExercise(exerciseId)))
      .then((exercises) => {
        if (isIgnoredRef.current) return
        const next: Record<string, PublicExercisePart[]> = {}
        exercises.forEach((exercise, index) => {
          next[exerciseIds[index]] = exercise.parts.filter((part) => part.category === 'question')
        })
        setPartsByExerciseId(next)
      })
      .catch((caughtError: unknown) => {
        if (isIgnoredRef.current) return
        setError(
          getErrorMessage(
            caughtError,
            'Impossible de charger les questions des exercices sélectionnés.',
          ),
        )
      })
      .finally(() => {
        if (isIgnoredRef.current) return
        setIsLoading(false)
      })

    return () => {
      isIgnoredRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, enabled])

  return { partsByExerciseId, isLoading, error }
}
