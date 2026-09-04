/**
 * useForumDetail — charge le détail d'un forum (`GET /forums/:id`), en distinguant explicitement
 * l'état « introuvable » (404 — forum inexistant ou rôle non autorisé, volontairement indistincts
 * par le serveur, docs/routes.md § « Masquage total ») d'une erreur technique classique.
 *
 * L'appelant doit traiter le cas 404 comme « n'existe pas », jamais afficher un message qui
 * laisserait deviner qu'un forum restreint existe pour un rôle non autorisé.
 */

import { useEffect, useRef, useState } from 'react'
import { fetchForum } from '../../api/forums'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'
import { FORUM_LABELS } from '../../utils/forumLabels'
import type { Forum } from '../../types/forum'

export interface UseForumDetailResult {
  forum: Forum | null
  isLoading: boolean
  /** `true` si le serveur a répondu 404 — forum inexistant ou rôle non autorisé. */
  isNotFound: boolean
  /** Erreur technique distincte du 404 (réseau, 5xx…). */
  error: string | null
  /** Remonte la valeur reçue du serveur au propriétaire de l'état, sans nouvel appel réseau —
   * utilisé après un envoi d'image (`POST /forums/:id/image` renvoie déjà le forum à jour). */
  setForum: (nextForum: Forum) => void
  refetch: () => void
}

export function useForumDetail(forumId: string | undefined): UseForumDetailResult {
  const [forum, setForumState] = useState<Forum | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isNotFound, setIsNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refetchToken, setRefetchToken] = useState(0)
  const forumIdRef = useRef(forumId)
  forumIdRef.current = forumId

  useEffect(() => {
    if (!forumId) {
      setIsLoading(false)
      setIsNotFound(true)
      return
    }

    let isIgnored = false
    setIsLoading(true)
    setError(null)
    setIsNotFound(false)

    fetchForum(forumId)
      .then((loadedForum) => {
        if (isIgnored) return
        setForumState(loadedForum)
      })
      .catch((caughtError: unknown) => {
        if (isIgnored) return
        if (getErrorStatus(caughtError) === 404) {
          setIsNotFound(true)
          setForumState(null)
        } else {
          setError(getErrorMessage(caughtError, FORUM_LABELS.loadError))
        }
      })
      .finally(() => {
        if (isIgnored) return
        setIsLoading(false)
      })

    return () => {
      isIgnored = true
    }
  }, [forumId, refetchToken])

  return {
    forum,
    isLoading,
    isNotFound,
    error,
    setForum: setForumState,
    refetch: () => setRefetchToken((previous) => previous + 1),
  }
}
