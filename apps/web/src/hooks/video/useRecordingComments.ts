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
  /**
   * POST /recordings/:recordingId/comments, puis ajout à la liste affichée du commentaire
   * **tel que le serveur l'a enregistré**.
   */
  submitComment: () => Promise<boolean>
}

/**
 * useRecordingComments — orchestration de RecordingCommentTimeline.
 *
 * Le commentaire ajouté à la liste est celui que le serveur renvoie
 * (`201 {id, recordingId, userId, timestampSeconds, content, createdAt}`, `docs/routes.md`).
 * Il était jusqu'au 2026-08-10 **reconstruit côté client** — identifiant `local-<horodatage>` et
 * `createdAt` pris sur l'horloge du navigateur —, c'est-à-dire que l'écran affichait ce qu'on
 * avait envoyé et non ce qui avait été enregistré. Même famille de défaut que les champs de
 * profil corrigés le même jour, et aucune route de lecture n'existe pour rattraper l'écart au
 * rechargement.
 *
 * Le message d'erreur reste fixe quel que soit le détail de l'échec, comme dans le composant
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
      const savedComment = await addRecordingComment(recordingId, {
        timestampSeconds,
        content: content.trim(),
      })
      setComments((previous) => [...previous, savedComment])
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
