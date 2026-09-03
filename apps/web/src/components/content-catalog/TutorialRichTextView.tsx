/**
 * TutorialRichTextView — rendu en lecture seule d'un bloc `text` de Tutoriel « post », édité via
 * `TutorialRichTextEditor` (arbitrage du 2026-09-03, point 5 : « mêmes styles qu'à l'édition »).
 *
 * Réutilise **exactement** le même schéma d'extensions que l'éditeur (`tutorialRichTextExtensions`)
 * via une instance TipTap non éditable — pas un rendu HTML séparé, pas de `dangerouslySetInnerHTML`.
 * C'est ProseMirror qui contrôle le DOM produit à partir du document JSON schématisé : le texte
 * saisi par l'utilisateur n'est jamais interprété comme du balisage, seul un ensemble fermé de
 * nœuds/marques connus (gras, italique, taille, couleur, formule, image) sait produire du DOM.
 */

import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { createTutorialRichTextExtensions } from './richtext/tutorialRichTextExtensions'
import { parseTutorialRichTextContent } from '../../utils/tutorialRichTextContent'

interface TutorialRichTextViewProps {
  content: string | null
}

export function TutorialRichTextView({ content }: TutorialRichTextViewProps) {
  const editor = useEditor({
    extensions: createTutorialRichTextExtensions(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lu uniquement au montage, un bloc a un id de clé stable côté appelant
    content: parseTutorialRichTextContent(content),
    editable: false,
  })

  if (!editor) return null

  return (
    <div className="text-sm text-gray-700 [&_p]:mb-2 [&_p:last-child]:mb-0">
      <EditorContent editor={editor} />
    </div>
  )
}
