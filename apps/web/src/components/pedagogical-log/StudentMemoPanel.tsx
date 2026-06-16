/**
 * StudentMemoPanel — panneau principal du mémo élève.
 * Affiche les chapitres + items. Permet la création (élève uniquement).
 * Formateurs et autres rôles voient le mémo en readonly (le backend renvoie 403 à l'écriture).
 *
 * Routes API :
 *   GET  /memos
 *   POST /memos/chapters
 *   POST /memos/chapters/:chapterId/items
 */

import React, { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  fetchMemoChapters,
  createMemoChapter,
  createMemoItem,
  type MemoChapter,
  type MemoItem,
  type MemoItemType,
} from '../../api/pedagogicalLog'
import MemoChapterEditor from './MemoChapterEditor'
import MemoItemEditor from './MemoItemEditor'
import MemoSearch from './MemoSearch'

export default function StudentMemoPanel() {
  const { hasRole } = useAuth()

  const [chapters, setChapters] = useState<MemoChapter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null)
  const [isAddingChapter, setIsAddingChapter] = useState(false)
  const [addingItemChapterId, setAddingItemChapterId] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const isEleve = hasRole('eleve')
  const canWrite = isEleve

  useEffect(() => {
    fetchMemoChapters()
      .then((fetchedChapters) => setChapters(fetchedChapters))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setErrorMessage('Accès refusé — le mémo est réservé à l\'élève')
        else setErrorMessage('Impossible de charger le mémo')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const handleChapterCreated = (newChapter: MemoChapter) => {
    setChapters((prev) => [...prev, newChapter])
    setIsAddingChapter(false)
    setExpandedChapterId(newChapter.id)
  }

  const handleItemCreated = (chapterId: string, newItem: MemoItem) => {
    setChapters((prev) =>
      prev.map((chapter) =>
        chapter.id === chapterId
          ? { ...chapter, items: [...chapter.items, newItem] }
          : chapter,
      ),
    )
    setAddingItemChapterId(null)
  }

  const toggleChapter = (chapterId: string) => {
    setExpandedChapterId((prev) => (prev === chapterId ? null : chapterId))
  }

  const itemTypeLabel: Record<MemoItemType, string> = {
    text: 'Texte',
    formula: 'Formule LaTeX',
    image: 'Image',
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Mon mémo</h2>
          {!isEleve && (
            <p className="text-xs text-amber-600 mt-0.5">Lecture seule — réservé à l'élève</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsSearchOpen((prev) => !prev)}
            className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            Rechercher
          </button>
          {canWrite && (
            <button
              onClick={() => setIsAddingChapter(true)}
              className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
            >
              + Chapitre
            </button>
          )}
        </div>
      </div>

      {/* Search panel */}
      {isSearchOpen && (
        <MemoSearch onClose={() => setIsSearchOpen(false)} />
      )}

      {/* Add chapter form */}
      {isAddingChapter && canWrite && (
        <MemoChapterEditor
          onSave={async (title) => {
            const newChapter = await createMemoChapter({ title })
            handleChapterCreated(newChapter)
          }}
          onCancel={() => setIsAddingChapter(false)}
        />
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      {isLoading && <p className="text-gray-400 text-sm">Chargement du mémo…</p>}

      {!isLoading && chapters.length === 0 && !errorMessage && (
        <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-400 text-sm">Aucun chapitre dans le mémo</p>
          {canWrite && (
            <p className="text-xs text-gray-300 mt-1">
              Cliquez sur "+ Chapitre" pour démarrer votre mémo.
            </p>
          )}
        </div>
      )}

      {/* Chapters list */}
      <ul className="space-y-3">
        {chapters.map((chapter) => (
          <li key={chapter.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Chapter header */}
            <button
              onClick={() => toggleChapter(chapter.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-800 text-sm">{chapter.title}</span>
              <span className="text-gray-400 text-xs ml-2">
                {chapter.items.length} item{chapter.items.length !== 1 ? 's' : ''}
                <span className="ml-2">{expandedChapterId === chapter.id ? '▲' : '▼'}</span>
              </span>
            </button>

            {/* Chapter content */}
            {expandedChapterId === chapter.id && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                {chapter.items.length === 0 && (
                  <p className="text-xs text-gray-400">Aucun item dans ce chapitre.</p>
                )}

                <ul className="space-y-2">
                  {chapter.items.map((item) => (
                    <li key={item.id} className="text-sm">
                      <span className="inline-block text-xs text-gray-400 mr-2">
                        [{itemTypeLabel[item.itemType]}]
                      </span>
                      {item.itemType === 'formula' ? (
                        <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs text-indigo-700">
                          {item.content}
                        </code>
                      ) : (
                        <span className="text-gray-700 whitespace-pre-wrap">{item.content}</span>
                      )}
                    </li>
                  ))}
                </ul>

                {/* Add item form */}
                {canWrite && addingItemChapterId === chapter.id ? (
                  <MemoItemEditor
                    onSave={async (itemType, content) => {
                      const newItem = await createMemoItem(chapter.id, { itemType, content })
                      handleItemCreated(chapter.id, newItem)
                    }}
                    onCancel={() => setAddingItemChapterId(null)}
                  />
                ) : (
                  canWrite && (
                    <button
                      onClick={() => setAddingItemChapterId(chapter.id)}
                      className="text-xs text-indigo-500 hover:underline mt-1"
                    >
                      + Ajouter un item
                    </button>
                  )
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
