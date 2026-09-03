/**
 * TutorialQuizLinkPicker — sélection optionnelle d'un Quizz existant à lier en fin de tutoriel
 * (`linkedQuizId`). Recherche par mot-clé (réutilise `searchQuizzes`, même route que le catalogue
 * Quizz), sélection dans les résultats, et affichage du titre du Quizz déjà lié le cas échéant —
 * jamais l'identifiant technique affiché (règle du 2026-08-09), toujours un titre.
 */

import React, { useEffect, useState } from 'react'
import { fetchQuiz, searchQuizzes } from '../../api/quizzes'
import { getErrorMessage } from '../../utils/apiError'
import type { QuizSummary } from '../../types/quiz'

interface TutorialQuizLinkPickerProps {
  value: string | null
  onChange: (quizId: string | null) => void
  isSubmitting: boolean
}

const SEARCH_LIMIT = 10

export function TutorialQuizLinkPicker({ value, onChange, isSubmitting }: TutorialQuizLinkPickerProps) {
  const [linkedQuizTitle, setLinkedQuizTitle] = useState<string | null>(null)
  const [isResolvingTitle, setIsResolvingTitle] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<QuizSummary[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Résout le titre d'un lien déjà présent (édition, ou juste choisi depuis une autre session) —
  // jamais l'UUID affiché à l'écran (règle du 2026-08-09).
  useEffect(() => {
    if (!value) {
      setLinkedQuizTitle(null)
      return
    }
    let isCancelled = false
    setIsResolvingTitle(true)
    fetchQuiz(value)
      .then((quiz) => {
        if (!isCancelled) setLinkedQuizTitle(quiz.title)
      })
      .catch(() => {
        if (!isCancelled) setLinkedQuizTitle(null)
      })
      .finally(() => {
        if (!isCancelled) setIsResolvingTitle(false)
      })
    return () => {
      isCancelled = true
    }
  }, [value])

  const handleSearchSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSearching(true)
    setSearchError(null)
    try {
      const result = await searchQuizzes({ keyword: keyword.trim() || undefined, limit: SEARCH_LIMIT })
      setResults(result.items)
    } catch (caughtError: unknown) {
      setSearchError(getErrorMessage(caughtError, 'Impossible de rechercher un quizz.'))
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelect = (quiz: QuizSummary) => {
    onChange(quiz.id)
    setLinkedQuizTitle(quiz.title)
    setIsPickerOpen(false)
    setResults([])
    setKeyword('')
  }

  const handleClear = () => {
    onChange(null)
    setLinkedQuizTitle(null)
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs text-gray-600">Quizz lié en fin de tutoriel (optionnel)</label>

      {value ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-800 bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
            {isResolvingTitle ? 'Chargement…' : (linkedQuizTitle ?? 'Quizz introuvable')}
          </span>
          <button
            type="button"
            onClick={handleClear}
            disabled={isSubmitting}
            className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            Retirer le lien
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Aucun quizz lié.</p>
      )}

      {!isPickerOpen ? (
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          disabled={isSubmitting}
          className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          {value ? 'Changer le quizz lié' : '+ Lier un quizz'}
        </button>
      ) : (
        <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-white">
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Rechercher un quizz par titre"
              disabled={isSubmitting}
              className="flex-1 min-w-[10rem] border border-gray-300 rounded-md px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={isSubmitting || isSearching}
              className="px-3 py-1 text-xs font-medium text-white bg-gray-700 rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {isSearching ? 'Recherche…' : 'Rechercher'}
            </button>
            <button
              type="button"
              onClick={() => setIsPickerOpen(false)}
              className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
            >
              Fermer
            </button>
          </form>

          {searchError && <p className="text-xs text-red-600">{searchError}</p>}

          {results.length > 0 && (
            <ul className="space-y-1">
              {results.map((quiz) => (
                <li key={quiz.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(quiz)}
                    className="w-full text-left text-sm px-2 py-1 rounded hover:bg-indigo-50"
                  >
                    {quiz.title}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!isSearching && results.length === 0 && (
            <p className="text-xs text-gray-400">Aucun résultat pour l'instant.</p>
          )}
        </div>
      )}
    </div>
  )
}
