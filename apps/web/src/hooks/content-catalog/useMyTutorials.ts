/**
 * useMyTutorials — "Mes Tutoriels" : tous les tutoriels créés par l'utilisateur courant, tous
 * statuts confondus (`pending_validation`, `validated`, `rejected`). Même patron que
 * `useMyExercises`/`useMyQuizzes` — filtre `authorId` (documenté, comme pour l'Exercice) plutôt
 * qu'un paramètre `mine` non confirmé pour ce type de contenu.
 *
 * Tente d'enrichir chaque tutoriel `rejected` du commentaire de refus via
 * `GET /validations/tutorial/:id/history` — l'échec ne bloque jamais l'affichage de la liste
 * (repli `rejectionCommentStatus: 'unavailable'`).
 */

import { useEffect, useRef, useState } from 'react'
import { fetchTutorialValidationHistory, searchTutorials } from '../../api/tutorials'
import { getErrorMessage } from '../../utils/apiError'
import { useAuth } from '../useAuth'
import type { TutorialSummary } from '../../types/tutorial'

const MY_TUTORIALS_PAGE_LIMIT = 100

export interface MyTutorialListItem extends TutorialSummary {
  rejectionComment?: string | null
  rejectionCommentStatus: 'loaded' | 'loading' | 'unavailable' | 'not_applicable'
}

export function useMyTutorials() {
  const { user } = useAuth()
  const [items, setItems] = useState<MyTutorialListItem[]>([])
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
        const result = await searchTutorials({ authorId: user!.id, limit: MY_TUTORIALS_PAGE_LIMIT })
        if (isIgnoredRef.current) return

        const initialItems: MyTutorialListItem[] = result.items.map((tutorial) => ({
          ...tutorial,
          rejectionCommentStatus: tutorial.status === 'rejected' ? 'loading' : 'not_applicable',
        }))
        setItems(initialItems)
        setIsLoading(false)

        await Promise.all(
          initialItems
            .filter((tutorial) => tutorial.status === 'rejected')
            .map(async (tutorial) => {
              try {
                const history = await fetchTutorialValidationHistory(tutorial.id)
                const lastRejection = [...history]
                  .reverse()
                  .find((entry) => entry.decision === 'rejected')
                if (isIgnoredRef.current) return
                setItems((previous) =>
                  previous.map((item) =>
                    item.id === tutorial.id
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
                    item.id === tutorial.id ? { ...item, rejectionCommentStatus: 'unavailable' } : item,
                  ),
                )
              }
            }),
        )
      } catch (caughtError: unknown) {
        if (isIgnoredRef.current) return
        setError(getErrorMessage(caughtError, 'Impossible de charger vos tutoriels.'))
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
