/**
 * MemoFormulaInput — saisie d'une formule mathématique via MathLive
 * (`<math-field>`, web component auto-hébergé, aucun appel réseau externe).
 *
 * Décision arbitrée avec l'utilisateur (2026-08-27, voir le message de
 * lancement de ce chantier) : MathLive plutôt qu'une saisie LaTeX brute, pour
 * une saisie de formule « réellement facile » côté élève (clavier virtuel
 * mathématique, aperçu en temps réel pendant la frappe). Produit du LaTeX en
 * texte brut (`value`), rendu ensuite via KaTeX (`MathRenderer`) — jamais de
 * MathML ni de HTML stocké.
 *
 * Contrôlé comme les autres champs de ce projet : `value`/`onChange` en
 * props, la synchronisation avec le DOM du web component se fait par ref
 * impérative (un `<math-field>` n'est pas un `<input>` React standard — sa
 * valeur est une **propriété** DOM, pas un attribut, et il ne participe pas
 * au cycle de rendu contrôlé de React).
 *
 * Repli explicite si MathLive échoue à s'enregistrer comme élément
 * personnalisé (réseau capricieux au chargement du module, navigateur trop
 * ancien) : un `<textarea>` de saisie LaTeX brute, avec un message expliquant
 * pourquoi — jamais un champ silencieusement absent.
 */

import React, { useEffect, useRef, useState } from 'react'
import 'mathlive'
import type { MathfieldElement } from 'mathlive'
import { MathRenderer } from '../ui/MathRenderer'

interface MemoFormulaInputProps {
  id: string
  value: string
  onChange: (latex: string) => void
  placeholder?: string
}

/** Délai raisonnable pour laisser le module MathLive s'enregistrer au montage. */
const MATHLIVE_READY_TIMEOUT_MS = 2000

export function MemoFormulaInput({ id, value, onChange, placeholder }: MemoFormulaInputProps) {
  const fieldRef = useRef<MathfieldElement | null>(null)
  const [mathliveFailed, setMathliveFailed] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  // Vérifie que le web component s'est bien enregistré — sinon, repli textarea.
  useEffect(() => {
    let isCancelled = false
    const deadline = Date.now() + MATHLIVE_READY_TIMEOUT_MS

    const check = () => {
      if (isCancelled) return
      if (customElements.get('math-field')) {
        setIsChecking(false)
        return
      }
      if (Date.now() >= deadline) {
        setMathliveFailed(true)
        setIsChecking(false)
        return
      }
      setTimeout(check, 100)
    }
    check()

    return () => {
      isCancelled = true
    }
  }, [])

  // Synchronise `value` → propriété DOM du champ (le champ ne participe pas
  // au rendu contrôlé de React — c'est une propriété impérative).
  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    if (field.value !== value) field.value = value
  }, [value, mathliveFailed, isChecking])

  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    const handleInput = () => onChange(field.value)
    field.addEventListener('input', handleInput)
    return () => field.removeEventListener('input', handleInput)
  }, [onChange, isChecking])

  if (isChecking) {
    return <p className="text-xs text-gray-400">Chargement de l'éditeur de formule…</p>
  }

  if (mathliveFailed) {
    return (
      <div>
        <p className="text-xs text-amber-600 mb-1">
          L'éditeur de formule n'a pas pu se charger. Saisissez directement le code LaTeX.
        </p>
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder ?? 'ex : x^2 + y^2 = z^2'}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
        {value && (
          <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg">
            <MathRenderer latex={value} />
          </div>
        )}
      </div>
    )
  }

  return (
    <math-field
      ref={fieldRef}
      id={id}
      placeholder={placeholder ?? 'Saisissez une formule…'}
      // eslint-disable-next-line react/no-unknown-property -- attribut natif de mathlive
      virtual-keyboard-mode="onfocus"
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-indigo-400"
    />
  )
}
