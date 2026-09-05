/**
 * useContactSearch — recherche d'une personne à demander en contact, par identifiant
 * de connexion exact ou par prénom/nom (avec désambiguïsation par identifiant en cas
 * d'homonymes). docs/architecture/contacts-messagerie.md (2026-09-04), points 2/10/11.
 *
 * Zéro résultat, un résultat ou plusieurs résultats homonymes sont tous des cas
 * normaux — jamais une anomalie (« tous les noms ne seront pas connus »).
 *
 * Le blocage éventuel (cooldown d'un mois, blocage définitif au 3ᵉ refus) n'est
 * connu du serveur qu'au moment de l'envoi de la demande (403), jamais annoncé au
 * stade de la recherche — le message d'erreur, déjà en français côté serveur, est
 * donc affiché tel quel par appel plutôt qu'anticipé sur chaque résultat.
 */

import { useCallback, useState } from 'react'
import {
  searchContactByLoginIdentifier,
  searchContactByName,
  sendContactRequest,
} from '../../api/contacts'
import type { ContactRequest, ContactSearchResult } from '../../api/contacts'
import { getErrorMessage } from '../../utils/apiError'

export interface UseContactSearchResult {
  results: ContactSearchResult[]
  hasSearched: boolean
  isSearching: boolean
  searchError: string | null
  searchByLoginIdentifier: (value: string) => Promise<void>
  searchByName: (query: string) => Promise<void>
  sendRequest: (targetId: string) => Promise<ContactRequest | null>
  sendingTargetId: string | null
  /** Message d'erreur (dont un éventuel blocage 403) par cible sollicitée. */
  sendErrorByTargetId: Record<string, string>
  sentTargetIds: Set<string>
}

export function useContactSearch(): UseContactSearchResult {
  const [results, setResults] = useState<ContactSearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [sendingTargetId, setSendingTargetId] = useState<string | null>(null)
  const [sendErrorByTargetId, setSendErrorByTargetId] = useState<Record<string, string>>({})
  const [sentTargetIds, setSentTargetIds] = useState<Set<string>>(new Set())

  const handleSearchByLoginIdentifier = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setIsSearching(true)
    setSearchError(null)
    try {
      const response = await searchContactByLoginIdentifier(trimmed)
      setResults(response.result ? [response.result] : [])
      setHasSearched(true)
    } catch (caughtError: unknown) {
      setSearchError(getErrorMessage(caughtError, 'Impossible de lancer la recherche.'))
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleSearchByName = useCallback(async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    setIsSearching(true)
    setSearchError(null)
    try {
      const response = await searchContactByName(trimmed)
      setResults(response.results)
      setHasSearched(true)
    } catch (caughtError: unknown) {
      setSearchError(getErrorMessage(caughtError, 'Impossible de lancer la recherche.'))
    } finally {
      setIsSearching(false)
    }
  }, [])

  const sendRequest = useCallback(async (targetId: string): Promise<ContactRequest | null> => {
    setSendingTargetId(targetId)
    setSendErrorByTargetId((previous) => {
      const { [targetId]: _removed, ...rest } = previous
      return rest
    })
    try {
      const request = await sendContactRequest(targetId)
      setSentTargetIds((previous) => new Set(previous).add(targetId))
      return request
    } catch (caughtError: unknown) {
      setSendErrorByTargetId((previous) => ({
        ...previous,
        [targetId]: getErrorMessage(caughtError, "Impossible d'envoyer la demande de contact."),
      }))
      return null
    } finally {
      setSendingTargetId(null)
    }
  }, [])

  return {
    results,
    hasSearched,
    isSearching,
    searchError,
    searchByLoginIdentifier: handleSearchByLoginIdentifier,
    searchByName: handleSearchByName,
    sendRequest,
    sendingTargetId,
    sendErrorByTargetId,
    sentTargetIds,
  }
}
