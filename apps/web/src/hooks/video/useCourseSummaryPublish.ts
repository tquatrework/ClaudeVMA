import { useCallback, useState } from 'react'
import { publishCourseSummary } from '../../api/video'

export interface UseCourseSummaryPublishResult {
  isSubmitting: boolean
  isPublished: boolean
  error: string | null
  publish: (content: string) => Promise<void>
}

/**
 * useCourseSummaryPublish — orchestration de CourseSummaryView : publication du résumé de cours
 * (POST /video/rooms/:roomId/summary, VID-AC-002). Reproduit le comportement préexistant : un
 * message d'erreur fixe est affiché quel que soit le détail de l'échec (le composant original ne
 * distinguait pas les statuts HTTP).
 */
export function useCourseSummaryPublish(roomId: string): UseCourseSummaryPublishResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const publish = useCallback(
    async (content: string) => {
      setIsSubmitting(true)
      setError(null)
      try {
        await publishCourseSummary(roomId, content)
        setIsPublished(true)
      } catch {
        setError('Impossible de publier le résumé')
      } finally {
        setIsSubmitting(false)
      }
    },
    [roomId],
  )

  return { isSubmitting, isPublished, error, publish }
}
