/**
 * TutorialFontSize — extension TipTap (Mark) portant la taille de texte d'un bloc `text` de
 * Tutoriel « post » (arbitrage du 2026-09-03, point 5 : « ensemble de valeurs prédéfinies, pas de
 * liberté totale »). Trois paliers façon Notion/Google Docs — pas de saisie de taille en pixels
 * arbitraire. `xlarge` sert notamment à composer un titre (point 2 de l'arbitrage : un titre est
 * un texte affiché en grande taille/gras via l'éditeur, la catégorie de bloc `title` étant
 * retirée).
 *
 * Valeurs en `rem` (proportionnelles à la taille de base), jamais en pixels — cohérent avec
 * `.claude/design/front-design.md` (typographie du projet en unités relatives).
 */

import { Mark, mergeAttributes } from '@tiptap/core'

export type TutorialTextSize = 'normal' | 'large' | 'xlarge'

export const TUTORIAL_TEXT_SIZES: TutorialTextSize[] = ['normal', 'large', 'xlarge']

export const TUTORIAL_TEXT_SIZE_LABELS: Record<TutorialTextSize, string> = {
  normal: 'Normal',
  large: 'Grand',
  xlarge: 'Très grand',
}

export const TUTORIAL_TEXT_SIZE_STYLES: Record<TutorialTextSize, string> = {
  normal: '1rem',
  large: '1.375rem',
  xlarge: '1.875rem',
}

const DATA_ATTR = 'data-tutorial-size'

function isTutorialTextSize(value: string | null): value is TutorialTextSize {
  return !!value && (TUTORIAL_TEXT_SIZES as string[]).includes(value)
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tutorialFontSize: {
      setTutorialFontSize: (size: TutorialTextSize) => ReturnType
      unsetTutorialFontSize: () => ReturnType
    }
  }
}

export const TutorialFontSize = Mark.create({
  name: 'tutorialFontSize',

  addAttributes() {
    return {
      size: {
        default: 'normal' as TutorialTextSize,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute(DATA_ATTR)
          return isTutorialTextSize(value) ? value : 'normal'
        },
        renderHTML: (attributes: { size?: string }) => {
          const size = isTutorialTextSize(attributes.size ?? null) ? (attributes.size as TutorialTextSize) : 'normal'
          return {
            [DATA_ATTR]: size,
            style: `font-size: ${TUTORIAL_TEXT_SIZE_STYLES[size]}`,
          }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: `span[${DATA_ATTR}]` }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setTutorialFontSize:
        (size: TutorialTextSize) =>
        ({ commands }) => {
          if (size === 'normal') return commands.unsetMark(this.name)
          return commands.setMark(this.name, { size })
        },
      unsetTutorialFontSize:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})
