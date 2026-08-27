/**
 * MathRenderer — rend une chaîne LaTeX via KaTeX.
 *
 * Placé dans `src/components/ui/` plutôt que `src/components/pedagogical-log/`
 * (emplacement initialement envisagé pour le chantier Mémo) : c'est un
 * composant purement présentationnel, sans aucune notion de mémo, de
 * chapitre ou d'item — et `LightMarkupText` (déjà dans `ui/`, réutilisé bien
 * au-delà du Mémo, y compris par `ActivityDetailPage`) doit pouvoir rendre un
 * segment `math` sans faire dépendre `ui/` d'un dossier de domaine. Réutilisé
 * par l'éditeur de formule du Mémo (aperçu) et sa vue de lecture, comme prévu.
 *
 * Texte brut stocké, transformé à l'affichage uniquement — même principe que
 * les liens (`docs/architecture.md` > « Syntaxe legere unifiee »).
 */

import React, { useEffect, useRef, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MathRendererProps {
  latex: string
  /** `true` pour un bloc centré (`$$...$$`), `false` pour une formule en ligne (`$...$`). */
  displayMode?: boolean
  className?: string
}

/**
 * Un LaTeX invalide ne doit jamais faire planter la page qui l'affiche
 * (`katex.render` lève une exception sur une syntaxe mal formée) — on
 * affiche alors le code brut, avec un indice visuel discret, plutôt qu'un
 * écran blanc.
 */
export function MathRenderer({ latex, displayMode = false, className }: MathRendererProps) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const [hasRenderError, setHasRenderError] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    try {
      katex.render(latex, container, {
        displayMode,
        throwOnError: true,
        output: 'html',
      })
      setHasRenderError(false)
    } catch {
      container.textContent = ''
      setHasRenderError(true)
    }
  }, [latex, displayMode])

  return (
    <span className={className}>
      <span ref={containerRef} />
      {hasRenderError && (
        <span className="text-red-500 text-sm">
          Formule illisible : <code className="font-mono">{latex}</code>
        </span>
      )}
    </span>
  )
}
