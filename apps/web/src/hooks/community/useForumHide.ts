/**
 * useForumHide — masque un forum (`POST /forums/:id/hide`), réservé au responsable pédagogique
 * côté serveur. Ce hook ne décide jamais qui a le droit d'appeler l'action : c'est à l'appelant
 * (page) de ne proposer le bouton qu'au RP, le serveur restant l'arbitre final (403 sinon).
 */

import { useState } from 'react'
import { hideForum } from '../../api/forums'
import { getErrorMessage } from '../../utils/apiError'
import { FORUM_LABELS } from '../../utils/forumLabels'
import type { Forum } from '../../types/forum'

export interface UseForumHideResult {
  isHiding: boolean
  hideError: string | null
  /** Renvoie le forum à jour (`isHidden: true`) en cas de succès, `null` en cas d'échec — l'appelant
   * remonte la valeur reçue du serveur à l'état propriétaire de la page (règle du 2026-08-10). */
  hide: (forumId: string) => Promise<Forum | null>
}

export function useForumHide(): UseForumHideResult {
  const [isHiding, setIsHiding] = useState(false)
  const [hideError, setHideError] = useState<string | null>(null)

  const hide = async (forumId: string): Promise<Forum | null> => {
    setIsHiding(true)
    setHideError(null)
    try {
      return await hideForum(forumId)
    } catch (caughtError: unknown) {
      setHideError(getErrorMessage(caughtError, FORUM_LABELS.hideForumError))
      return null
    } finally {
      setIsHiding(false)
    }
  }

  return { isHiding, hideError, hide }
}
