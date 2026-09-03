/**
 * RichTextInsertFormulaButton — bouton de la barre d'outils de `TutorialRichTextEditor` insérant
 * une formule mathématique (`TutorialFormula`) à la position du curseur. Même patron d'interaction
 * que `InsertFormulaButton` (popover Insérer/Annuler, `MemoFormulaInput` réutilisé) — adapté à un
 * éditeur TipTap plutôt qu'à un `<textarea>` natif : l'insertion passe par une commande
 * (`insertTutorialFormula`) plutôt que par une manipulation directe de la valeur du champ.
 */

import React, { useId, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { MemoFormulaInput } from '../../pedagogical-log/MemoFormulaInput'
import { hasUnfilledMathPlaceholder, MEMO_INCOMPLETE_FORMULA_MESSAGE } from '../../../utils/memo'

interface RichTextInsertFormulaButtonProps {
  editor: Editor
}

export function RichTextInsertFormulaButton({ editor }: RichTextInsertFormulaButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fieldId = useId()

  const reset = () => {
    setDraft('')
    setError(null)
  }

  const handleInsert = () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      setError('La formule est vide.')
      return
    }
    if (hasUnfilledMathPlaceholder(trimmed)) {
      setError(MEMO_INCOMPLETE_FORMULA_MESSAGE)
      return
    }
    editor.chain().focus().insertTutorialFormula(trimmed).run()
    setIsOpen(false)
    reset()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          reset()
          setIsOpen(true)
        }}
        aria-label="Insérer une formule"
        className="rounded px-2 py-1 text-xs text-indigo-600 hover:bg-gray-100"
      >
        + Formule
      </button>

      {isOpen && (
        <div className="absolute z-20 top-full left-0 mt-1 w-72 flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          <MemoFormulaInput id={fieldId} value={draft} onChange={setDraft} />
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleInsert}
              className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700"
            >
              Insérer
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                reset()
              }}
              className="rounded bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
