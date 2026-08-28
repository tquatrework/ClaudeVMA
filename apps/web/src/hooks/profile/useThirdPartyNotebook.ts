/**
 * useThirdPartyNotebook — lecture du carnet personnel d'un tiers, réglage TI
 * permettant (arbitrage du 2026-08-28, docs/architecture.md « Acces
 * administratif et parental au carnet personnel »).
 *
 * `hasAccess` ne devient `true` qu'après un chargement réussi : c'est ce
 * signal, et lui seul, qui décide si `ThirdPartyNotebookSection` s'affiche.
 * Un échec (403 structurel, 404 réglage/relation absente, 503, réseau) laisse
 * `hasAccess` à `false` — la section appelante ne rend alors rien, exactement
 * comme le carnet personnel est déjà absent des autres profils aujourd'hui.
 * Aucune écriture n'est jamais exposée par ce hook : lecture seule, sans
 * exception (même règle que le reste de ce chantier).
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  fetchThirdPartyNotebookEntries,
  type NotebookEntry,
  type NotebookSearchParams,
} from '../../api/pedagogicalLogNotebook'

export interface UseThirdPartyNotebookResult {
  entries: NotebookEntry[]
  hasAccess: boolean
  isLoading: boolean
  isSearching: boolean
  searchWord: string
  setSearchWord: (value: string) => void
  searchDate: string
  setSearchDate: (value: string) => void
  hasActiveSearch: boolean
  search: (event: FormEvent) => void
  resetSearch: () => void
}

export function useThirdPartyNotebook(
  ownerId: string | undefined,
  enabled: boolean,
): UseThirdPartyNotebookResult {
  const [entries, setEntries] = useState<NotebookEntry[]>([])
  const [hasAccess, setHasAccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchWord, setSearchWord] = useState('')
  const [searchDate, setSearchDate] = useState('')

  const load = useCallback(
    (params?: NotebookSearchParams) => {
      if (!ownerId) return
      setIsLoading(true)
      fetchThirdPartyNotebookEntries(ownerId, params)
        .then((fetchedEntries) => {
          setEntries(fetchedEntries)
          setHasAccess(true)
        })
        .catch(() => {
          // Échec (403/404/503/réseau) : aucun droit constaté, la section
          // appelante ne s'affiche pas. On n'a pas à distinguer les causes ici.
          setHasAccess(false)
          setEntries([])
        })
        .finally(() => {
          setIsLoading(false)
          setIsSearching(false)
        })
    },
    [ownerId],
  )

  useEffect(() => {
    if (!enabled || !ownerId) {
      setHasAccess(false)
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ownerId])

  const search = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      setIsSearching(true)
      load({
        q: searchWord.trim() || undefined,
        from: searchDate || undefined,
        to: searchDate || undefined,
      })
    },
    [load, searchWord, searchDate],
  )

  const resetSearch = useCallback(() => {
    setSearchWord('')
    setSearchDate('')
    load()
  }, [load])

  const hasActiveSearch = Boolean(searchWord.trim() || searchDate)

  return {
    entries,
    hasAccess,
    isLoading,
    isSearching,
    searchWord,
    setSearchWord,
    searchDate,
    setSearchDate,
    hasActiveSearch,
    search,
    resetSearch,
  }
}
