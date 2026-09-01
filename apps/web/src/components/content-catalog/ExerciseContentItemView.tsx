/**
 * ExerciseContentItemView — rendu en lecture seule d'un item de bloc d'exercice (texte, formule
 * ou image), selon son type. Même patron que `MemoItemDisplay`.
 */

import React from 'react'
import { LightMarkupText } from '../ui/LightMarkupText'
import { MathRenderer } from '../ui/MathRenderer'
import { useExercisePartImageUrl } from '../../hooks/content-catalog/useExercisePartImageUrl'
import type { PublicContentItem } from '../../types/exercise'

interface ExerciseContentItemViewProps {
  exerciseId: string
  item: PublicContentItem
}

export function ExerciseContentItemView({ exerciseId, item }: ExerciseContentItemViewProps) {
  if (item.type === 'formula') {
    return (
      <div className="px-3 py-2 bg-gray-50 rounded-lg">
        <MathRenderer latex={item.content ?? ''} />
      </div>
    )
  }

  if (item.type === 'image') {
    return <ExercisePartImage exerciseId={exerciseId} item={item} />
  }

  return (
    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
      <LightMarkupText text={item.content ?? ''} />
    </p>
  )
}

function ExercisePartImage({ exerciseId, item }: { exerciseId: string; item: PublicContentItem }) {
  const { imageUrl, isLoading, error } = useExercisePartImageUrl(exerciseId, item.id)

  if (isLoading) {
    return <p className="text-xs text-gray-400">Chargement de l'image…</p>
  }

  if (error || !imageUrl) {
    return <p className="text-xs text-red-500">{error ?? "Cette image n'a pas pu être affichée."}</p>
  }

  return (
    <figure>
      <img src={imageUrl} alt={item.content ?? 'Image'} className="max-w-full rounded-lg border border-gray-200" />
      {item.content && <figcaption className="text-xs text-gray-500 mt-1">{item.content}</figcaption>}
    </figure>
  )
}
