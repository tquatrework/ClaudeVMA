/**
 * LightMarkupEditor — remplace `LightMarkupTextarea` (retiré le 2026-08-27,
 * défaut réel remonté par un utilisateur en test réel : « l'URL doit rester
 * cachée dès l'insertion du lien, pas seulement recolorée »).
 *
 * `LightMarkupTextarea` superposait un calque de coloration au-dessus d'un
 * `<textarea>` rendu transparent : `[label](url)` restait visible tel quel
 * (crochets + URL), simplement recoloré — un calque ne peut pas masquer des
 * caractères sans désynchroniser la position du curseur natif du texte réel
 * qu'il recouvre, pixel pour pixel. Ce composant abandonne donc le calque au
 * profit d'une zone `contentEditable` où chaque lien inséré devient un
 * **jeton atomique** (`contentEditable=false`) n'affichant que son libellé —
 * jamais les crochets ni l'URL — le texte alentour restant librement
 * éditable, exactement comme un `@mention` dans un éditeur de messagerie.
 *
 * Ce composant n'est **pas** un éditeur riche généraliste : pas de gras, pas
 * d'italique, pas de listes, aucun HTML n'est jamais stocké ni envoyé
 * (arbitrage du 2026-08-26, « Syntaxe legere unifiee pour le texte enrichi »,
 * `docs/architecture.md`, toujours en vigueur). La **source de vérité reste
 * le texte brut** `[label](url)` — reconstruite depuis le DOM courant par
 * `serializeLightMarkupEditor` (`src/utils/lightMarkup.ts`) à chaque saisie,
 * et c'est cette valeur, et seulement elle, qui remonte via `onChange` puis
 * qui est envoyée au serveur (`sessionSummary`/`homework` restent des
 * chaînes de texte simples côté API).
 *
 * Contrôlé, mais resynchronisé sélectivement : reconstruire le DOM à chaque
 * frappe casserait la position du curseur (React re-rendrait le contenu
 * `contentEditable` sous les doigts de l'utilisateur). Le composant ne
 * reconstruit donc ses nœuds à partir de `value` que lorsque ce changement ne
 * vient PAS de sa propre dernière frappe (`lastEmittedValueRef`) — un
 * changement externe (insertion via `InsertLinkButton`, annulation du
 * formulaire, chargement d'une autre entrée) déclenche la reconstruction ;
 * une frappe normale de l'utilisateur ne touche jamais au DOM au-delà de ce
 * que le navigateur vient d'y écrire lui-même.
 *
 * Le ref exposé (`forwardRef`) n'est plus un `HTMLTextAreaElement` — il n'y
 * en a plus — mais un `LightMarkupEditorHandle` (`getSelectionOffsets`,
 * `focusAndSetCaret`), pour que `InsertLinkButton` continue d'insérer un
 * lien à la position du curseur réelle, jamais systématiquement en fin de
 * texte. Le `Selection`/`Range` global du document ne conservant pas la
 * position une fois le focus déplacé (contrairement à
 * `textarea.selectionStart`, qui persistait après un blur), la dernière
 * position connue est mémorisée à chaque interaction (`onKeyUp`, `onMouseUp`,
 * `onInput`, `onFocus`) plutôt que relue à la volée au moment de l'insertion.
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useId, useRef } from 'react'
import {
  buildMathMarkup,
  domPositionForRawOffset,
  LIGHT_MARKUP_CHIP_ATTR,
  LIGHT_MARKUP_LABEL_ATTR,
  LIGHT_MARKUP_URL_ATTR,
  parseLightMarkup,
  rawOffsetFromDomPosition,
  serializeLightMarkupEditor,
} from '../../utils/lightMarkup'

export interface LightMarkupEditorHandle {
  /** Dernière position de sélection connue, en offsets de texte brut — voir le commentaire d'en-tête. */
  getSelectionOffsets: () => { start: number; end: number }
  /** Redonne le focus à l'éditeur et place le curseur à cet offset de texte brut. */
  focusAndSetCaret: (offset: number) => void
}

interface LightMarkupEditorProps {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  /** Couleur de bordure — `border-gray-300` (création) ou `border-indigo-300` (édition inline). */
  borderClassName?: string
  /**
   * Id d'un `<label>` associé. `<label htmlFor>` ne s'applique qu'aux
   * éléments de formulaire natifs (spécification HTML, catégorie
   * « labelable ») — un `<div role="textbox">` n'en fait pas partie, d'où
   * `aria-labelledby` plutôt que `htmlFor` pour rester accessible (et
   * repérable par `getByLabelText` dans les tests).
   */
  ariaLabelledBy?: string
}

