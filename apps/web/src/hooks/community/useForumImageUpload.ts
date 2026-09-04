/**
 * useForumImageUpload — envoi/remplacement de l'image d'illustration d'un forum
 * (`POST /forums/:id/image`), réservé au responsable pédagogique (contrôle serveur ; l'appelant
 * ne doit de toute façon proposer le bouton qu'à ce rôle, règle de filtrage UI du projet).
 *
 * Contrôle local de taille avant tout appel réseau, sur les contraintes lues par
 * `useForumImageConstraints` — un fichier trop lourd n'est jamais envoyé.
 */

import { useState } from 'react'
import { uploadForumImage } from '../../api/communityPath'
import { getErrorMessage } from '../../utils/apiError'
import { isForumImageFileTooLarge } from '../../utils/forumImageConstraints'
import { getForumImageMaxSizeHint, FORUM_LABELS } from '../../utils/forumLabels'
import type { Forum } from '../../types/forum'

export interface UseForumImageUploadResult {
  isUploadingImage: boolean
  uploadError: string | null
  dismissUploadError: () => void
  /** Renvoie le forum mis à jour (avec `imageFilename`/`imageMimeType` renseignés) en cas de
   * succès, à remonter au propriétaire de l'état — jamais conservé localement. */
  uploadImage: (file: File, maxSizeBytes: number) => Promise<Forum | null>
}

export function useForumImageUpload(forumId: string | undefined): UseForumImageUploadResult {
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const uploadImage = async (file: File, maxSizeBytes: number): Promise<Forum | null> => {
    if (!forumId) return null

    if (isForumImageFileTooLarge(file, maxSizeBytes)) {
      setUploadError(
        `Le fichier envoyé est trop lourd. ${getForumImageMaxSizeHint(maxSizeBytes)}`,
      )
      return null
    }

    setIsUploadingImage(true)
    setUploadError(null)

    try {
      return await uploadForumImage(forumId, file)
    } catch (caughtError: unknown) {
      setUploadError(getErrorMessage(caughtError, FORUM_LABELS.imageUploadError))
      return null
    } finally {
      setIsUploadingImage(false)
    }
  }

  return {
    isUploadingImage,
    uploadError,
    dismissUploadError: () => setUploadError(null),
    uploadImage,
  }
}
