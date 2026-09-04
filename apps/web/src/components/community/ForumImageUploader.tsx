/**
 * ForumImageUploader — envoi/remplacement de l'image d'illustration d'un forum, réservé au RP.
 *
 * Lit `GET /forums/image-constraints` avant d'afficher le sélecteur de fichier (même discipline
 * que la photo de profil, 2026-08-10) et remonte le forum à jour à l'appelant, qui possède la
 * donnée — jamais conservée localement.
 */

import React, { useId, useRef } from 'react'
import { useForumImageConstraints } from '../../hooks/community/useForumImageConstraints'
import { useForumImageUpload } from '../../hooks/community/useForumImageUpload'
import { buildForumImageFileInputAccept } from '../../utils/forumImageConstraints'
import { getForumImageFormatsHint, getForumImageMaxSizeHint, FORUM_LABELS } from '../../utils/forumLabels'
import { ErrorMessage } from '../ui/ErrorMessage'
import { ForumThumbnail } from './ForumThumbnail'
import type { Forum } from '../../types/forum'

interface ForumImageUploaderProps {
  forumId: string
  hasImage: boolean
  onUploaded: (updatedForum: Forum) => void
}

export function ForumImageUploader({ forumId, hasImage, onUploaded }: ForumImageUploaderProps) {
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { imageConstraints } = useForumImageConstraints()
  const { isUploadingImage, uploadError, dismissUploadError, uploadImage } =
    useForumImageUpload(forumId)

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''
    if (!selectedFile) return

    const updatedForum = await uploadImage(selectedFile, imageConstraints.maxSizeBytes)
    if (updatedForum) onUploaded(updatedForum)
  }

  return (
    <div className="flex items-start gap-4">
      <ForumThumbnail forumId={forumId} hasImage={hasImage} size="small" />

      <div className="min-w-0">
        <p className="text-sm text-gray-600">
          {getForumImageMaxSizeHint(imageConstraints.maxSizeBytes)}{' '}
          {getForumImageFormatsHint(imageConstraints.allowedMimeTypes)}
        </p>

        <label
          htmlFor={fileInputId}
          className={`mt-2 inline-flex items-center justify-center text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors ${
            isUploadingImage ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          {isUploadingImage
            ? FORUM_LABELS.uploadingImage
            : hasImage
              ? FORUM_LABELS.replaceImage
              : FORUM_LABELS.addImage}
        </label>
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          accept={buildForumImageFileInputAccept(imageConstraints.allowedMimeTypes)}
          className="sr-only"
          disabled={isUploadingImage}
          onChange={handleFileSelected}
        />

        {uploadError && (
          <ErrorMessage message={uploadError} onClose={dismissUploadError} className="mt-3" />
        )}
      </div>
    </div>
  )
}
