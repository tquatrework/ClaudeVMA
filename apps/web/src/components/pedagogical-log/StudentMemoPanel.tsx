/**
 * StudentMemoPanel — panneau principal du mémo élève.
 * Affiche les mémos groupés par chapitre. Permet la création (élève uniquement).
 * Formateurs et autres rôles voient un message readonly (le backend renvoie 403 à l'écriture).
 *
 * Routes API :
 *   GET  /memos               → liste tous les mémos de l'élève
 *   GET  /memos/chapters      → liste les chapitres de l'élève
 *   POST /memos               → créer un mémo (avec chapterId optionnel)
 *   POST /memos/chapters      → créer un chapitre
 */

import React, { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  fetchMemos,
  fetchMemoChapters,
  createMemo,
  createMemoChapter,
  type Memo,
  type MemoChapter,
} from '../../api/pedagogicalLogMemos'
import MemoChapterEditor from './MemoChapterEditor'
import MemoItemEditor from './MemoItemEditor'
import MemoSearch from './MemoSearch'

export default function StudentMemoPanel() {
  const { hasRole } = useAuth()

  const [memos, setMemos] = useState<Memo[]>([])
  const [chapters, setChapters] = useState<MemoChapter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isAddingChapter, setIsAddingChapter] = useState(false)
  const [isAddingMemo, setIsAddingMemo] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const isEleve = hasRole('eleve')
  const canWrite = isEleve

  useEffect(() => {
    // GET /memos et /memos/chapters sont réservés à l'élève
    if (!isEleve) {
      setIsLoading(false)
      return
    }
    Promise.all([fetchMemos(), fetchMemoChapters()])
      .then(([fetchedMemos, fetchedChapters]) => {
        setMemos(fetchedMemos)
        setChapters(fetchedChapters)
      })
      .catch((err) => {
        const httpStatus = err?.response?.status
        if (httpStatus === 403) setErrorMessage('Accès refusé au mémo — vérifiez votre session')
        else setErrorMessage('Impossible de charger le mémo')
      })
      .finally(() => setIsLoading(false))
  }, [isEleve])

  const handleChapterCreated = (newChapter: MemoChapter) => {
    setChapters((prev) => [...prev, newChapter])
    setIsAddingChapter(false)
  }

  const handleMemoCreated = (newMemo: Memo) => {
    setMemos((prev) => [...prev, newMemo])
    setIsAddingMemo(false)
  }

  // Grouper les mémos par chapitre
  const memosByChapterId = memos.reduce<Record<string, Memo[]>>((accumulator, memo) => {
    const chapterKey = memo.chapterId ?? '__general__'
    if (!accumulator[chapterKey]) accumulator[chapterKey] = []
    accumulator[chapterKey].push(memo)
    return accumulator
  }, {})

  const generalMemos = memosByChapterId['__general__'] ?? []

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
            <>
              <button
                onClick={() => setIsAddingMemo(true)}
                className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
              >
                + Mémo
              </button>
              <button
                onClick={() => setIsAddingChapter(true)}
                className="text-sm border border-indigo-300 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50"
              >
                + Chapitre
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search panel */}
      {isSearchOpen && (
        <MemoSearch onClose={() => setIsSearchOpen(false)} />
      )}

      {/* Add memo form */}
      {isAddingMemo && canWrite && (
        <MemoItemEditor
          chapters={chapters}
          onSave={async (title, content, chapterId) => {
            const newMemo = await createMemo({ title, content, chapterId })
            handleMemoCreated(newMemo)
          }}
          onCancel={() => setIsAddingMemo(false)}
        />
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

      {!isLoading && memos.length === 0 && chapters.length === 0 && !errorMessage && (
        <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-400 text-sm">Aucune note dans le mémo</p>
          {canWrite && (
            <p className="text-xs text-gray-300 mt-1">
              Cliquez sur "+ Mémo" pour ajouter votre première note.
            </p>
          )}
        </div>
      )}

      {!isLoading && !errorMessage && (
        <div className="space-y-4">
          {/* Section Général — mémos sans chapitre */}
          {(generalMemos.length > 0 || canWrite) && (
            <section>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                Général
              </h3>
              {generalMemos.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucune note dans la section générale.</p>
              ) : (
                <ul className="space-y-2">
                  {generalMemos.map((memo) => (
                    <MemoCard key={memo.id} memo={memo} />
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Sections par chapitre */}
          {chapters.map((chapter) => {
            const chapterMemos = memosByChapterId[chapter.id] ?? []
            return (
              <section key={chapter.id}>
                <h3 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-1 mb-2">
                  {chapter.title}
                </h3>
                {chapterMemos.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Aucune note dans ce chapitre.</p>
                ) : (
                  <ul className="space-y-2">
                    {chapterMemos.map((memo) => (
                      <MemoCard key={memo.id} memo={memo} />
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Composant carte mémo ─────────────────────────────────────────────────────

interface MemoCardProps {
  memo: Memo
}

function MemoCard({ memo }: MemoCardProps) {
  return (
    <li className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <p className="text-sm font-medium text-gray-800">{memo.title}</p>
      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{memo.content}</p>
      <p className="text-xs text-gray-400 mt-2">
        {new Date(memo.createdAt).toLocaleDateString('fr-FR')}
      </p>
    </li>
  )
}