function buildEditorNodes(document: Document, text: string): Node[] {
  const segments = parseLightMarkup(text)
  const nodes: Node[] = []

  segments.forEach((segment) => {
    if (segment.type === 'link') {
      const chip = document.createElement('span')
      chip.setAttribute(LIGHT_MARKUP_CHIP_ATTR, 'true')
      chip.setAttribute(LIGHT_MARKUP_LABEL_ATTR, segment.label)
      chip.setAttribute(LIGHT_MARKUP_URL_ATTR, segment.url)
      chip.contentEditable = 'false'
      chip.className =
        'inline-flex select-none items-center rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700'
      chip.textContent = segment.label
      nodes.push(chip)
    } else {
      // Un segment `math` ($...$/$$...$$) n'est pas rendu en jeton ici — ce
      // composant ne gère que les liens comme jetons atomiques ; une formule
      // reste du texte brut éditable au caractère près, comme avant que le
      // parseur ne la reconnaisse (voir `buildMathMarkup`).
      const textValue = segment.type === 'text' ? segment.value : buildMathMarkup(segment)
      const lines = textValue.split('\n')
      lines.forEach((line, index) => {
        if (index > 0) nodes.push(document.createElement('br'))
        if (line) nodes.push(document.createTextNode(line))
      })
    }
  })

  return nodes
}

export const LightMarkupEditor = forwardRef<LightMarkupEditorHandle, LightMarkupEditorProps>(
  function LightMarkupEditor(
    { id, value, onChange, placeholder, rows = 3, borderClassName = 'border-gray-300', ariaLabelledBy },
    forwardedRef,
  ) {
    const rootRef = useRef<HTMLDivElement | null>(null)
    // Ce que le composant a lui-même émis en dernier via `onChange` — sert à
    // distinguer une frappe locale (DOM déjà à jour, ne pas reconstruire)
    // d'un changement externe de `value` (reconstruire depuis `value`).
    const lastEmittedValueRef = useRef<string | null>(null)
    const lastOffsetsRef = useRef({ start: 0, end: 0 })
    const placeholderId = useId()

    const captureSelection = useCallback(() => {
      const root = rootRef.current
      if (!root) return
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)
      if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return
      const start = rawOffsetFromDomPosition(root, range.startContainer, range.startOffset)
      const end = rawOffsetFromDomPosition(root, range.endContainer, range.endOffset)
      lastOffsetsRef.current = { start: Math.min(start, end), end: Math.max(start, end) }
    }, [])

    const handleInput = useCallback(() => {
      const root = rootRef.current
      if (!root) return
      const serialized = serializeLightMarkupEditor(root)
      lastEmittedValueRef.current = serialized
      onChange(serialized)
      captureSelection()
    }, [onChange, captureSelection])

    // Reconstruit le contenu depuis `value` — au montage, et à chaque
    // changement externe (jamais après notre propre frappe, voir en-tête).
    useEffect(() => {
      const root = rootRef.current
      if (!root) return
      if (lastEmittedValueRef.current === value) return

      root.innerHTML = ''
      buildEditorNodes(root.ownerDocument, value).forEach((node) => root.appendChild(node))
      lastEmittedValueRef.current = value
      lastOffsetsRef.current = { start: value.length, end: value.length }
    }, [value])

    useImperativeHandle(
      forwardedRef,
      () => ({
        getSelectionOffsets: () => lastOffsetsRef.current,
        focusAndSetCaret: (offset: number) => {
          const root = rootRef.current
          if (!root) return
          root.focus()
          const position = domPositionForRawOffset(root, offset)
          const selection = window.getSelection()
          if (!selection) return
          const range = root.ownerDocument.createRange()
          range.setStart(position.node, position.offset)
          range.collapse(true)
          selection.removeAllRanges()
          selection.addRange(range)
          lastOffsetsRef.current = { start: offset, end: offset }
        },
      }),
      [],
    )

    const isEmpty = value.length === 0

    return (
      <div className="relative">
        {isEmpty && placeholder && (
          <span
            id={placeholderId}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-2 text-sm text-gray-400"
          >
            {placeholder}
          </span>
        )}
        <div
          id={id}
          ref={rootRef}
          role="textbox"
          aria-multiline="true"
          aria-placeholder={placeholder}
          aria-labelledby={ariaLabelledBy}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyUp={captureSelection}
          onMouseUp={captureSelection}
          onFocus={captureSelection}
          style={{ minHeight: `${rows * 1.5}rem` }}
          className={`w-full resize-none overflow-auto whitespace-pre-wrap break-words rounded-lg border ${borderClassName} bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400`}
        />
      </div>
    )
  },
)
