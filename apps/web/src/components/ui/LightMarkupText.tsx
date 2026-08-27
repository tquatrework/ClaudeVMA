/**
 * LightMarkupText — rend un texte brut en interprétant la syntaxe légère du
 * projet (`src/utils/lightMarkup.ts`) : liens `[label](url)`, transformés en
 * vrais liens cliquables (`target="_blank"`, `rel="noopener noreferrer"`), et
 * notation mathématique `$...$`/`$$...$$`, rendue via `MathRenderer` (KaTeX).
 * Le reste du texte est affiché tel quel, sans aucune transformation ni
 * assainissement HTML — c'est un remplacement de segments texte/lien/math
 * détectés par un motif fixe, jamais un rendu de balisage arbitraire fourni
 * par l'utilisateur.
 *
 * Présentationnel, sans état : à utiliser à l'intérieur d'un conteneur qui
 * porte déjà `whitespace-pre-wrap` (le composant ne rend qu'un fragment de
 * texte/liens/formules en ligne, il ne redéfinit pas la mise en forme du bloc).
 */

import React from 'react'
import { parseLightMarkup } from '../../utils/lightMarkup'
import { MathRenderer } from './MathRenderer'

interface LightMarkupTextProps {
  text: string
}

export function LightMarkupText({ text }: LightMarkupTextProps) {
  const segments = parseLightMarkup(text)

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'link') {
          return (
            <a
              key={index}
              href={segment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              {segment.label}
            </a>
          )
        }
        if (segment.type === 'math') {
          return <MathRenderer key={index} latex={segment.latex} displayMode={segment.displayMode} />
        }
        return <React.Fragment key={index}>{segment.value}</React.Fragment>
      })}
    </>
  )
}
