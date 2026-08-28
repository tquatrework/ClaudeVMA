/**
 * InsertFormulaButton — insère une formule mathématique (`$latex$`,
 * `src/utils/lightMarkup.ts`) à la position du curseur d'un champ texte natif
 * (`<textarea>` ou `<input>`).
 *
 * Retour utilisateur du 2026-08-28 sur le chantier Quizz (PR #165/#168) :
 * le rendu KaTeX avait bien été réutilisé du Mémo, mais pas l'affordance de
 * saisie — un champ énoncé/option n'offrait qu'un texte d'indice
 * (« vous pouvez taper $x^2$ »), sans aucune aide à la frappe. Ce composant
 * réutilise **exactement** la même technique que le Mémo pour saisir une
 * formule (`MemoFormulaInput` — MathLive, clavier virtuel mathématique,
 * aperçu en temps réel pendant la frappe) plutôt que d'en réinventer une
 * seconde, et **le même patron d'interaction** que `InsertLinkButton` (bouton
 * « + Insérer... » ouvrant une popover Insérer/Annuler à la position du
 * curseur) — même composant réutilisé, même geste, pour les deux besoins de
 * texte enrichi du projet (liens, puis formules).
 *
 * Contrairement à `InsertLinkButton` (ciblant un `LightMarkupEditor`
 * `contentEditable`), ce composant cible un `<textarea>`/`<input>` natif : la
 * position de sélection se lit directement sur l'élément DOM
 * (`selectionStart`/`selectionEnd`), sans jeton ni sérialisation particulière
 * — les champs de Quizz (énoncé, options) restent de simples champs texte.
 */

import React, { useId, useState } from 'react'
import { buildMathMarkup, insertTextAtSelection } from '../../utils/lightMarkup'
import { hasUnfilledMathPlaceholder, MEMO_INCOMPLETE_FORMULA_MESSAGE } from '../../utils/memo'
import { MemoFormulaInput } from '../pedagogical-log/MemoFormulaInput'

type FormulaTargetElement = HTMLTextAreaElement | HTMLInputElement

interface InsertFormulaButtonProps {
  /** Nom du champ ciblé (« Énoncé », « Option 1 »…) — sert au libellé accessible du bouton. */
  fieldLabel: string
  fieldRef: React.RefObject<FormulaTargetElement | null>
  value: string
  onChange: (value: string) => void
}

export function InsertFormulaButton({ fieldLabel, fieldRef, value, onChange }: InsertFormulaButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [formulaDraft, setFormulaDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const formulaFieldId = useId()

  const resetPopover = () => {
    setFormulaDraft('')
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
    const trimmedLatex = formulaDraft.trim()
    if (!trimmedLatex) {
      setError('La formule est vide.')
      return
    }
    if (hasUnfilledMathPlaceholder(trimmedLatex)) {
      setError(MEMO_INCOMPLETE_FORMULA_MESSAGE)
      return
    }

    const field = fieldRef.current
    const selectionStart = field?.selectionStart ?? value.length
    const selectionEnd = field?.selectionEnd ?? value.length
    const markup = buildMathMarkup({ latex: trimmedLatex, displayMode: false })
    const { text: newValue, cursorPosition } = insertTextAtSelection(
      value,
      selectionStart,
      selectionEnd,
      markup,
    )

    onChange(newValue)
    setIsOpen(false)
    resetPopover()

    // Le champ est contrôlé par le parent : sa valeur DOM ne reflète
    // `newValue` qu'après le prochain rendu — même délai que `InsertLinkButton`.
    setTimeout(() => {
      const target = fieldRef.current
      if (!target) return
      target.focus()
      target.setSelectionRange(cursorPosition, cursorPosition)
    }, 0)
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Insérer une formule dans « ${fieldLabel} »`}
        className="text-xs text-indigo-500 hover:underline"
      >
        + Insérer une formule
      </button>

      {isOpen && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-gray-200 p-2">
          <MemoFormulaInput id={formulaFieldId} value={formulaDraft} onChange={setFormulaDraft} />
          {error && (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
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
    </div>
  )
}
