/**
 * TutorialBlockEditor — édition d'un bloc de Tutoriel au format « post » (titre, texte ou image),
 * au sein de `TutorialForm`. Un bloc EST directement son contenu (pas d'items imbriqués comme
 * l'Exercice) : titre/texte portent un texte brut (syntaxe légère `$...$`/`[label](url)`, même
 * aide de saisie que Quizz/Exercice — `InsertFormulaButton`), un bloc image porte un fichier
 * choisi localement, encodé en base64 et embarqué dans le payload à la soumission du formulaire
 * (voir `TutorialForm`/`utils/tutorialImageResolution.ts`).
 */

import React, { useEffect, useRef, useState } from 'react'
import { InsertFormulaButton } from '../ui/InsertFormulaButton'
import { LightMarkupText } from '../ui/LightMarkupText'
import { TutorialBlockImageView } from './TutorialBlockImageView'
import {
  getTutorialImageMaxSizeHint,
  getTutorialImageTooLargeMessage,
  isTutorialImageFileTooLarge,
} from '../../utils/tutorialImageConstraints'
import { TUTORIAL_BLOCK_CATEGORY_LABELS } from '../../utils/tutorialLabels'
import type { PublicTutorialBlock, TutorialBlockCategory } from '../../types/tutorial'

export interface EditableTutorialBlock {
  localId: string
  category: TutorialBlockCategory
  /** Utilisé pour `category === 'title'|'text'`. */
  content: string
  /** Utilisé uniquement si `category === 'image'` — fichier choisi localement, pas encore envoyé. */
  imageFile: File | null
  /**
   * Utilisé uniquement si `category === 'image'`, en édition — bloc déjà enregistré côté serveur,
   * affiché tant qu'aucun nouveau fichier n'a été choisi.
   */
  existingImageBlock: PublicTutorialBlock | null
}

let blockCounter = 0
export function createEditableTutorialBlock(
  category: TutorialBlockCategory = 'text',
): EditableTutorialBlock {
  blockCounter += 1
  return {
    localId: `tuto-block-${blockCounter}`,
    category,
    content: '',
    imageFile: null,
    existingImageBlock: null,
  }
}

interface TutorialBlockEditorProps {
  index: number
  block: EditableTutorialBlock
  isSubmitting: boolean
  onChange: (updated: EditableTutorialBlock) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
  /** Requis pour afficher une image de bloc déjà enregistrée — absent en mode création. */
  tutorialId?: string
  /** Plafond en vigueur pour un bloc image (`GET /tutorials/image-constraints`). */
  maxImageInputBytes: number
}

export function TutorialBlockEditor({
  index,
  block,
  isSubmitting,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  tutorialId,
  maxImageInputBytes,
}: TutorialBlockEditorProps) {
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  return (
    <div className="border border-gray-300 rounded-lg p-4 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-800">
          Bloc {index + 1} — {TUTORIAL_BLOCK_CATEGORY_LABELS[block.category]}
        </p>
        <div className="flex items-center gap-2">
          <select
            value={block.category}
            onChange={(e) =>
              onChange({
                ...block,
                category: e.target.value as TutorialBlockCategory,
              })
            }
            disabled={isSubmitting}
            className="border border-gray-300 rounded-md px-2 py-1 text-xs bg-white"
          >
            <option value="title">Titre</option>
            <option value="text">Texte</option>
            <option value="image">Image</option>
          </select>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isSubmitting || isFirst}
            className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
            aria-label={`Déplacer le bloc ${index + 1} vers le haut`}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isSubmitting || isLast}
            className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
            aria-label={`Déplacer le bloc ${index + 1} vers le bas`}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={isSubmitting}
            className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            Supprimer le bloc
          </button>
        </div>
      </div>

      {block.category === 'image' ? (
        <TutorialImageBlockField
          tutorialId={tutorialId}
          imageFile={block.imageFile}
          existingImageBlock={block.existingImageBlock}
          onFileSelected={(imageFile) => onChange({ ...block, imageFile })}
          isSubmitting={isSubmitting}
          maxImageInputBytes={maxImageInputBytes}
        />
      ) : (
        <div className="space-y-2">
          <textarea
            ref={fieldRef}
            value={block.content}
            onChange={(e) => onChange({ ...block, content: e.target.value })}
            placeholder={
              block.category === 'title'
                ? 'Titre de section'
                : 'Texte libre — vous pouvez insérer une formule $x^2$ ou un lien [texte](https://…)'
            }
            rows={block.category === 'title' ? 1 : 4}
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm resize-y"
          />
          <InsertFormulaButton
            fieldLabel={`Bloc ${index + 1}`}
            fieldRef={fieldRef}
            value={block.content}
            onChange={(value) => onChange({ ...block, content: value })}
          />
          {block.content.trim() !== '' && (
            <p className="text-xs text-gray-500 border-t border-gray-200 pt-2">
              Aperçu : <LightMarkupText text={block.content} />
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sous-composant : bloc image (sélection locale + aperçu) ──────────────────────────────────

interface TutorialImageBlockFieldProps {
  tutorialId?: string
  imageFile: File | null
  existingImageBlock: PublicTutorialBlock | null
  onFileSelected: (file: File | null) => void
  isSubmitting: boolean
  maxImageInputBytes: number
}

function TutorialImageBlockField({
  tutorialId,
  imageFile,
  existingImageBlock,
  onFileSelected,
  isSubmitting,
  maxImageInputBytes,
}: TutorialImageBlockFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [sizeError, setSizeError] = useState<string | null>(null)

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(imageFile)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [imageFile])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return

    if (isTutorialImageFileTooLarge(file, maxImageInputBytes)) {
      setSizeError(getTutorialImageTooLargeMessage(file, maxImageInputBytes))
      return
    }

    setSizeError(null)
    onFileSelected(file)
  }

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept="image/*"
        disabled={isSubmitting}
        onChange={handleFileChange}
        className="text-sm"
      />
      <p className="text-xs text-gray-400">{getTutorialImageMaxSizeHint(maxImageInputBytes)}</p>

      {sizeError && <p className="text-xs text-red-600">{sizeError}</p>}

      {previewUrl && (
        <figure>
          <img
            src={previewUrl}
            alt="Aperçu"
            className="max-w-full max-h-64 rounded-lg border border-gray-200"
          />
          <figcaption className="text-xs text-gray-500 mt-1">
            Nouvelle image sélectionnée — envoyée à l'enregistrement du formulaire.
          </figcaption>
        </figure>
      )}

      {!previewUrl && existingImageBlock && tutorialId && (
        <div>
          <TutorialBlockImageView tutorialId={tutorialId} block={existingImageBlock} />
          <p className="text-xs text-gray-500 mt-1">
            Image déjà enregistrée. Choisissez un fichier ci-dessus pour la remplacer.
          </p>
        </div>
      )}

      {!previewUrl && !existingImageBlock && (
        <p className="text-xs text-gray-400">Aucune image sélectionnée.</p>
      )}
    </div>
  )
}
