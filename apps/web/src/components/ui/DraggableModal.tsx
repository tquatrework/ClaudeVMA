/**
 * DraggableModal — fenêtre modale déplaçable, générique.
 *
 * Première brique de ce type dans le projet : les dialogues existants sont
 * tous fixes, non déplaçables, copiés-collés indépendamment (aucune
 * bibliothèque de drag dans `package.json`). Composant purement
 * présentationnel (`title`, `children`, `onClose`) — ne référence rien de
 * spécifique au Mémo ni à aucun autre domaine, réutilisable comme les autres
 * composants de `src/components/ui/`.
 *
 * Déplacement par événements pointer sur la poignée d'en-tête
 * (`onPointerDown`/`onPointerMove`/`onPointerUp`), translation via un état de
 * position — pas de nouvelle dépendance de type `react-draggable`. Fermeture
 * par Échap et par un bouton de fermeture. Piège de focus basique : le focus
 * est posé sur la modale à l'ouverture, et Tab en dernière position boucle
 * sur le bouton de fermeture (implémentation minimale, pas un système
 * d'accessibilité complet).
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'

export interface DraggableModalPosition {
  x: number
  y: number
}

interface DraggableModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  /** Position initiale relative au centre de l'écran (décalage en pixels). Par défaut centrée. */
  initialPosition?: DraggableModalPosition
}

const DEFAULT_POSITION: DraggableModalPosition = { x: 0, y: 0 }

export function DraggableModal({
  title,
  onClose,
  children,
  initialPosition = DEFAULT_POSITION,
}: DraggableModalProps) {
  const titleId = useId()
  const modalRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  const [position, setPosition] = useState<DraggableModalPosition>(initialPosition)
  const dragStateRef = useRef<{
    isDragging: boolean
    pointerStartX: number
    pointerStartY: number
    positionStartX: number
    positionStartY: number
  } | null>(null)

  // Focus initial sur la modale (piège de focus basique).
  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  // Fermeture par Échap.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      // Piège de focus minimal : Tab en dernière position (le bouton de
      // fermeture, seul élément interactif garanti présent) reboucle dessus.
      if (event.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // Bouton principal uniquement (souris) — un doigt/stylet n'a pas de bouton distinct.
    if (event.button !== undefined && event.button !== 0) return
    dragStateRef.current = {
      isDragging: true,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      positionStartX: position.x,
      positionStartY: position.y,
    }
    // Capture optionnelle : absente de jsdom (environnement de test), et pas
    // garantie sur tous les environnements réels — un déplacement reste
    // fonctionnel sans elle, seul le relâchement hors de la poignée devient
    // moins robuste.
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }, [position])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    if (!dragState?.isDragging) return
    setPosition({
      x: dragState.positionStartX + (event.clientX - dragState.pointerStartX),
      y: dragState.positionStartY + (event.clientY - dragState.pointerStartY),
    })
  }, [])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current) dragStateRef.current.isDragging = false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }, [])

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      {/* Recul non cliquant : contrairement aux tiroirs existants, la modale
          déplaçable n'a pas de fond opaque — l'utilisateur doit pouvoir
          continuer à consulter la page derrière pendant qu'il déplace la
          fenêtre. Un clic sur le fond ne ferme pas la modale (comportement
          volontaire d'une fenêtre flottante, distinct d'un tiroir/overlay). */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute top-1/2 left-1/2 w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col max-h-[80vh]"
        style={{
          transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
        }}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-indigo-50 rounded-t-xl cursor-move select-none"
        >
          <h2 id={titleId} className="text-sm font-semibold text-gray-900">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}
