/**
 * createTutorialRichTextExtensions — liste d'extensions TipTap partagée entre l'éditeur
 * (`TutorialRichTextEditor`) et le rendu en lecture (`TutorialRichTextView`). Même schéma des
 * deux côtés : condition nécessaire pour que « lecture / rendu ... avec les mêmes styles
 * (taille/couleur/formules) qu'à l'édition » (arbitrage du 2026-09-03, point 5) soit garanti par
 * construction plutôt que par duplication.
 *
 * Portée volontairement étroite (point 5 de l'arbitrage) : gras/italique, taille et couleur
 * prédéfinies, formule — pas de titres structurels, listes, citations, tableaux ni bloc de code,
 * non demandés. `StarterKit` inclut par défaut beaucoup plus que cela ; chaque extension non
 * voulue est explicitement désactivée ci-dessous plutôt que laissée active en silence.
 */

import StarterKit from '@tiptap/starter-kit'
import type { AnyExtension } from '@tiptap/core'
import { TutorialFontSize } from './tutorialFontSizeMark'
import { TutorialTextColor } from './tutorialTextColorMark'
import { TutorialFormula } from './tutorialFormulaNode'

export function createTutorialRichTextExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      codeBlock: false,
      code: false,
      horizontalRule: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      strike: false,
    }),
    TutorialFontSize,
    TutorialTextColor,
    TutorialFormula,
  ]
}
