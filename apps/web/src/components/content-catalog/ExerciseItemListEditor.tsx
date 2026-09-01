/**
 * ExerciseItemListEditor — édition d'une liste ordonnée d'items texte/formule.
 *
 * Réutilisé deux fois par `ExercisePartEditor` : pour les items d'un bloc énoncé/question, et pour
 * les items de la solution d'un bloc question. Les items de type `image` ne peuvent pas être créés
 * ici — le serveur les refuse dans le DTO JSON. **Depuis le 2026-09-01, l'image n'est plus un item
 * embarqué dans un bloc énoncé/question : c'est un bloc de premier niveau à part entière**
 * (`category: 'image'`), édité par `ExerciseImageBlockEditor`, jamais par ce composant — voir
 * `docs/architecture.md` > « Bloc "image" de premier niveau pour l'Exercice ».
 *
 * Réutilise directement le mécanisme de saisie de formule déjà construit pour le Quizz/le Mémo
 * (`InsertFormulaButton`, `LightMarkupText`/`MathRenderer` pour l'aperçu).
 *
 * Le bouton générique « + Ajouter un élément » a été retiré le 2026-09-01 (arbitrage « Titre des
 * Exercices et des Quizz », point 5) : le texte se saisit directement dans l'item déjà présent, et
 * la formule dispose déjà de sa propre affordance d'insertion (`InsertFormulaButton`) — le bouton
 * n'a donc plus de raison d'exister pour ces deux types.
 */

import React, { useRef } from 'react'
import { InsertFormulaButton } from '../ui/InsertFormulaButton'
import { LightMarkupText } from '../ui/LightMarkupText'
import { MathRenderer } from '../ui/MathRenderer'
import type { ExerciseItemType } from '../../types/exercise'

export interface EditableExerciseItem {
  localId: string
  type: Extract<ExerciseItemType, 'text' | 'formula'>
  content: string
}

let itemCounter = 0
export function createEditableExerciseItem(
  type: EditableExerciseItem['type'] = 'text',
): EditableExerciseItem {
  itemCounter += 1
  return { localId: `item-${itemCounter}`, type, content: '' }
}

interface ExerciseItemListEditorProps {
  items: EditableExerciseItem[]
  onChange: (items: EditableExerciseItem[]) => void
  isSubmitting: boolean
  /** Préfixe affiché devant chaque numéro d'item (« Élément 1 », « Solution 1 »…). */
  itemLabelPrefix: string
}

export function ExerciseItemListEditor({
  items,
  onChange,
  isSubmitting,
  itemLabelPrefix,
}: ExerciseItemListEditorProps) {
  const fieldRefs = useRef<Map<string, HTMLTextAreaElement | null>>(new Map())

  const updateItem = (localId: string, patch: Partial<EditableExerciseItem>) => {
    onChange(items.map((item) => (item.localId === localId ? { ...item, ...patch } : item)))
  }

  const removeItem = (localId: string) => {
    onChange(items.filter((item) => item.localId !== localId))
  }

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= items.length) return
    const reordered = [...items]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    onChange(reordered)
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={item.localId} className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-gray-600">
              {itemLabelPrefix} {index + 1}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={item.type}
                onChange={(e) =>
                  updateItem(item.localId, { type: e.target.value as EditableExerciseItem['type'] })
                }
                disabled={isSubmitting}
                className="border border-gray-300 rounded-md px-2 py-1 text-xs bg-white"
              >
                <option value="text">Texte</option>
                <option value="formula">Formule</option>
              </select>
              <button
                type="button"
                onClick={() => moveItem(index, -1)}
                disabled={isSubmitting || index === 0}
                className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
                aria-label={`Déplacer ${itemLabelPrefix.toLowerCase()} ${index + 1} vers le haut`}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, 1)}
                disabled={isSubmitting || index === items.length - 1}
                className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
                aria-label={`Déplacer ${itemLabelPrefix.toLowerCase()} ${index + 1} vers le bas`}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeItem(item.localId)}
                disabled={isSubmitting || items.length <= 1}
                className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-30"
                aria-label={`Supprimer ${itemLabelPrefix.toLowerCase()} ${index + 1}`}
              >
                ✕
              </button>
            </div>
          </div>

          <textarea
            ref={(el) => {
              fieldRefs.current.set(item.localId, el)
            }}
            value={item.content}
            onChange={(e) => updateItem(item.localId, { content: e.target.value })}
            placeholder={
              item.type === 'formula'
                ? 'Formule LaTeX, ex : x^2 + y^2 = z^2'
                : 'Texte libre — vous pouvez insérer une formule $x^2$'
            }
            rows={item.type === 'formula' ? 2 : 3}
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm resize-y font-mono"
          />

          {item.type === 'text' && (
            <InsertFormulaButton
              fieldLabel={`${itemLabelPrefix} ${index + 1}`}
              fieldRef={{ current: fieldRefs.current.get(item.localId) ?? null }}
              value={item.content}
              onChange={(value) => updateItem(item.localId, { content: value })}
            />
          )}

          {item.content.trim() !== '' && (
            <div className="text-xs text-gray-500 border-t border-gray-100 pt-2">
              Aperçu :{' '}
              {item.type === 'formula' ? (
                <MathRenderer latex={item.content} />
              ) : (
                <LightMarkupText text={item.content} />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
