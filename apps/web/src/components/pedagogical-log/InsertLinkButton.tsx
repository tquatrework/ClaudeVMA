/**
 * InsertLinkButton — insère un lien `[texte](url)` (`src/utils/lightMarkup.ts`)
 * à la position du curseur d'un `LightMarkupEditor`.
 *
 * Remplace `ResourceLinkEditor` (champ structuré séparé, retiré le
 * 2026-08-26 après retour utilisateur réel : le lien doit vivre **dans** le
 * texte de `sessionSummary`/`homework`, pas à côté). Partagé entre le
 * formulaire de création et l'édition inline d'une entrée — même mécanisme
 * d'insertion, quel que soit l'appelant.
 *
 * Adapté le 2026-08-27 (défaut « l'URL doit rester cachée dès l'insertion »,
 * `LightMarkupTextarea` → `LightMarkupEditor`) : la position d'insertion
 * n'est plus lue sur `textarea.selectionStart`/`selectionEnd` (il n'y a plus
 * de `<textarea>` réel) mais sur `LightMarkupEditorHandle.getSelectionOffsets()`
 * — la dernière position connue, en offsets de **texte brut**, mémorisée par
 * l'éditeur à chaque interaction (le `Selection` global du document ne
 * conserve pas la position une fois le focus déplacé vers les champs de
 * cette popover, contrairement à `textarea.selectionStart`). La construction
 * du nouveau texte (`insertTextAtSelection`) est inchangée : elle opère sur
 * le texte brut, pas sur le DOM.
 */

import React, { useId, useState } from 'react'
import type { LightMarkupEditorHandle } from './LightMarkupEditor'
import { buildInlineLinkMarkup, insertTextAtSelection, isAbsoluteHttpUrl } from '../../utils/lightMarkup'

interface InsertLinkButtonProps {
  /** Nom du champ ciblé (« Déroulement de la séance », « À faire »…) — sert à distinguer deux boutons sur un même formulaire, jamais affiché tel quel dans le libellé visible. */
  fieldLabel: string
  editorRef: React.RefObject<LightMarkupEditorHandle>
  value: string
  onChange: (value: string) => void
}

export function InsertLinkButton({ fieldLabel, editorRef, value, onChange }: InsertLinkButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const labelInputId = useId()
  const urlInputId = useId()

  const resetPopover = () => {
    setLinkLabel('')
    setLinkUrl('')
    setError(null)
  }

  const handleOpen = () => {
    resetPopover()
    setIsOpen(true)
  }

  const handleCancel = () => {
    setIsOpen(false)
    resetPopover()
  }

  const handleInsert = () => {
    const trimmedLabel = linkLabel.trim()
    const trimmedUrl = linkUrl.trim()

    if (!trimmedLabel) {
      setError('Le texte affiché est requis.')
      return
    }
    if (!isAbsoluteHttpUrl(trimmedUrl)) {
      setError("L'adresse doit commencer par http:// ou https://.")
      return
    }

    const { start: selectionStart, end: selectionEnd } =
      editorRef.current?.getSelectionOffsets() ?? { start: value.length, end: value.length }
    const markup = buildInlineLinkMarkup(trimmedLabel, trimmedUrl)
    const { text: newValue, cursorPosition } = insertTextAtSelection(
      value,
      selectionStart,
      selectionEnd,
      markup,
    )

    onChange(newValue)
    setIsOpen(false)
    resetPopover()

    // L'éditeur est contrôlé par le parent : son DOM ne reflète `newValue`
    // qu'après le prochain rendu. On remet le focus et le curseur juste
    // après, une fois ce rendu passé — même délai que l'ancienne implémentation.
    setTimeout(() => {
      editorRef.current?.focusAndSetCaret(cursorPosition)
    }, 0)
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Insérer un lien dans « ${fieldLabel} »`}
        className="text-xs text-indigo-500 hover:underline"
      >
        + Insérer un lien
      </button>

      {isOpen && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-gray-200 p-2 sm:flex-row sm:items-center">
          <input
            id={labelInputId}
            type="text"
            value={linkLabel}
            onChange={(event) => setLinkLabel(event.target.value)}
            placeholder="Texte affiché (ex. Fiche de cours)"
            aria-label="Texte affiché du lien"
            className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <input
            id={urlInputId}
            type="url"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://…"
            aria-label="Adresse (URL) du lien"
            className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handleInsert}
              className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-indigo-700"
            >
              Insérer
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-200"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
