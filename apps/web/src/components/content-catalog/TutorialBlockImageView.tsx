/**
 * TutorialBlockImageView — rendu en lecture seule d'un bloc image de tutoriel (déjà enregistré).
 * Même patron que `ExerciseContentItemView`/`ExercisePartImage`.
 */

import React from 'react'
import { useTutorialBlockImageUrl } from '../../hooks/content-catalog/useTutorialBlockImageUrl'
import type { PublicTutorialBlock } from '../../types/tutorial'

interface TutorialBlockImageViewProps {
  tutorialId: string
  block: PublicTutorialBlock
}

export function TutorialBlockImageView({ tutorialId, block }: TutorialBlockImageViewProps) {
  const { imageUrl, isLoading, error } = useTutorialBlockImageUrl(tutorialId, block.id)

  if (isLoading) {
    return <p className="text-xs text-gray-400">Chargement de l'image…</p>
  }

  if (error || !imageUrl) {
    return <p className="text-xs text-red-500">{error ?? "Cette image n'a pas pu être affichée."}</p>
  }

  return (
    <figure>
      <img
        src={imageUrl}
        alt={block.content ?? 'Image'}
        className="max-w-full rounded-lg border border-gray-200"
      />
      {block.content && <figcaption className="text-xs text-gray-500 mt-1">{block.content}</figcaption>}
    </figure>
  )
}
