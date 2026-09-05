/**
 * ContactsPage — mes contacts, demandes de contact et recherche.
 * Réécrite le 2026-09-05 pour la refonte Contacts (docs/architecture/contacts-messagerie.md,
 * 2026-09-04) : le Contact est désormais une entité propre à communication-service, avec
 * un cycle de vie demande → acceptée/refusée, distincte des relations métier de
 * profile-service.
 */

import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import type { Contact } from '../api/contacts'
import { useContacts } from '../hooks/communication/useContacts'
import { ContactRow } from '../components/contacts/ContactRow'
import { ContactRequestsPanel } from '../components/contacts/ContactRequestsPanel'
import { ContactSearchPanel } from '../components/contacts/ContactSearchPanel'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { EmptyState } from '../components/ui/EmptyState'
import { Tabs, TabPanel } from '../components/ui/Tabs'
import { formatContactDisplayName } from '../hooks/communication/useContacts'

const TABS = [
  { id: 'contacts', label: 'Mes contacts' },
  { id: 'requests', label: 'Demandes' },
  { id: 'search', label: 'Trouver un contact' },
]

export default function ContactsPage() {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [activeTab, setActiveTab] = useState('contacts')
  const { contacts, isLoading, error, breakContact, breakingContactId, breakError } = useContacts()

  /**
   * L'encart "Nouvelle demande" est visible pour les rôles impliqués dans le
   * workflow demande professeur (élève, parent_financeur) ou qui gèrent des demandes (RP).
   */
  const canMakeTeacherRequest = hasRole('eleve', 'parent_financeur', 'responsable_pedagogique')

  const handleStartConversation = (contact: Contact) => {
    navigate('/messages', {
      state: {
        startConversationWithUserId: contact.counterpartId,
        startConversationWithLabel: formatContactDisplayName(contact),
      },
    })
  }

  const handleBreakContact = (contactId: string) => {
    const contact = contacts.find((candidate) => candidate.id === contactId)
    const label = contact ? formatContactDisplayName(contact) : 'ce contact'
    if (!window.confirm(`Rompre le contact avec ${label} ? Vous pourrez le redemander plus tard.`)) {
      return
    }
    void breakContact(contactId)
  }

  return (
    <Layout>
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Retrouvez vos contacts actifs, gérez vos demandes et trouvez de nouvelles personnes à
            ajouter.
          </p>
        </div>

        {canMakeTeacherRequest && (
          <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 mb-6 flex items-center justify-between gap-4 shadow-sm">
            <div>
              <p className="font-semibold text-sm text-gray-900 mb-1">Faire une demande</p>
              <p className="text-xs text-gray-500">
                {hasRole('responsable_pedagogique')
                  ? 'Accéder aux demandes de professeur en attente de traitement.'
                  : 'Demandez un professeur ou consultez vos demandes en cours.'}
              </p>
            </div>
            <Link
              to="/teacher-requests"
              className="inline-flex items-center gap-1.5 bg-indigo-600 text-white font-semibold text-xs px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
            >
              Nouvelle demande
            </Link>
          </div>
        )}

        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} ariaLabel="Onglets de contacts" />

        <TabPanel tabId="contacts" activeTab={activeTab}>
          {breakError && <ErrorMessage message={breakError} className="mb-4" />}
          {error && <ErrorMessage message={error} className="mb-4" />}
          {isLoading && (
            <p className="py-8 text-center text-gray-400 text-sm">Chargement des contacts…</p>
          )}
          {!isLoading && !error && contacts.length === 0 && (
            <EmptyState
              message="Vous n'avez pas encore de contact actif."
              actionLabel="Trouver un contact"
              onAction={() => setActiveTab('search')}
            />
          )}
          {!isLoading && contacts.length > 0 && (
            <ul className="space-y-2">
              {contacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  isBreaking={breakingContactId === contact.id}
                  onBreak={handleBreakContact}
                  onStartConversation={handleStartConversation}
                />
              ))}
            </ul>
          )}
        </TabPanel>

        <TabPanel tabId="requests" activeTab={activeTab}>
          <ContactRequestsPanel />
        </TabPanel>

        <TabPanel tabId="search" activeTab={activeTab}>
          <ContactSearchPanel />
        </TabPanel>
      </div>
    </Layout>
  )
}
