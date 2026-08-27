/**
 * MemoReadOnlyContent — vue de lecture du mémo d'un élève, à l'intérieur
 * d'une `DraggableModal`. Chapitres listés, items rendus selon leur type :
 * texte via `LightMarkupText` (liens et maths inline reconnus), formule via
 * `MathRenderer`, image via `MemoImageItemView` (téléchargement authentifié).
 *
 * Purement présentationnel — chargement/erreur gérés par l'appelant
 * (`MemoReadOnlyModal`), qui possède l'état de la donnée (règle du
 * 2026-08-10 : une donnée de page appartient à la page, pas à un enfant).
 *
 * Filtre par chapitre (« Tous les chapitres » par défaut) : état purement
 * local, UI éphémère plutôt qu'une donnée du modèle — ne remonte donc pas au
 * parent. `initialChapterId` permet à l'appelant de préselectionner un
 * chapitre (ex. lien « Détacher » posé sur un chapitre précis).
 */

import React, { useState } from 'react'
import type { MemoChapter } from '../../types/memo'
import { MemoItemDisplay } from './MemoItemDisplay'
import { MEMO_LABELS } from '../../utils/memo'

const ALL_CHAPTERS_OPTION_VALUE = 'all'

interface MemoReadOnlyContentProps {
  chapters: MemoChapter[] | null
  isLoading: boolean
  error: string | null
  /** Préselectionne un chapitre au premier rendu — `null`/absent = « Tous les chapitres ». */
  initialChapterId?: string | null
}

export function MemoReadOnlyContent({
  chapters,
  isLoading,
  error,
  initialChapterId = null,
}: MemoReadOnlyContentProps) {
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(initialChapterId)

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

  const chaptersToDisplay = selectedChapterId
    ? nonEmptyChapters.filter((chapter) => chapter.id === selectedChapterId)
    : nonEmptyChapters

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="memo-chapter-filter" className="sr-only">
          {MEMO_LABELS.chapterFilterLabel}
        </label>
        <select
          id="memo-chapter-filter"
          value={selectedChapterId ?? ALL_CHAPTERS_OPTION_VALUE}
          onChange={(event) =>
            setSelectedChapterId(
              event.target.value === ALL_CHAPTERS_OPTION_VALUE ? null : event.target.value,
            )
          }
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value={ALL_CHAPTERS_OPTION_VALUE}>{MEMO_LABELS.allChapters}</option>
          {nonEmptyChapters.map((chapter) => (
            <option key={chapter.id} value={chapter.id}>
              {chapter.title}
            </option>
          ))}
        </select>
      </div>

      {chaptersToDisplay.length === 0 ? (
        <p className="text-gray-400 text-sm">{MEMO_LABELS.emptyMemo}</p>
      ) : (
        chaptersToDisplay.map((chapter) => (
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
        ))
      )}
    </div>
  )
}
