/**
 * TutorialBlockEditor — édition d'un bloc de Tutoriel au format « post » (texte ou image), au sein
 * de `TutorialForm`. Un bloc EST directement son contenu (pas d'items imbriqués comme l'Exercice) :
 * un bloc `text` est édité via `TutorialRichTextEditor` (éditeur riche WYSIWYG, arbitrage du
 * 2026-09-03 — `content` porte un document structuré TipTap sérialisé en JSON, contrairement à la
 * syntaxe légère texte brut utilisée pour le Mémo/Quizz/cahier de texte) ; un bloc image porte un
 * fichier choisi localement, encodé en base64 et embarqué dans le payload à la soumission du
 * formulaire (voir `TutorialForm`/`utils/tutorialImageResolution.ts`).
 *
 * La catégorie de bloc `title` a été retirée (fusionnée dans `text`, voir `types/tutorial.ts`) :
 * un titre se compose désormais dans l'éditeur riche via une taille de texte plus grande et/ou le
 * gras, pas via une catégorie de bloc distincte.
 */

import React, { useEffect, useState } from 'react'
import { TutorialBlockImageView } from './TutorialBlockImageView'
import { TutorialRichTextEditor } from './TutorialRichTextEditor'
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
  /** Utilisé pour `category === 'text'` — document structuré TipTap sérialisé en JSON. */
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
        <TutorialRichTextEditor
          value={block.content}
          onChange={(content) => onChange({ ...block, content })}
          isSubmitting={isSubmitting}
          fieldLabel={`Bloc ${index + 1}`}
        />
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
