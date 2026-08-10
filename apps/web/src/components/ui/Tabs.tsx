/**
 * Tabs / TabPanel — navigation par onglets réutilisable.
 *
 * Usage :
 *   <Tabs tabs={[{ id: 'admin', label: 'Profil administratif' }, ...]} activeTab={activeTab} onTabChange={setActiveTab} />
 *   <TabPanel tabId="admin" activeTab={activeTab}>…contenu…</TabPanel>
 *
 * **Montage paresseux, puis maintien** (2026-08-10). Un panneau n'est monté qu'à
 * sa première activation — inutile de charger cinq onglets pour en montrer un —
 * mais il **reste monté** ensuite, simplement masqué.
 *
 * Ce choix corrige une erreur de conception, pas un détail d'optimisation :
 * `TabPanel` renvoyait `null` quand l'onglet était inactif, ce qui **démonte**
 * son contenu et détruit tout ce qu'il portait. Un object URL de photo était
 * révoqué puis re-téléchargé à chaque retour, un panneau rechargeait ses données
 * à chaque passage, et un état encore détenu par un enfant disparaissait pour de
 * bon. Revenir sur un onglet ne doit ni recharger ni reconstruire son contenu.
 *
 * **Accessibilité.** Un panneau masqué porte `hidden` — donc `display: none`,
 * donc ni focalisable ni atteignable au clavier — et `aria-hidden`, pour qu'un
 * lecteur d'écran ne lise pas les cinq panneaux à la suite. `aria-controls` et
 * `aria-labelledby` relient chaque onglet à son panneau dans les deux sens.
 *
 * Les identifiants DOM sont dérivés du `tabId`, qui est unique au sein d'un
 * écran : deux jeux d'onglets sur une même page devraient donc porter des `id`
 * d'onglets distincts.
 */

import React, { useEffect, useState } from 'react'

export interface TabDefinition {
  id: string
  label: string
}

const buildTabDomId = (tabId: string) => `tab-${tabId}`
const buildTabPanelDomId = (tabId: string) => `tabpanel-${tabId}`

interface TabsProps {
  tabs: TabDefinition[]
  activeTab: string
  onTabChange: (tabId: string) => void
  /** Nom du groupe d'onglets, annoncé aux lecteurs d'écran. */
  ariaLabel?: string
}

export function Tabs({ tabs, activeTab, onTabChange, ariaLabel = 'Onglets de profil' }: TabsProps) {
  return (
    <div className="border-b border-gray-200 mb-6">
      <div role="tablist" aria-label={ariaLabel} className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              id={buildTabDomId(tab.id)}
              role="tab"
              aria-selected={isActive}
              aria-controls={buildTabPanelDomId(tab.id)}
              onClick={() => onTabChange(tab.id)}
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
      </div>
    </div>
  )
}

interface TabPanelProps {
  tabId: string
  activeTab: string
  children: React.ReactNode
}

export function TabPanel({ tabId, activeTab, children }: TabPanelProps) {
  const isActive = tabId === activeTab

  /**
   * Une fois vrai, ne redevient jamais faux : c'est tout le principe du
   * maintien. L'état est initialisé à `isActive` pour que l'onglet affiché à
   * l'arrivée soit monté dès le premier rendu, sans passer par un effet.
   */
  const [hasBeenActivated, setHasBeenActivated] = useState(isActive)
  useEffect(() => {
    if (isActive) setHasBeenActivated(true)
  }, [isActive])

  if (!hasBeenActivated) return null

  return (
    <div
      role="tabpanel"
      id={buildTabPanelDomId(tabId)}
      aria-labelledby={buildTabDomId(tabId)}
      hidden={!isActive}
      // `false` n'est pas la même chose qu'absent : sur le panneau visible,
      // l'attribut ne doit pas apparaître du tout.
      aria-hidden={!isActive || undefined}
      className="w-full min-w-0"
    >
      {children}
    </div>
  )
}
