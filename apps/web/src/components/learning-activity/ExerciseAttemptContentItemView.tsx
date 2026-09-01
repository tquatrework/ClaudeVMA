/**
 * ExerciseAttemptContentItemView — rendu en lecture seule d'un item de solution révélée sur une
 * tentative d'exercice (texte, formule ou image). Même patron que `ExerciseContentItemView`, côté
 * learning-activity-service (image servie par un proxy authentifié distinct).
 */

import React from 'react'
import { LightMarkupText } from '../ui/LightMarkupText'
import { MathRenderer } from '../ui/MathRenderer'
import { useExerciseAttemptImageUrl } from '../../hooks/learning-activity/useExerciseAttemptImageUrl'
import type { PublicContentItem } from '../../types/exercise'

interface ExerciseAttemptContentItemViewProps {
  attemptId: string
  item: PublicContentItem
}

export function ExerciseAttemptContentItemView({
  attemptId,
  item,
}: ExerciseAttemptContentItemViewProps) {
  if (item.type === 'formula') {
    return (
      <div className="px-3 py-2 bg-white rounded-lg">
        <MathRenderer latex={item.content ?? ''} />
      </div>
    )
  }

  if (item.type === 'image') {
    return <ExerciseAttemptImage attemptId={attemptId} item={item} />
  }

  return (
    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
      <LightMarkupText text={item.content ?? ''} />
    </p>
  )
}

function ExerciseAttemptImage({ attemptId, item }: { attemptId: string; item: PublicContentItem }) {
  const { imageUrl, isLoading, error } = useExerciseAttemptImageUrl(attemptId, item.id)

  if (isLoading) {
    return <p className="text-xs text-gray-400">Chargement de l'image…</p>
  }

  if (error || !imageUrl) {
    return <p className="text-xs text-red-500">{error ?? "Cette image n'a pas pu être affichée."}</p>
  }

  return (
    <figure>
      <img src={imageUrl} alt={item.content ?? 'Image de la solution'} className="max-w-full rounded-lg border border-gray-200" />
      {item.content && <figcaption className="text-xs text-gray-500 mt-1">{item.content}</figcaption>}
    </figure>
  )
}
