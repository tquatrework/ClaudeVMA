/**
 * TutorialBlockView — rendu en lecture seule d'un bloc de tutoriel (texte ou image), selon sa
 * catégorie. Un bloc `text` est rendu par `TutorialRichTextView` (éditeur riche WYSIWYG, arbitrage
 * du 2026-09-03) — la catégorie `title` a été retirée, fusionnée dans `text` (un titre se compose
 * désormais par la taille de texte/le gras dans l'éditeur riche).
 */

import React from 'react'
import { TutorialBlockImageView } from './TutorialBlockImageView'
import { TutorialRichTextView } from './TutorialRichTextView'
import type { PublicTutorialBlock } from '../../types/tutorial'

interface TutorialBlockViewProps {
  tutorialId: string
  block: PublicTutorialBlock
}

export function TutorialBlockView({ tutorialId, block }: TutorialBlockViewProps) {
  if (block.category === 'image') {
    return <TutorialBlockImageView tutorialId={tutorialId} block={block} />
  }

  return <TutorialRichTextView content={block.content} />
}
