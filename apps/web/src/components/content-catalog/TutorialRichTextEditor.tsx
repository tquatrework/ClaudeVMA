/**
 * TutorialRichTextEditor — éditeur riche (WYSIWYG) pour un bloc `text` de Tutoriel « post »
 * (arbitrage du 2026-09-03, `docs/architecture/contenu-pedagogique-quizz-exercices-evaluations.md`
 * > « Éditeur riche (WYSIWYG) pour les blocs texte du Tutoriel 'post' »). Remplace le
 * textarea + syntaxe légère utilisé jusqu'ici pour ce bloc — **scope strictement limité au
 * Tutoriel « post »** : Mémo, Quizz et cahier de texte gardent leur éditeur texte brut actuel.
 *
 * Bâti sur TipTap (ProseMirror) : le document produit est un JSON structuré (schéma contrôlé par
 * les extensions de `tutorialRichTextExtensions.ts`), sérialisé en chaîne côté client, jamais du
 * HTML brut ni rendu via `dangerouslySetInnerHTML` — c'était précisément la raison du refus
 * initial d'un éditeur riche sur ce projet (coût d'assainissement anti-injection).
 *
 * `value`/`onChange` : le composant est contrôlé comme les autres champs du projet, mais TipTap ne
 * relit `content` qu'au montage (`useEditor` initial) — le formulaire parent doit donc fournir la
 * valeur initiale déjà correcte, jamais la mettre à jour depuis l'extérieur après le montage (même
 * discipline que les autres champs contrôlés par une bibliothèque tierce du projet, ex.
 * `MemoFormulaInput`).
 */

import React, { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { createTutorialRichTextExtensions } from './richtext/tutorialRichTextExtensions'
import { TutorialRichTextToolbar } from './richtext/TutorialRichTextToolbar'
import {
  parseTutorialRichTextContent,
  serializeTutorialRichTextContent,
} from '../../utils/tutorialRichTextContent'

interface TutorialRichTextEditorProps {
  /** Document structuré sérialisé en JSON (ou texte brut historique) — voir `tutorialRichTextContent.ts`. */
  value: string
  onChange: (value: string) => void
  isSubmitting: boolean
  /** Sert au libellé accessible de la zone d'édition (« Bloc 2 »…). */
  fieldLabel: string
}

export function TutorialRichTextEditor({
  value,
  onChange,
  isSubmitting,
  fieldLabel,
}: TutorialRichTextEditorProps) {
  const editor = useEditor({
    extensions: createTutorialRichTextExtensions(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lu uniquement au montage, voir doc ci-dessus
    content: parseTutorialRichTextContent(value),
    editable: !isSubmitting,
    onUpdate: ({ editor: updatedEditor }) => {
      onChange(serializeTutorialRichTextContent(updatedEditor.getJSON()))
    },
    editorProps: {
      attributes: {
        'aria-label': fieldLabel,
        class:
          'min-h-[6rem] px-3 py-2 text-sm focus:outline-none [&_p]:mb-2 [&_p:last-child]:mb-0',
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!isSubmitting)
  }, [editor, isSubmitting])

  if (!editor) return null

  return (
    <div className="overflow-hidden rounded-md border border-gray-300 bg-white">
      <TutorialRichTextToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
