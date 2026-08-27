/**
 * StudentMemoPanel — panneau principal du mémo élève.
 *
 * Réécrit le 2026-08-27 (chantier `feat/memo-formules`) pour le modèle
 * imbriqué réel : `GET /memos` renvoie directement les chapitres avec leurs
 * items, il n'y a plus de regroupement à faire côté client ni de section
 * « Général » (un item vit toujours dans un chapitre sur le contrat réel —
 * différence assumée avec l'ancien modèle, où un mémo pouvait rester sans
 * chapitre).
 *
 * Routes API :
 *   GET  /memos                     → liste les chapitres (avec items) de l'élève
 *   POST /memos/chapters            → créer un chapitre
 */

import React, { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { fetchMyMemo, createMemoChapter } from '../../api/pedagogicalLogMemos'
import type { MemoChapter, MemoItem } from '../../types/memo'
import { getMemoLoadErrorMessage, getMemoWriteErrorMessage, MEMO_LABELS } from '../../utils/memo'
import { MemoChapterSection } from './MemoChapterSection'
import MemoChapterEditor from './MemoChapterEditor'
import MemoSearch from './MemoSearch'

export default function StudentMemoPanel() {
  const { hasRole } = useAuth()

  const [chapters, setChapters] = useState<MemoChapter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isAddingChapter, setIsAddingChapter] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const isEleve = hasRole('eleve')
  const canWrite = isEleve

  useEffect(() => {
    // GET /memos est réservé à l'élève.
    if (!isEleve) {
      setIsLoading(false)
      return
    }
    let isCancelled = false
    fetchMyMemo()
      .then((fetchedChapters) => {
        if (!isCancelled) setChapters(fetchedChapters)
      })
      .catch((err) => {
        if (!isCancelled) setErrorMessage(getMemoLoadErrorMessage(err))
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false)
      })
    return () => {
      isCancelled = true
    }
  }, [isEleve])

  const handleCreateChapter = async (title: string) => {
    const created = await createMemoChapter({ title })
    setChapters((prev) => [...prev, { ...created, items: [] }])
    setIsAddingChapter(false)
  }

  const handleChapterRenamed = (chapterId: string, title: string) => {
    setChapters((prev) => prev.map((c) => (c.id === chapterId ? { ...c, title } : c)))
  }

  const handleChapterDeleted = (chapterId: string) => {
    setChapters((prev) => prev.filter((c) => c.id !== chapterId))
  }

  const handleItemCreated = (chapterId: string, item: MemoItem) => {
    setChapters((prev) =>
      prev.map((c) => (c.id === chapterId ? { ...c, items: [...c.items, item] } : c)),
    )
  }

  const handleItemDeleted = (chapterId: string, itemId: string) => {
    setChapters((prev) =>
      prev.map((c) =>
        c.id === chapterId ? { ...c, items: c.items.filter((item) => item.id !== itemId) } : c,
      ),
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Mon mémo</h2>
          {!isEleve && <p className="text-xs text-amber-600 mt-0.5">{MEMO_LABELS.readOnlyHint}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsSearchOpen((prev) => !prev)}
            className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            {MEMO_LABELS.search}
          </button>
          {canWrite && (
            <button
              onClick={() => setIsAddingChapter(true)}
              className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
            >
              {MEMO_LABELS.addChapter}
            </button>
          )}
        </div>
      </div>

      {/* Search panel */}
      {isSearchOpen && <MemoSearch onClose={() => setIsSearchOpen(false)} />}

      {/* Add chapter form */}
      {isAddingChapter && canWrite && (
        <MemoChapterEditor
          onSave={handleCreateChapter}
          onCancel={() => setIsAddingChapter(false)}
          translateError={getMemoWriteErrorMessage}
        />
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      {isLoading && <p className="text-gray-400 text-sm">{MEMO_LABELS.loading}</p>}

      {!isLoading && chapters.length === 0 && !errorMessage && (
        <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-400 text-sm">{MEMO_LABELS.emptyMemo}</p>
          {canWrite && (
            <p className="text-xs text-gray-300 mt-1">
              Créez d'abord un chapitre, puis ajoutez-y vos notes.
            </p>
          )}
        </div>
      )}

      {!isLoading && !errorMessage && chapters.length > 0 && (
        <div className="space-y-4">
          {chapters.map((chapter) => (
            <MemoChapterSection
              key={chapter.id}
              chapter={chapter}
              canWrite={canWrite}
              onChapterRenamed={handleChapterRenamed}
              onChapterDeleted={handleChapterDeleted}
              onItemCreated={handleItemCreated}
              onItemDeleted={handleItemDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
