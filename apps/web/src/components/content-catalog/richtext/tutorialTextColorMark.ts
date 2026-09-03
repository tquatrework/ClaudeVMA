/**
 * TutorialTextColor — extension TipTap (Mark) portant la couleur de texte d'un bloc `text` de
 * Tutoriel « post » (arbitrage du 2026-09-03, point 5). Palette limitée à des clés prédéfinies —
 * jamais un sélecteur de couleur libre (color picker RGB) : la barre d'outils n'expose que des
 * pastilles pour ces valeurs, aucune saisie de couleur arbitraire n'est possible.
 *
 * Couleurs choisies pour rester sobres et cohérentes avec `.claude/design/front-design.md`
 * (texte principal `#1E2230`, texte secondaire `#8A90A2`, pas de grands aplats colorés) : le
 * défaut reprend le texte principal du projet, les autres teintes reprennent les couleurs déjà
 * utilisées ailleurs dans le catalogue de contenu (indigo = accent principal du projet, vert =
 * validé, ambre = en attente, rouge = refusé/sensible, violet = accent secondaire).
 */

import { Mark, mergeAttributes } from '@tiptap/core'

export type TutorialTextColor = 'default' | 'gray' | 'indigo' | 'green' | 'amber' | 'red' | 'purple'

export const TUTORIAL_TEXT_COLORS: TutorialTextColor[] = [
  'default',
  'gray',
  'indigo',
  'green',
  'amber',
  'red',
  'purple',
]

export const TUTORIAL_TEXT_COLOR_LABELS: Record<TutorialTextColor, string> = {
  default: 'Par défaut',
  gray: 'Gris',
  indigo: 'Indigo',
  green: 'Vert',
  amber: 'Ambre',
  red: 'Rouge',
  purple: 'Violet',
}

export const TUTORIAL_TEXT_COLOR_VALUES: Record<TutorialTextColor, string> = {
  default: '#1E2230',
  gray: '#8A90A2',
  indigo: '#4F46E5',
  green: '#16A34A',
  amber: '#D97706',
  red: '#DC2626',
  purple: '#7C3AED',
}

const DATA_ATTR = 'data-tutorial-color'

function isTutorialTextColor(value: string | null): value is TutorialTextColor {
  return !!value && (TUTORIAL_TEXT_COLORS as string[]).includes(value)
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tutorialTextColor: {
      setTutorialTextColor: (color: TutorialTextColor) => ReturnType
      unsetTutorialTextColor: () => ReturnType
    }
  }
}

export const TutorialTextColor = Mark.create({
  name: 'tutorialTextColor',

  addAttributes() {
    return {
      color: {
        default: 'default' as TutorialTextColor,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute(DATA_ATTR)
          return isTutorialTextColor(value) ? value : 'default'
        },
        renderHTML: (attributes: { color?: string }) => {
          const color = isTutorialTextColor(attributes.color ?? null)
            ? (attributes.color as TutorialTextColor)
            : 'default'
          return {
            [DATA_ATTR]: color,
            style: `color: ${TUTORIAL_TEXT_COLOR_VALUES[color]}`,
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
      setTutorialTextColor:
        (color: TutorialTextColor) =>
        ({ commands }) => {
          if (color === 'default') return commands.unsetMark(this.name)
          return commands.setMark(this.name, { color })
        },
      unsetTutorialTextColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})
