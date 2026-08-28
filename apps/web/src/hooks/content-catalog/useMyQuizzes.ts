/**
 * useMyQuizzes — "Mes Quizz" : tous les quizz créés par l'utilisateur courant, tous statuts
 * confondus (`pending_validation`, `validated`, `rejected`) — retour post-production du
 * 2026-08-28 (`docs/architecture.md` > « Edition d'un Quizz par son auteur »).
 * `GET /quizzes?mine=true` **confirmé** en HTTP direct le 2026-08-28.
 *
 * Tente d'enrichir chaque quizz `rejected` du commentaire de refus via
 * `GET /validations/quiz/:id/history` — **vérifié en HTTP direct le 2026-08-28 : cette route
 * fonctionne pour RP/AP mais renvoie `403` à l'auteur formateur**. Un professeur qui consulte ses
 * propres quizz refusés n'aura donc **jamais** le commentaire par cette voie (blocage réel,
 * signalé au rapport de session — le serveur devrait soit l'autoriser à l'auteur, soit exposer le
 * commentaire directement sur `GET /quizzes?mine=true`). L'appel reste tenté (utile si
 * l'appelant est aussi RP/AP) et son échec ne bloque jamais l'affichage de la liste — le quizz
 * reste visible sans son commentaire (`rejectionCommentStatus: 'unavailable'`).
 */

import { useEffect, useRef, useState } from 'react'
import { fetchQuizValidationHistory, searchQuizzes } from '../../api/quizzes'
import { getErrorMessage } from '../../utils/apiError'
import type { QuizSummary } from '../../types/quiz'

const MY_QUIZZES_PAGE_LIMIT = 100

export interface MyQuizListItem extends QuizSummary {
  /** Commentaire du dernier rejet, résolu au mieux — voir l'en-tête du fichier. */
  rejectionComment?: string | null
  rejectionCommentStatus: 'loaded' | 'loading' | 'unavailable' | 'not_applicable'
}

export function useMyQuizzes() {
  const [items, setItems] = useState<MyQuizListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchToken, setRefetchToken] = useState(0)
  const isIgnoredRef = useRef(false)

  useEffect(() => {
    isIgnoredRef.current = false
    setIsLoading(true)
    setError(null)

    async function load() {
      try {
        const result = await searchQuizzes({ mine: true, limit: MY_QUIZZES_PAGE_LIMIT })
        if (isIgnoredRef.current) return

        const initialItems: MyQuizListItem[] = result.items.map((quiz) => ({
          ...quiz,
          rejectionCommentStatus: quiz.status === 'rejected' ? 'loading' : 'not_applicable',
        }))
        setItems(initialItems)
        setIsLoading(false)

        await Promise.all(
          initialItems
            .filter((quiz) => quiz.status === 'rejected')
            .map(async (quiz) => {
              try {
                const history = await fetchQuizValidationHistory(quiz.id)
                const lastRejection = [...history]
                  .reverse()
                  .find((entry) => entry.decision === 'rejected')
                if (isIgnoredRef.current) return
                setItems((previous) =>
                  previous.map((item) =>
                    item.id === quiz.id
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
                    item.id === quiz.id ? { ...item, rejectionCommentStatus: 'unavailable' } : item,
                  ),
                )
              }
            }),
        )
      } catch (caughtError: unknown) {
        if (isIgnoredRef.current) return
        setError(getErrorMessage(caughtError, 'Impossible de charger vos quizz.'))
        setIsLoading(false)
      }
    }

    load()

    return () => {
      isIgnoredRef.current = true
    }
  }, [refetchToken])

  return {
    items,
    isLoading,
    error,
    refetch: () => setRefetchToken((previous) => previous + 1),
  }
}
