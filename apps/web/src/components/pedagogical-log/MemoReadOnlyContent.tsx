/**
 * MemoReadOnlyContent — vue de lecture du mémo d'un élève, à l'intérieur
 * d'une `DraggableModal`. Chapitres listés, items rendus selon leur type :
 * texte via `LightMarkupText` (liens et maths inline reconnus), formule via
 * `MathRenderer`, image via `MemoImageItemView` (téléchargement authentifié).
 *
 * Purement présentationnel — chargement/erreur gérés par l'appelant
 * (`MemoReadOnlyModal`), qui possède l'état de la donnée (règle du
 * 2026-08-10 : une donnée de page appartient à la page, pas à un enfant).
 */

import React from 'react'
import type { MemoChapter } from '../../types/memo'
import { MemoItemDisplay } from './MemoItemDisplay'
import { MEMO_LABELS } from '../../utils/memo'

interface MemoReadOnlyContentProps {
  chapters: MemoChapter[] | null
  isLoading: boolean
  error: string | null
}

export function MemoReadOnlyContent({ chapters, isLoading, error }: MemoReadOnlyContentProps) {
  if (isLoading) {
    return <p className="text-gray-400 text-sm">{MEMO_LABELS.loading}</p>
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error}
      </div>
    )
  }

  const nonEmptyChapters = chapters ?? []

  if (nonEmptyChapters.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-400 text-sm">{MEMO_LABELS.emptyMemo}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {nonEmptyChapters.map((chapter) => (
        <section key={chapter.id}>
          <h3 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-1 mb-2">
            {chapter.title}
          </h3>
          {chapter.items.length === 0 ? (
            <p className="text-xs text-gray-400 italic">{MEMO_LABELS.emptyChapter}</p>
          ) : (
            <ul className="space-y-2">
              {chapter.items.map((item) => (
                <li key={item.id} className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                  <MemoItemDisplay item={item} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
