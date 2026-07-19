/**
 * Tabs / TabPanel — composant de navigation par onglets réutilisable
 *
 * Usage :
 *   <Tabs tabs={[{ id: 'admin', label: 'Profil administratif' }, ...]} activeTab={activeTab} onTabChange={setActiveTab} />
 *   <TabPanel tabId="admin" activeTab={activeTab}>…contenu…</TabPanel>
 */

import React from 'react'

export interface TabDefinition {
  id: string
  label: string
}

interface TabsProps {
  tabs: TabDefinition[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Onglets de profil">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              role="tab"
              aria-selected={isActive}
              className={[
                'whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
                isActive
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              ].join(' ')}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

interface TabPanelProps {
  tabId: string
  activeTab: string
  children: React.ReactNode
}

export function TabPanel({ tabId, activeTab, children }: TabPanelProps) {
  if (tabId !== activeTab) return null
  return (
    <div role="tabpanel" className="w-full min-w-0">
      {children}
    </div>
  )
}
