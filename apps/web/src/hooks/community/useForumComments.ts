/**
 * useForumComments — fil de discussion d'un forum : lecture paginée (`GET /forums/:id/comments`,
 * du plus ancien au plus récent), publication (`POST`) et suppression réservée au RP (`DELETE`).
 */

import { useEffect, useState } from 'react'
import {
  createForumComment,
  deleteForumComment,
  fetchForumComments,
} from '../../api/communityPath'
import { getErrorMessage, readErrorPayload } from '../../utils/apiError'
import {
  CHARTER_NOT_ACCEPTED_ERROR_CODE,
  FORUM_COMMENTS_DEFAULT_LIMIT,
  type ForumComment,
} from '../../types/forum'
import { FORUM_LABELS } from '../../utils/forumLabels'

export interface UseForumCommentsResult {
  comments: ForumComment[]
  isLoading: boolean
  loadError: string | null
  page: number
  totalPages: number
  setPage: (nextPage: number) => void
  isPosting: boolean
  postError: string | null
  /** `true` quand le refus de publication vient d'une charte non acceptée — l'appelant redirige
   * alors vers l'écran de lecture/acceptation plutôt que d'afficher une erreur générique. */
  charterNotAccepted: boolean
  postComment: (content: string) => Promise<boolean>
  dismissPostError: () => void
  deletingCommentId: string | null
  deleteError: string | null
  deleteComment: (commentId: string) => Promise<void>
  refetch: () => void
}

export function useForumComments(forumId: string | undefined): UseForumCommentsResult {
  const [comments, setComments] = useState<ForumComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [reloadToken, setReloadToken] = useState(0)

  const [isPosting, setIsPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [charterNotAccepted, setCharterNotAccepted] = useState(false)

  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!forumId) return

    let isIgnored = false
    setIsLoading(true)
    setLoadError(null)

    fetchForumComments(forumId, { page, limit: FORUM_COMMENTS_DEFAULT_LIMIT })
      .then((commentsPage) => {
        if (isIgnored) return
        setComments(commentsPage.data)
        setTotalPages(Math.max(1, commentsPage.totalPages))
      })
      .catch((caughtError: unknown) => {
        if (isIgnored) return
        setLoadError(getErrorMessage(caughtError, FORUM_LABELS.loadCommentsError))
      })
      .finally(() => {
        if (isIgnored) return
        setIsLoading(false)
      })

    return () => {
      isIgnored = true
    }
  }, [forumId, page, reloadToken])

  const postComment = async (content: string): Promise<boolean> => {
    if (!forumId) return false
    setIsPosting(true)
    setPostError(null)
    setCharterNotAccepted(false)

    try {
      const createdComment = await createForumComment(forumId, { content })
      // La donnée appartient au hook, pas à un composant enfant : on l'insère directement plutôt
      // que de recharger la page courante (règle du chargement du 2026-08-10, point 3).
      setComments((previous) => [...previous, createdComment])
      return true
    } catch (caughtError: unknown) {
      const payload = readErrorPayload(caughtError)
      if (payload?.code === CHARTER_NOT_ACCEPTED_ERROR_CODE) {
        setCharterNotAccepted(true)
        return false
      }
      setPostError(getErrorMessage(caughtError, FORUM_LABELS.postCommentError))
      return false
    } finally {
      setIsPosting(false)
    }
  }

  const deleteComment = async (commentId: string): Promise<void> => {
    if (!forumId) return
    setDeletingCommentId(commentId)
    setDeleteError(null)

    try {
      await deleteForumComment(forumId, commentId)
      setComments((previous) => previous.filter((comment) => comment.id !== commentId))
    } catch (caughtError: unknown) {
      setDeleteError(getErrorMessage(caughtError, FORUM_LABELS.deleteCommentError))
    } finally {
      setDeletingCommentId(null)
    }
  }

  return {
    comments,
    isLoading,
    loadError,
    page,
    totalPages,
    setPage,
    isPosting,
    postError,
    charterNotAccepted,
    postComment,
    dismissPostError: () => {
      setPostError(null)
      setCharterNotAccepted(false)
    },
    deletingCommentId,
    deleteError,
    deleteComment,
    refetch: () => setReloadToken((previous) => previous + 1),
  }
}
