/**
 * ContactSearchPanel — trouver une personne à demander en contact, par identifiant
 * de connexion exact ou par prénom/nom (docs/architecture/contacts-messagerie.md,
 * points 2/10/11). Aucune restriction de rôle : n'importe quel compte authentifié
 * peut demander n'importe quel autre.
 */

import React, { useState } from 'react'
import type { ContactSearchResult } from '../../api/contacts'
import { useContactSearch } from '../../hooks/communication/useContactSearch'
import { formatFullName } from '../../utils/nameFormat'
import { ErrorMessage } from '../ui/ErrorMessage'

type SearchMode = 'loginIdentifier' | 'name'

function resultDisplayName(result: ContactSearchResult): string {
  return formatFullName(result.firstName, result.lastName) || 'Nom non renseigné'
}

export function ContactSearchPanel() {
  const [mode, setMode] = useState<SearchMode>('name')
  const [query, setQuery] = useState('')
  const {
    results,
    hasSearched,
    isSearching,
    searchError,
    searchByLoginIdentifier,
    searchByName,
    sendRequest,
    sendingTargetId,
    sendErrorByTargetId,
    sentTargetIds,
  } = useContactSearch()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'loginIdentifier') {
      await searchByLoginIdentifier(query)
    } else {
      await searchByName(query)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Recherchez une personne par son identifiant de connexion (correspondance exacte) ou par
        prénom/nom. Toute demande envoyée doit être acceptée par la personne concernée.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as SearchMode)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="name">Par prénom / nom</option>
          <option value="loginIdentifier">Par identifiant de connexion</option>
        </select>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === 'name' ? 'Ex. Camille Durand' : 'Ex. camille.durand'}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
        >
          {isSearching ? 'Recherche…' : 'Rechercher'}
        </button>
      </form>

      {searchError && <ErrorMessage message={searchError} />}

      {hasSearched && !isSearching && results.length === 0 && !searchError && (
        <p className="text-sm text-gray-400 py-4 text-center">
          Aucune personne trouvée. Vérifiez l'orthographe ou l'identifiant saisi.
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((result) => {
            const hasSent = sentTargetIds.has(result.userId)
            const sendError = sendErrorByTargetId[result.userId]
            return (
              <li
                key={result.userId}
                className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {resultDisplayName(result)}
                  </p>
                  {result.loginIdentifier && (
                    <p className="text-xs text-gray-500 mt-0.5">{result.loginIdentifier}</p>
                  )}
                  {sendError && <p className="text-xs text-red-600 mt-1">{sendError}</p>}
                </div>
                <button
                  onClick={() => sendRequest(result.userId)}
                  disabled={hasSent || sendingTargetId === result.userId || Boolean(sendError)}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {hasSent
                    ? 'Demande envoyée'
                    : sendingTargetId === result.userId
                      ? '…'
                      : 'Demander en contact'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
