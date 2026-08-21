/**
 * LogDateRangeFilter — recherche par date dans le cahier de texte.
 *
 * Sert `from`/`to` (`GET /students/:studentId/pedagogical-log?from=&to=`,
 * `docs/routes.md` § pedagogical-log-service) : une simple plage de dates,
 * conforme à la demande (« pas besoin d'un composant complexe »).
 */

import React from 'react'

interface LogDateRangeFilterProps {
  fromDate: string
  toDate: string
  onFromDateChange: (value: string) => void
  onToDateChange: (value: string) => void
  onClear: () => void
}

export default function LogDateRangeFilter({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onClear,
}: LogDateRangeFilterProps) {
  const hasFilter = fromDate !== '' || toDate !== ''

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-4">
      <div>
        <label htmlFor="log-filter-from" className="block text-xs text-gray-500 mb-1">
          Du
        </label>
        <input
          id="log-filter-from"
          type="date"
          value={fromDate}
          onChange={(event) => onFromDateChange(event.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>
      <div>
        <label htmlFor="log-filter-to" className="block text-xs text-gray-500 mb-1">
          Au
        </label>
        <input
          id="log-filter-to"
          type="date"
          value={toDate}
          onChange={(event) => onToDateChange(event.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>
      {hasFilter && (
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Réinitialiser
        </button>
      )}
    </div>
  )
}
