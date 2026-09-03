/**
 * TutorialBlockView — rendu en lecture seule d'un bloc de tutoriel (titre, texte ou image), selon
 * sa catégorie. Même patron que `ExerciseContentItemView`.
 */

import React from 'react'
import { LightMarkupText } from '../ui/LightMarkupText'
import { TutorialBlockImageView } from './TutorialBlockImageView'
import type { PublicTutorialBlock } from '../../types/tutorial'

interface TutorialBlockViewProps {
  tutorialId: string
  block: PublicTutorialBlock
}

export function TutorialBlockView({ tutorialId, block }: TutorialBlockViewProps) {
  if (block.category === 'image') {
    return <TutorialBlockImageView tutorialId={tutorialId} block={block} />
  }

  if (block.category === 'title') {
    return (
      <h3 className="text-base font-semibold text-gray-900">
        <LightMarkupText text={block.content ?? ''} />
      </h3>
    )
  }

  return (
    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
      <LightMarkupText text={block.content ?? ''} />
    </p>
  )
}
