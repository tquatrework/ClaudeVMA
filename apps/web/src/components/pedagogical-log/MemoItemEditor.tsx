/**
 * MemoItemEditor — formulaire de création d'un item de mémo (texte, formule
 * ou image), à l'intérieur d'un chapitre. Réécrit le 2026-08-27 (chantier
 * `feat/memo-formules`) : l'ancien formulaire plat titre+contenu+chapitre
 * n'a pas de correspondance sur le contrat réel, où un item porte un `type`
 * et vit toujours **dans** un chapitre (plus d'items « orphelins »).
 *
 * Élève uniquement — le backend refuse les autres rôles avec 403.
 */

import React, { useId, useState } from 'react'
import { createMemoTextOrFormulaItem, uploadMemoImageItem } from '../../api/pedagogicalLogMemos'
import type { MemoItem, MemoItemType } from '../../types/memo'
import {
  MEMO_INCOMPLETE_FORMULA_MESSAGE,
  MEMO_ITEM_CONTENT_MAX_LENGTH,
  MEMO_ITEM_TITLE_MAX_LENGTH,
  MEMO_ITEM_TYPE_LABELS,
  MEMO_IMAGE_FILE_INPUT_ACCEPT,
  getMemoImageMaxSizeHint,
  getMemoImageTooLargeMessage,
  getMemoWriteErrorMessage,
  hasUnfilledMathPlaceholder,
  isMemoImageTooLarge,
} from '../../utils/memo'
import { MemoFormulaInput } from './MemoFormulaInput'

interface MemoItemEditorProps {
  chapterId: string
  onSave: (item: MemoItem) => void
  onCancel: () => void
}

const ITEM_TYPES: MemoItemType[] = ['text', 'formula', 'image']

export default function MemoItemEditor({ chapterId, onSave, onCancel }: MemoItemEditorProps) {
  const formulaFieldId = useId()
  const titleFieldId = useId()
  const [itemType, setItemType] = useState<MemoItemType>('text')
  const [title, setTitle] = useState('')
  const [textContent, setTextContent] = useState('')
  const [formulaContent, setFormulaContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageCaption, setImageCaption] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const resetFields = () => {
    setTitle('')
    setTextContent('')
    setFormulaContent('')
    setImageFile(null)
    setImageCaption('')
  }

  const isSubmitDisabled =
    itemType === 'text'
      ? !textContent.trim()
      : itemType === 'formula'
        ? !formulaContent.trim()
        : !imageFile

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)

    if (itemType === 'image' && imageFile && isMemoImageTooLarge(imageFile)) {
      setErrorMessage(getMemoImageTooLargeMessage(imageFile.size))
      return
    }
    // Une formule MathLive avec une case de gabarit non remplie
    // (`\placeholder{}`) ne doit jamais être enregistrée : elle produirait un
    // repli « Formule illisible » à la lecture, jamais un vrai contenu.
    // Bloqué avant tout appel réseau — voir `hasUnfilledMathPlaceholder`.
    if (itemType === 'formula' && hasUnfilledMathPlaceholder(formulaContent)) {
      setErrorMessage(MEMO_INCOMPLETE_FORMULA_MESSAGE)
      return
    }
    if (isSubmitDisabled) return

    const trimmedTitle = title.trim() || undefined

    setIsSaving(true)
    try {
      let createdItem: MemoItem
      if (itemType === 'image' && imageFile) {
        createdItem = await uploadMemoImageItem(
          chapterId,
          imageFile,
          imageCaption.trim() || undefined,
          trimmedTitle,
        )
      } else {
        createdItem = await createMemoTextOrFormulaItem(chapterId, {
          type: itemType === 'formula' ? 'formula' : 'text',
          content: itemType === 'formula' ? formulaContent.trim() : textContent.trim(),
          title: trimmedTitle,
        })
      }
      onSave(createdItem)
      resetFields()
    } catch (err: unknown) {
      setErrorMessage(getMemoWriteErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3 mt-2"
    >
      {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}

      <div>
        <span className="block text-xs text-gray-500 mb-1">Type de note</span>
        <div className="flex gap-2" role="radiogroup" aria-label="Type de note">
          {ITEM_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={itemType === type}
              onClick={() => setItemType(type)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                itemType === type
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'
              }`}
            >
              {MEMO_ITEM_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor={titleFieldId} className="block text-xs text-gray-500 mb-1">
          Titre (optionnel)
        </label>
        <input
          id={titleFieldId}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MEMO_ITEM_TITLE_MAX_LENGTH}
          placeholder="ex : Théorème de Pythagore"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {itemType === 'text' && (
        <div>
          <label htmlFor="memo-item-text" className="block text-xs text-gray-500 mb-1">
            Contenu
          </label>
          <textarea
            id="memo-item-text"
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Texte libre — vous pouvez insérer un lien [texte](url) ou une formule $x^2$"
            rows={3}
            maxLength={MEMO_ITEM_CONTENT_MAX_LENGTH}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </div>
      )}

      {itemType === 'formula' && (
        <div>
          <label htmlFor={formulaFieldId} className="block text-xs text-gray-500 mb-1">
            Formule
          </label>
          <MemoFormulaInput id={formulaFieldId} value={formulaContent} onChange={setFormulaContent} />
        </div>
      )}

      {itemType === 'image' && (
        <div className="space-y-2">
          <div>
            <label htmlFor="memo-item-image" className="block text-xs text-gray-500 mb-1">
              Image
            </label>
            <input
              id="memo-item-image"
              type="file"
              accept={MEMO_IMAGE_FILE_INPUT_ACCEPT}
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">{getMemoImageMaxSizeHint()}</p>
          </div>
          <div>
            <label htmlFor="memo-item-caption" className="block text-xs text-gray-500 mb-1">
              Légende (optionnel)
            </label>
            <input
              id="memo-item-caption"
              type="text"
              value={imageCaption}
              onChange={(e) => setImageCaption(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSaving || isSubmitDisabled}
          className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? 'Ajout…' : 'Ajouter'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-white text-gray-600 border border-gray-200 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-50"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
