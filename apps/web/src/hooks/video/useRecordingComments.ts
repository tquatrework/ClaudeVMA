import { useCallback, useState } from 'react'
import { addRecordingComment } from '../../api/video'
import type { RecordingComment } from '../../types/video'

export interface UseRecordingCommentsResult {
  comments: RecordingComment[]
  timestampSeconds: number
  setTimestampSeconds: (value: number) => void
  content: string
  setContent: (value: string) => void
  isSubmitting: boolean
  error: string | null
  /** POST /recordings/:recordingId/comments puis ajout local du commentaire à la liste affichée. */
  submitComment: () => Promise<boolean>
}

/**
 * useRecordingComments — orchestration de RecordingCommentTimeline. Reproduit le comportement
 * préexistant : le commentaire ajouté à la liste locale est reconstruit côté client (id
 * `local-<timestamp>`, `createdAt` local) plutôt que dérivé de la réponse serveur — il n'existe
 * pas de route de lecture des commentaires dans docs/routes.md, seule la création est exposée.
 * Le message d'erreur est fixe quel que soit le détail de l'échec, comme dans le composant
 * d'origine.
 */
export function useRecordingComments(recordingId: string): UseRecordingCommentsResult {
  const [comments, setComments] = useState<RecordingComment[]>([])
  const [timestampSeconds, setTimestampSeconds] = useState(0)
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitComment = useCallback(async (): Promise<boolean> => {
    if (!content.trim()) return false

    setIsSubmitting(true)
    setError(null)
    try {
      await addRecordingComment(recordingId, {
        timestampSeconds,
        content: content.trim(),
      })
      const newComment: RecordingComment = {
        id: `local-${Date.now()}`,
        timestampSeconds,
        content: content.trim(),
        createdAt: new Date().toISOString(),
      }
      setComments((previous) => [...previous, newComment])
      setContent('')
      setTimestampSeconds(0)
      return true
    } catch {
      setError("Impossible d'envoyer le commentaire")
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [recordingId, timestampSeconds, content])

  return {
    comments,
    timestampSeconds,
    setTimestampSeconds,
    content,
    setContent,
    isSubmitting,
    error,
    submitComment,
  }
}
