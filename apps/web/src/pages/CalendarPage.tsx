import React, { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import { Tabs, TabPanel, type TabDefinition } from '../components/ui/Tabs'
import CalendarEventsPanel from '../components/calendar/CalendarEventsPanel'
import AvailabilityTab from '../components/calendar/AvailabilityTab'
import CourseProposalsPanel from '../components/calendar/CourseProposalsPanel'

const TAB_EVENTS = 'events'
const TAB_AVAILABILITY = 'availability'
const TAB_PROPOSALS = 'proposals'

const TABS: TabDefinition[] = [
  { id: TAB_EVENTS, label: 'Mes événements' },
  { id: TAB_AVAILABILITY, label: 'Mes disponibilités' },
  { id: TAB_PROPOSALS, label: 'Propositions de cours' },
]

/**
 * CalendarPage — conteneur d'onglets. "Mes événements" (actif par défaut, comportement
 * inchangé), "Mes disponibilités" (édition des créneaux de disponibilité/indisponibilité,
 * point 1 du chantier calendrier) et "Propositions de cours" (proposer/suivre un créneau de
 * cours, point 3 — voir `CourseProposalsPanel`). Montage paresseux + maintien (règle du
 * 2026-08-10, voir `src/components/ui/Tabs.tsx`).
 */
export default function CalendarPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState(TAB_EVENTS)

  return (
    <Layout>
      <div className="max-w-3xl mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Mon calendrier</h1>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} ariaLabel="Onglets du calendrier" />

      <TabPanel tabId={TAB_EVENTS} activeTab={activeTab}>
        <CalendarEventsPanel />
      </TabPanel>

      <TabPanel tabId={TAB_AVAILABILITY} activeTab={activeTab}>
        {user && (
          <div className="max-w-3xl">
            <AvailabilityTab ownerId={user.id} />
          </div>
        )}
      </TabPanel>

      <TabPanel tabId={TAB_PROPOSALS} activeTab={activeTab}>
        <div className="max-w-3xl">
          <CourseProposalsPanel />
        </div>
      </TabPanel>
    </Layout>
  )
}
