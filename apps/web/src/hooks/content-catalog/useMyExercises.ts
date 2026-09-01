/**
 * useMyExercises — "Mes Exercices" : tous les exercices créés par l'utilisateur courant, tous
 * statuts confondus (`pending_validation`, `validated`, `rejected`).
 *
 * Contrairement au Quizz (`GET /quizzes?mine=true`), aucun paramètre `mine` n'est documenté pour
 * `GET /exercises` — le filtre `authorId`, lui, est documenté (`docs/routes.md` >
 * content-catalog-service > « Exercices — refonte du 2026-08-29 »). On l'utilise donc avec
 * l'identifiant de l'utilisateur courant plutôt que d'inventer un paramètre non confirmé.
 *
 * Tente d'enrichir chaque exercice `rejected` du commentaire de refus via
 * `GET /validations/exercise/:id/history` — même prudence que `useMyQuizzes` : l'échec ne bloque
 * jamais l'affichage de la liste (repli `rejectionCommentStatus: 'unavailable'`).
 */

import { useEffect, useRef, useState } from 'react'
import { fetchExerciseValidationHistory, searchExercises } from '../../api/exercises'
import { getErrorMessage } from '../../utils/apiError'
import { useAuth } from '../useAuth'
import type { ExerciseSummary } from '../../types/exercise'

const MY_EXERCISES_PAGE_LIMIT = 100

export interface MyExerciseListItem extends ExerciseSummary {
  rejectionComment?: string | null
  rejectionCommentStatus: 'loaded' | 'loading' | 'unavailable' | 'not_applicable'
}

export function useMyExercises() {
  const { user } = useAuth()
  const [items, setItems] = useState<MyExerciseListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchToken, setRefetchToken] = useState(0)
  const isIgnoredRef = useRef(false)

  useEffect(() => {
    if (!user) {
      setIsLoading(false)
      return
    }

    isIgnoredRef.current = false
    setIsLoading(true)
    setError(null)

    async function load() {
      try {
        const result = await searchExercises({ authorId: user!.id, limit: MY_EXERCISES_PAGE_LIMIT })
        if (isIgnoredRef.current) return

        const initialItems: MyExerciseListItem[] = result.items.map((exercise) => ({
          ...exercise,
          rejectionCommentStatus: exercise.status === 'rejected' ? 'loading' : 'not_applicable',
        }))
        setItems(initialItems)
        setIsLoading(false)

        await Promise.all(
          initialItems
            .filter((exercise) => exercise.status === 'rejected')
            .map(async (exercise) => {
              try {
                const history = await fetchExerciseValidationHistory(exercise.id)
                const lastRejection = [...history]
                  .reverse()
                  .find((entry) => entry.decision === 'rejected')
                if (isIgnoredRef.current) return
                setItems((previous) =>
                  previous.map((item) =>
                    item.id === exercise.id
                      ? {
                          ...item,
                          rejectionComment: lastRejection?.comment ?? null,
                          rejectionCommentStatus: 'loaded',
                        }
                      : item,
                  ),
                )
              } catch {
                if (isIgnoredRef.current) return
                setItems((previous) =>
                  previous.map((item) =>
                    item.id === exercise.id ? { ...item, rejectionCommentStatus: 'unavailable' } : item,
                  ),
                )
              }
            }),
        )
      } catch (caughtError: unknown) {
        if (isIgnoredRef.current) return
        setError(getErrorMessage(caughtError, 'Impossible de charger vos exercices.'))
        setIsLoading(false)
      }
    }

    load()

    return () => {
      isIgnoredRef.current = true
    }
  }, [refetchToken, user])

  return {
    items,
    isLoading,
    error,
    refetch: () => setRefetchToken((previous) => previous + 1),
  }
}
