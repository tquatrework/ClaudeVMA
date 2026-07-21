/**
 * ArchiveTabsNav — navigation par onglets de PedagogicalArchivePage
 * (Statistiques / Archives / Résumés de cours).
 * Extrait de PedagogicalArchivePage (lot 10 — normalisation, découpage > 300 lignes).
 */

import React from 'react'

export type ArchiveActiveTab = 'statistics' | 'timeline' | 'summaries'

interface ArchiveTabsNavProps {
  activeTab: ArchiveActiveTab
  onTabChange: (tab: ArchiveActiveTab) => void
}

const TAB_DEFINITIONS: Array<{ id: ArchiveActiveTab; label: string }> = [
  { id: 'statistics', label: 'Statistiques' },
  { id: 'timeline', label: 'Archives' },
  { id: 'summaries', label: 'Résumés de cours' },
]

export function ArchiveTabsNav({ activeTab, onTabChange }: ArchiveTabsNavProps) {
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {TAB_DEFINITIONS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === tab.id
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
