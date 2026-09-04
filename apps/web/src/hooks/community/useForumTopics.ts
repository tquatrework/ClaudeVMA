/**
 * useForumTopics — liste paginée des sujets d'un forum (`GET /forums/:id/topics`) et création d'un
 * nouveau sujet (`POST /forums/:id/topics`, ouvert à tout membre ayant accès au forum et ayant
 * accepté la charte — pas réservé au RP).
 */

import { useEffect, useState } from 'react'
import { createForumTopic, fetchForumTopics } from '../../api/forumTopics'
import { getErrorMessage, readErrorPayload } from '../../utils/apiError'
import {
  CHARTER_NOT_ACCEPTED_ERROR_CODE,
  FORUM_TOPICS_DEFAULT_LIMIT,
  type CreateForumTopicResponse,
  type ForumTopic,
} from '../../types/forum'
import { FORUM_LABELS } from '../../utils/forumLabels'

export interface UseForumTopicsResult {
  topics: ForumTopic[]
  isLoading: boolean
  loadError: string | null
  page: number
  totalPages: number
  setPage: (nextPage: number) => void
  isCreating: boolean
  createError: string | null
  /** `true` quand le refus de création vient d'une charte non acceptée. */
  charterNotAccepted: boolean
  createTopic: (payload: {
    title: string
    content: string
  }) => Promise<CreateForumTopicResponse | null>
  dismissCreateError: () => void
  refetch: () => void
}

export function useForumTopics(forumId: string | undefined): UseForumTopicsResult {
  const [topics, setTopics] = useState<ForumTopic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [reloadToken, setReloadToken] = useState(0)

  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [charterNotAccepted, setCharterNotAccepted] = useState(false)

  useEffect(() => {
    if (!forumId) return

    let isIgnored = false
    setIsLoading(true)
    setLoadError(null)

    fetchForumTopics(forumId, { page, limit: FORUM_TOPICS_DEFAULT_LIMIT })
      .then((topicsPage) => {
        if (isIgnored) return
        setTopics(topicsPage.data)
        setTotalPages(Math.max(1, topicsPage.totalPages))
      })
      .catch((caughtError: unknown) => {
        if (isIgnored) return
        setLoadError(getErrorMessage(caughtError, FORUM_LABELS.loadTopicsError))
      })
      .finally(() => {
        if (isIgnored) return
        setIsLoading(false)
      })

    return () => {
      isIgnored = true
    }
  }, [forumId, page, reloadToken])

  const createTopic = async (payload: {
    title: string
    content: string
  }): Promise<CreateForumTopicResponse | null> => {
    if (!forumId) return null
    setIsCreating(true)
    setCreateError(null)
    setCharterNotAccepted(false)

    try {
      const createdTopic = await createForumTopic(forumId, payload)
      // La donnée appartient au hook, pas à un composant enfant : insertion directe plutôt que
      // rechargement (règle du chargement du 2026-08-10, point 3). Un sujet créé par un membre
      // n'est pas forcément `validated` (pending_validation par défaut), mais l'auteur doit le voir
      // immédiatement — même logique que le serveur, qui le renvoie déjà à l'appelant.
      setTopics((previous) => [createdTopic, ...previous])
      return createdTopic
    } catch (caughtError: unknown) {
      const payloadError = readErrorPayload(caughtError)
      if (payloadError?.code === CHARTER_NOT_ACCEPTED_ERROR_CODE) {
        setCharterNotAccepted(true)
        return null
      }
      setCreateError(getErrorMessage(caughtError, FORUM_LABELS.createTopicError))
      return null
    } finally {
      setIsCreating(false)
    }
  }

  return {
    topics,
    isLoading,
    loadError,
    page,
    totalPages,
    setPage,
    isCreating,
    createError,
    charterNotAccepted,
    createTopic,
    dismissCreateError: () => {
      setCreateError(null)
      setCharterNotAccepted(false)
    },
    refetch: () => setReloadToken((previous) => previous + 1),
  }
}
