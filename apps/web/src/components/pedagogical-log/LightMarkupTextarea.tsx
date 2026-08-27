/**
 * LightMarkupTextarea — `<textarea>` classique surmonté d'un calque de
 * coloration syntaxique, pour donner un retour visuel immédiat sur un lien
 * `[label](url)` (`src/utils/lightMarkup.ts`) **pendant la saisie**, avant
 * même de valider l'entrée.
 *
 * Correctif du 2026-08-27 (défaut mineur remonté par test utilisateur) : le
 * motif `[label](url)` restait affiché tel quel — crochets compris — tant que
 * l'entrée n'était pas enregistrée, alors qu'il s'affiche en lien bleu
 * cliquable une fois relu via `LightMarkupText`. Décalage perturbant.
 *
 * Tension avec l'arbitrage du 2026-08-26 (« Syntaxe legere unifiee pour le
 * texte enrichi », `docs/architecture.md`) : un éditeur riche (contenteditable
 * généraliste, stockage HTML) est explicitement écarté — le champ stocké
 * (`sessionSummary`/`homework`) doit rester du texte brut. Ce composant ne
 * rouvre pas cet arbitrage :
 * - la **source de vérité reste le `<textarea>` natif** — `value`/`onChange`
 *   portent toujours le texte brut `[label](url)`, jamais du HTML ni un état
 *   dérivé d'un DOM éditable ;
 * - le calque de coloration (`<div aria-hidden>` positionné derrière/au-dessus
 *   avec `pointer-events: none`) est **purement décoratif** : il ne reçoit
 *   jamais la saisie, ne modifie jamais `value`, et disparaît de l'arbre
 *   accessible (`aria-hidden="true"`) ;
 * - aucun HTML n'est jamais stocké ni envoyé — seul le texte brut transite via
 *   `onChange`, exactement comme un `<textarea>` non modifié ;
 * - le ref exposé (`forwardRef`) est un **vrai `HTMLTextAreaElement`**, donc
 *   `InsertLinkButton` (qui lit `selectionStart`/`selectionEnd` sur ce ref)
 *   continue de fonctionner sans aucune adaptation.
 *
 * Technique : le texte réel du `<textarea>` est rendu **transparent**
 * (`text-transparent`, `caret-*` visible), le calque affiche le même texte
 * segmenté par `parseLightMarkup` avec les liens mis en valeur (bleu,
 * souligné). Les deux éléments partagent exactement la même police, la même
 * taille de texte, le même remplissage (`padding`) et la même largeur de
 * bordure (bordure transparente sur le calque) pour que les caractères
 * restent alignés au pixel près — un calque qui masquerait les crochets
 * (au lieu de les recolorer) déciderait des caractères différents entre les
 * deux couches et désynchroniserait la position du curseur natif du
 * `<textarea>`, qui reste la seule source de positionnement réelle.
 */

import React, { forwardRef, useRef } from 'react'
import { parseLightMarkup } from '../../utils/lightMarkup'

interface LightMarkupTextareaProps {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  /** Couleur de bordure du `<textarea>` — `border-gray-300` (création) ou `border-indigo-300` (édition inline). */
  borderClassName?: string
}

export const LightMarkupTextarea = forwardRef<HTMLTextAreaElement, LightMarkupTextareaProps>(
  function LightMarkupTextarea(
    { id, value, onChange, placeholder, rows = 3, borderClassName = 'border-gray-300' },
    forwardedRef,
  ) {
    const overlayRef = useRef<HTMLDivElement>(null)
    const localRef = useRef<HTMLTextAreaElement | null>(null)

    const assignRef = (node: HTMLTextAreaElement | null) => {
      localRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        // eslint-disable-next-line no-param-reassign
        ;(forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node
      }
    }

    // Le `<textarea>` peut défiler (contenu qui dépasse `rows`, `resize-none`) :
    // le calque doit suivre le même défilement pour rester aligné.
    const syncOverlayScroll = () => {
      if (overlayRef.current && localRef.current) {
        overlayRef.current.scrollTop = localRef.current.scrollTop
        overlayRef.current.scrollLeft = localRef.current.scrollLeft
      }
    }

    const segments = parseLightMarkup(value)

    return (
      <div className="relative">
        <div
          ref={overlayRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent px-3 py-2 text-sm"
        >
          {segments.map((segment, index) =>
            segment.type === 'link' ? (
              <span key={index} className="text-indigo-600 underline">
                [{segment.label}]({segment.url})
              </span>
            ) : (
              <React.Fragment key={index}>{segment.value}</React.Fragment>
            ),
          )}
        </div>
        <textarea
          id={id}
          ref={assignRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncOverlayScroll}
          placeholder={placeholder}
          rows={rows}
          className={`w-full resize-none rounded-lg border ${borderClassName} bg-white px-3 py-2 text-sm text-transparent placeholder-gray-400 caret-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400`}
        />
      </div>
    )
  },
)
