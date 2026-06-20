/**
 * MemoSearch — composant de recherche dans le mémo élève.
 * Route API : GET /memos/search?q=
 * Élève uniquement (le backend renvoie 403 aux autres rôles).
 */

import React, { useState, useRef, useEffect } from 'react'
import { searchMemos, type Memo } from '../../api/pedagogicalLog'

interface MemoSearchProps {
  onClose: () => void
}

export default function MemoSearch({ onClose }: MemoSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Memo[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery) return

    setIsSearching(true)
    setErrorMessage(null)
    setHasSearched(true)
    try {
      const results = await searchMemos(trimmedQuery)
      setSearchResults(results)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) setErrorMessage('Accès refusé — la recherche est réservée à l\'élève')
      else if (status === 400) setErrorMessage('La recherche ne peut pas être vide')
      else setErrorMessage('Erreur lors de la recherche')
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Recherche dans le mémo</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
          ✕
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher dans mes notes…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit"
          disabled={isSearching || !searchQuery.trim()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSearching ? '…' : 'Chercher'}
        </button>
      </form>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      {hasSearched && !isSearching && !errorMessage && searchResults.length === 0 && (
        <p className="text-sm text-gray-400">Aucun résultat pour "{searchQuery}"</p>
      )}

      {searchResults.length > 0 && (
        <ul className="space-y-2">
          {searchResults.map((memo) => (
            <li
              key={memo.id}
              className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2"
            >
              <p className="text-sm font-medium text-gray-700">{memo.title}</p>
              <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{memo.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
