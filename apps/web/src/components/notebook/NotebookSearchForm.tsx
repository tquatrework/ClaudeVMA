/**
 * NotebookSearchForm — recherche « un mot » / « une date » sur un carnet
 * personnel, extrait de `NotebookPage.tsx` (chantier « accès admin/parent au
 * carnet personnel », 2026-08-28) pour être réutilisé tel quel par une future
 * section de lecture seule (RP/AF/TI sur la fiche d'un tiers, parent sur son
 * enfant) — l'arbitrage du 2026-08-28 prévoit explicitement les mêmes
 * paramètres de recherche `from`/`to`/`q` que la route du titulaire.
 *
 * Reste un composant contrôlé pur : aucun état interne, aucun appel réseau —
 * la page ou la section appelante reste seule responsable du chargement
 * (règle du 2026-08-10, « le chargement se fait au niveau de la page »).
 */

import React from 'react'

interface NotebookSearchFormProps {
  idPrefix: string
  searchWord: string
  onSearchWordChange: (value: string) => void
  searchDate: string
  onSearchDateChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
  onReset: () => void
  isSearching: boolean
  hasActiveSearch: boolean
}

export function NotebookSearchForm({
  idPrefix,
  searchWord,
  onSearchWordChange,
  searchDate,
  onSearchDateChange,
  onSubmit,
  onReset,
  isSearching,
  hasActiveSearch,
}: NotebookSearchFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-3"
    >
      <div className="flex-1 min-w-[160px]">
        <label htmlFor={`${idPrefix}-search-word`} className="block text-xs text-gray-500 mb-1">
          Rechercher un mot
        </label>
        <input
          id={`${idPrefix}-search-word`}
          type="text"
          value={searchWord}
          onChange={(event) => onSearchWordChange(event.target.value)}
          placeholder="ex. intégrales"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-search-date`} className="block text-xs text-gray-500 mb-1">
          Rechercher une date
        </label>
        <input
          id={`${idPrefix}-search-date`}
          type="date"
          value={searchDate}
          onChange={(event) => onSearchDateChange(event.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>
      <button
        type="submit"
        disabled={isSearching}
        className="bg-white border border-indigo-300 text-indigo-600 px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-50 disabled:opacity-50"
      >
        {isSearching ? 'Recherche…' : 'Rechercher'}
      </button>
      {hasActiveSearch && (
        <button type="button" onClick={onReset} className="text-xs text-gray-500 hover:underline">
          Réinitialiser
        </button>
      )}
    </form>
  )
}
