/**
 * TutorialFormula — extension TipTap (Node, atome inline) portant une formule mathématique dans
 * un bloc `text` de Tutoriel « post » (arbitrage du 2026-09-03, point 4).
 *
 * C'est un NŒUD du document structuré, pas une notation textuelle `$...$` — c'est ce qui permet à
 * la formule d'hériter les marques (taille, couleur) appliquées à la position du curseur au
 * moment de l'insertion : ProseMirror applique les marques par enveloppement DOM, y compris
 * autour d'un nœud atome, donc un span `data-tutorial-size`/`data-tutorial-color` entoure
 * naturellement le rendu KaTeX de la formule si ces marques sont actives à l'insertion. La
 * formule « apparaît à une taille cohérente » avec le texte environnant sans logique dédiée.
 *
 * Rendu par KaTeX (`MathRenderer`, moteur déjà en place dans le projet — pas de second moteur de
 * rendu introduit). Édition : un clic sur la formule ouvre une popover de saisie réutilisant
 * `MemoFormulaInput` (MathLive, même composant que `InsertFormulaButton` ailleurs dans le projet).
 */

import React, { useId, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { MathRenderer } from '../../ui/MathRenderer'
import { MemoFormulaInput } from '../../pedagogical-log/MemoFormulaInput'
import { hasUnfilledMathPlaceholder, MEMO_INCOMPLETE_FORMULA_MESSAGE } from '../../../utils/memo'

export const TUTORIAL_FORMULA_NODE_NAME = 'tutorialFormula'

const DATA_ATTR = 'data-tutorial-formula'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tutorialFormula: {
      insertTutorialFormula: (latex: string) => ReturnType
    }
  }
}

export const TutorialFormula = Node.create({
  name: TUTORIAL_FORMULA_NODE_NAME,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-latex') ?? '',
        renderHTML: (attributes: { latex?: string }) => ({ 'data-latex': attributes.latex ?? '' }),
      },
    }
  },

  parseHTML() {
    return [{ tag: `span[${DATA_ATTR}]` }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { [DATA_ATTR]: '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TutorialFormulaView)
  },

  addCommands() {
    return {
      insertTutorialFormula:
        (latex: string) =>
        ({ chain, state }) => {
          // La formule doit « apparaître à une taille cohérente » avec le texte qui l'entoure
          // (arbitrage du 2026-09-03, point 4) : on copie explicitement les marques actives à la
          // position d'insertion (taille, couleur, gras, italique) sur le nœud inséré — un nœud
          // atome n'hérite jamais automatiquement des marques courantes via `insertContent`,
          // contrairement à du texte tapé au clavier. `state` (et non `editor.state`) reflète les
          // commandes déjà appliquées plus tôt dans la même chaîne (ex. un changement de taille
          // juste avant l'insertion).
          const activeMarks = (state.storedMarks ?? state.selection.$from.marks()).map((mark) => ({
            type: mark.type.name,
            attrs: mark.attrs,
          }))
          return chain()
            .insertContent({ type: this.name, attrs: { latex }, marks: activeMarks })
            .run()
        },
    }
  },
})

function TutorialFormulaView({ node, updateAttributes, editor }: NodeViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<string>(node.attrs.latex ?? '')
  const [error, setError] = useState<string | null>(null)
  const fieldId = useId()

  const openEditor = () => {
    if (!editor.isEditable) return
    setDraft(node.attrs.latex ?? '')
    setError(null)
    setIsEditing(true)
  }

  const confirm = () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      setError('La formule est vide.')
      return
    }
    if (hasUnfilledMathPlaceholder(trimmed)) {
      setError(MEMO_INCOMPLETE_FORMULA_MESSAGE)
      return
    }
    updateAttributes({ latex: trimmed })
    setIsEditing(false)
  }

  return (
    <NodeViewWrapper
      as="span"
      className="tutorial-formula-node relative inline-block align-middle"
      data-tutorial-formula-view=""
    >
      <button
        type="button"
        onClick={openEditor}
        disabled={!editor.isEditable}
        aria-label="Modifier la formule"
        className="rounded px-1 hover:bg-indigo-50 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <MathRenderer latex={node.attrs.latex || '\\text{formule}'} />
      </button>

      {isEditing && (
        <span
          contentEditable={false}
          className="absolute z-20 top-full left-0 mt-1 w-72 flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
        >
          <MemoFormulaInput id={fieldId} value={draft} onChange={setDraft} />
          {error && (
            <span role="alert" className="text-xs text-red-600">
              {error}
            </span>
          )}
          <span className="flex gap-2">
            <button
              type="button"
              onClick={confirm}
              className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700"
            >
              Valider
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200"
            >
              Annuler
            </button>
          </span>
        </span>
      )}
    </NodeViewWrapper>
  )
}
