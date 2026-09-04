/**
 * ForumThumbnail — vignette d'illustration d'un forum, en lecture seule.
 *
 * Utilisée à la fois dans la carte de liste (petit format) et l'en-tête du détail (grand format).
 * Retombe silencieusement sur un pictogramme neutre si le forum n'a pas d'image, ou si sa lecture
 * échoue (masquage — voir `useForumImage`).
 */

import React from 'react'
import { useForumImage } from '../../hooks/community/useForumImage'

interface ForumThumbnailProps {
  forumId: string
  hasImage: boolean
  size?: 'small' | 'large'
}

const SIZE_CLASSES: Record<NonNullable<ForumThumbnailProps['size']>, string> = {
  small: 'w-14 h-14 rounded-lg',
  large: 'w-full h-40 rounded-xl',
}

export function ForumThumbnail({ forumId, hasImage, size = 'small' }: ForumThumbnailProps) {
  const { imageObjectUrl } = useForumImage(forumId, hasImage)

  return (
    <div
      className={`shrink-0 overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center ${SIZE_CLASSES[size]}`}
    >
      {imageObjectUrl ? (
        <img src={imageObjectUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-gray-300" aria-hidden="true">
          💬
        </span>
      )}
    </div>
  )
}
