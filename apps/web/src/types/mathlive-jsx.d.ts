/**
 * Déclaration JSX pour le web component `<math-field>` de MathLive.
 *
 * MathLive fournit ses propres types TypeScript (`MathfieldElement`, qui
 * étend `HTMLElement`) mais aucune augmentation `JSX.IntrinsicElements` pour
 * React — c'est un composant web générique, pas une bibliothèque React.
 * Sans cette déclaration, `<math-field>` dans un fichier `.tsx` échoue à la
 * compilation (« Property 'math-field' does not exist on type
 * 'JSX.IntrinsicElements' »).
 */

import type { MathfieldElement } from 'mathlive'
import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': DetailedHTMLProps<HTMLAttributes<MathfieldElement>, MathfieldElement> & {
        'virtual-keyboard-mode'?: 'auto' | 'manual' | 'onfocus' | 'off'
        'read-only'?: boolean
        placeholder?: string
      }
    }
  }
}
