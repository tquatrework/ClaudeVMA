/**
 * useForumTopicDetail — charge le détail d'un sujet (`GET /forums/:id/topics/:topicId`), en
 * distinguant explicitement l'état « introuvable » (404 — sujet inexistant ou non visible à
 * l'appelant, volontairement indistincts par le serveur) d'une erreur technique classique, et
 * porte l'action de validation/refus réservée au RP
 * (`POST /forums/:id/topics/:topicId/decision`).
 */

import { useEffect, useRef, useState } from 'react'
import { decideForumTopic, fetchForumTopic } from '../../api/forumTopics'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'
import { FORUM_LABELS } from '../../utils/forumLabels'
import type { ForumTopic } from '../../types/forum'

export interface UseForumTopicDetailResult {
  topic: ForumTopic | null
  isLoading: boolean
  /** `true` si le serveur a répondu 404 — sujet inexistant ou non visible à l'appelant. */
  isNotFound: boolean
  error: string | null
  /** Remonte la valeur reçue du serveur au propriétaire de l'état, sans nouvel appel réseau. */
  setTopic: (nextTopic: ForumTopic) => void
  isDeciding: boolean
  decideError: string | null
  decide: (decision: 'validated' | 'rejected', reason?: string) => Promise<boolean>
  refetch: () => void
}

export function useForumTopicDetail(
  forumId: string | undefined,
  topicId: string | undefined,
): UseForumTopicDetailResult {
  const [topic, setTopicState] = useState<ForumTopic | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isNotFound, setIsNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refetchToken, setRefetchToken] = useState(0)
  const [isDeciding, setIsDeciding] = useState(false)
  const [decideError, setDecideError] = useState<string | null>(null)

  const idsRef = useRef({ forumId, topicId })
  idsRef.current = { forumId, topicId }

  useEffect(() => {
    if (!forumId || !topicId) {
      setIsLoading(false)
      setIsNotFound(true)
      return
    }

    let isIgnored = false
    setIsLoading(true)
    setError(null)
    setIsNotFound(false)

    fetchForumTopic(forumId, topicId)
      .then((loadedTopic) => {
        if (isIgnored) return
        setTopicState(loadedTopic)
      })
      .catch((caughtError: unknown) => {
        if (isIgnored) return
        if (getErrorStatus(caughtError) === 404) {
          setIsNotFound(true)
          setTopicState(null)
        } else {
          setError(getErrorMessage(caughtError, FORUM_LABELS.loadTopicError))
        }
      })
      .finally(() => {
        if (isIgnored) return
        setIsLoading(false)
      })

    return () => {
      isIgnored = true
    }
  }, [forumId, topicId, refetchToken])

  const decide = async (decision: 'validated' | 'rejected', reason?: string): Promise<boolean> => {
    const { forumId: currentForumId, topicId: currentTopicId } = idsRef.current
    if (!currentForumId || !currentTopicId) return false

    setIsDeciding(true)
    setDecideError(null)
    try {
      const updatedTopic = await decideForumTopic(currentForumId, currentTopicId, {
        decision,
        reason,
      })
      setTopicState(updatedTopic)
      return true
    } catch (caughtError: unknown) {
      setDecideError(getErrorMessage(caughtError, FORUM_LABELS.decideTopicError))
      return false
    } finally {
      setIsDeciding(false)
    }
  }

  return {
    topic,
    isLoading,
    isNotFound,
    error,
    setTopic: setTopicState,
    isDeciding,
    decideError,
    decide,
    refetch: () => setRefetchToken((previous) => previous + 1),
  }
}
