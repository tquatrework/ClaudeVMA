/**
 * TutorialRichTextToolbar — barre d'outils de `TutorialRichTextEditor` : gras, italique, taille de
 * texte (paliers prédéfinis), couleur de texte (palette prédéfinie), insertion de formule.
 * Aucun contrôle de mise en forme libre (pas de saisie de taille en pixels, pas de sélecteur de
 * couleur RGB) — conforme à l'arbitrage du 2026-09-03, point 3/5.
 */

import React from 'react'
import type { Editor } from '@tiptap/core'
import {
  TUTORIAL_TEXT_SIZES,
  TUTORIAL_TEXT_SIZE_LABELS,
  type TutorialTextSize,
} from './tutorialFontSizeMark'
import {
  TUTORIAL_TEXT_COLORS,
  TUTORIAL_TEXT_COLOR_LABELS,
  TUTORIAL_TEXT_COLOR_VALUES,
  type TutorialTextColor,
} from './tutorialTextColorMark'
import { RichTextInsertFormulaButton } from './RichTextInsertFormulaButton'

interface TutorialRichTextToolbarProps {
  editor: Editor
}

export function TutorialRichTextToolbar({ editor }: TutorialRichTextToolbarProps) {
  const currentSize = (editor.getAttributes('tutorialFontSize').size as TutorialTextSize | undefined) ?? 'normal'
  const currentColor =
    (editor.getAttributes('tutorialTextColor').color as TutorialTextColor | undefined) ?? 'default'

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-t-md border-b border-gray-200 bg-gray-50 px-2 py-1.5">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        aria-pressed={editor.isActive('bold')}
        aria-label="Gras"
        className={`rounded px-2 py-1 text-xs font-bold ${
          editor.isActive('bold') ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        G
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        aria-pressed={editor.isActive('italic')}
        aria-label="Italique"
        className={`rounded px-2 py-1 text-xs italic ${
          editor.isActive('italic') ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        I
      </button>

      <label className="flex items-center gap-1 text-xs text-gray-600">
        Taille
        <select
          aria-label="Taille du texte"
          value={currentSize}
          onChange={(event) =>
            editor.chain().focus().setTutorialFontSize(event.target.value as TutorialTextSize).run()
          }
          className="rounded border border-gray-300 bg-white px-1 py-0.5 text-xs"
        >
          {TUTORIAL_TEXT_SIZES.map((size) => (
            <option key={size} value={size}>
              {TUTORIAL_TEXT_SIZE_LABELS[size]}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-1" role="group" aria-label="Couleur du texte">
        {TUTORIAL_TEXT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => editor.chain().focus().setTutorialTextColor(color).run()}
            aria-label={`Couleur ${TUTORIAL_TEXT_COLOR_LABELS[color]}`}
            aria-pressed={currentColor === color}
            title={TUTORIAL_TEXT_COLOR_LABELS[color]}
            className={`h-5 w-5 rounded-full border ${
              currentColor === color ? 'ring-2 ring-indigo-400' : 'border-gray-300'
            }`}
            style={{ backgroundColor: TUTORIAL_TEXT_COLOR_VALUES[color] }}
          />
        ))}
      </div>

      <RichTextInsertFormulaButton editor={editor} />
    </div>
  )
}
