/**
 * TutorialBlocksSection — séquence de blocs (texte/image) du formulaire Tutoriel au format
 * « post ». Extrait de `TutorialForm` pour rester sous le seuil de 300 lignes du fichier de page
 * (règle du projet) — même découpage que `ExercisePartAddButtons`/`ExercisePartEditor` pour
 * l'Exercice.
 */

import React from 'react'
import { TutorialBlockEditor, createEditableTutorialBlock, type EditableTutorialBlock } from './TutorialBlockEditor'

interface TutorialBlocksSectionProps {
  blocks: EditableTutorialBlock[]
  onBlocksChange: (blocks: EditableTutorialBlock[]) => void
  isSubmitting: boolean
  /** Requis pour afficher une image de bloc déjà enregistrée — absent en mode création. */
  tutorialId?: string
  maxImageInputBytes: number
}

export function TutorialBlocksSection({
  blocks,
  onBlocksChange,
  isSubmitting,
  tutorialId,
  maxImageInputBytes,
}: TutorialBlocksSectionProps) {
  const updateBlock = (localId: string, updated: EditableTutorialBlock) => {
    onBlocksChange(blocks.map((b) => (b.localId === localId ? updated : b)))
  }

  const removeBlock = (localId: string) => {
    onBlocksChange(blocks.filter((b) => b.localId !== localId))
  }

  const moveBlock = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= blocks.length) return
    const reordered = [...blocks]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    onBlocksChange(reordered)
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">Blocs (texte et images)</h3>
      {blocks.map((block, index) => (
        <TutorialBlockEditor
          key={block.localId}
          index={index}
          block={block}
          isSubmitting={isSubmitting}
          onChange={(updated) => updateBlock(block.localId, updated)}
          onRemove={() => removeBlock(block.localId)}
          onMoveUp={() => moveBlock(index, -1)}
          onMoveDown={() => moveBlock(index, 1)}
          isFirst={index === 0}
          isLast={index === blocks.length - 1}
          tutorialId={tutorialId}
          maxImageInputBytes={maxImageInputBytes}
        />
      ))}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onBlocksChange([...blocks, createEditableTutorialBlock('text')])}
          disabled={isSubmitting}
          className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          + Ajouter du texte
        </button>
        <button
          type="button"
          onClick={() => onBlocksChange([...blocks, createEditableTutorialBlock('image')])}
          disabled={isSubmitting}
          className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          + Ajouter une image
        </button>
      </div>
    </div>
  )
}
