/**
 * MemoItemDisplay — rendu (sans action) d'un item de mémo selon son type.
 * Partagé entre la vue de lecture d'un tiers (`MemoReadOnlyContent`) et le
 * panneau d'édition de l'élève (`StudentMemoPanel`), pour ne pas dupliquer la
 * logique de rendu par type entre les deux.
 */

import React from 'react'
import type { MemoItem } from '../../types/memo'
import { MemoImageItemView } from './MemoImageItemView'
import { LightMarkupText } from '../ui/LightMarkupText'
import { MathRenderer } from '../ui/MathRenderer'

interface MemoItemDisplayProps {
  item: MemoItem
}

export function MemoItemDisplay({ item }: MemoItemDisplayProps) {
  if (item.type === 'formula') {
    return (
      <div className="px-3 py-2 bg-gray-50 rounded-lg">
        <MathRenderer latex={item.content} />
      </div>
    )
  }
  if (item.type === 'image') {
    return <MemoImageItemView item={item} />
  }
  return (
    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
      <LightMarkupText text={item.content} />
    </p>
  )
}
