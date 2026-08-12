import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  fetchContacts,
  activateContact,
  deleteContact,
  updateContactVisibility,
  type Contact,
  type ContactVisibility,
} from '../api/communication'
import { ContactRow } from '../components/contacts/ContactRow'

export default function ContactsPage() {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [contactList, setContactList] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pendingActionIds, setPendingActionIds] = useState<Set<string>>(new Set())

  /**
   * L'encart "Nouvelle demande" est visible pour les rôles impliqués dans le
   * workflow demande professeur (élève, parent_financeur) ou qui gèrent des demandes (RP).
   */
  const canMakeTeacherRequest = hasRole('eleve', 'parent_financeur', 'responsable_pedagogique')

  const handleStartConversation = (contact: Contact) => {
    navigate('/messages', { state: { initialContactId: contact.userId, initialContactLabel: contact.displayName ?? contact.email } })
  }

  useEffect(() => {
    fetchContacts()
      .then((contacts) => setContactList(contacts))
      .catch(() => setErrorMessage('Impossible de charger les contacts'))
      .finally(() => setIsLoading(false))
  }, [])

  const markContactAsPending = (contactId: string) => {
    setPendingActionIds((prev) => new Set(prev).add(contactId))
  }

  const unmarkContactAsPending = (contactId: string) => {
    setPendingActionIds((prev) => {
      const updated = new Set(prev)
      updated.delete(contactId)
      return updated
    })
  }

  const handleActivateContact = async (contactId: string) => {
    markContactAsPending(contactId)
    try {
      const activatedContact = await activateContact(contactId)
      setContactList((prev) =>
        prev.map((contact) => (contact.id === contactId ? activatedContact : contact)),
      )
    } catch {
      setErrorMessage("Impossible d'activer ce contact")
    } finally {
      unmarkContactAsPending(contactId)
    }
  }

  const handleDeleteContact = async (contactId: string) => {
    markContactAsPending(contactId)
    try {
      await deleteContact(contactId)
      setContactList((prev) => prev.filter((contact) => contact.id !== contactId))
    } catch {
      setErrorMessage('Impossible de supprimer ce contact')
    } finally {
      unmarkContactAsPending(contactId)
    }
  }

  const handleVisibilityChange = async (contactId: string, newVisibility: ContactVisibility) => {
    markContactAsPending(contactId)
    try {
      const updatedContact = await updateContactVisibility(contactId, {
        visibility: newVisibility,
      })
      setContactList((prev) =>
        prev.map((contact) => (contact.id === contactId ? updatedContact : contact)),
      )
    } catch {
      setErrorMessage('Impossible de mettre à jour la visibilité')
    } finally {
      unmarkContactAsPending(contactId)
    }
  }

  const mandatoryContacts = contactList.filter((contact) => contact.mandatory)
  const precontacts = contactList.filter(
    (contact) => !contact.mandatory && contact.status === 'precontact',
  )
  const activeOptionalContacts = contactList.filter(
    (contact) => !contact.mandatory && contact.status === 'active',
  )

  return (
    <Layout>
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Contacts autorisés</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez vos contacts de messagerie. Les contacts obligatoires ne peuvent pas être
            supprimés.
          </p>
        </div>

        {/* Encart "Nouvelle demande" — visible pour les rôles concernés par le workflow professeur */}
        {canMakeTeacherRequest && (
          <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 mb-6 flex items-center justify-between gap-4 shadow-sm">
            <div>
              <p className="font-semibold text-sm text-gray-900 mb-1">
                Faire une demande
              </p>
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

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-600 ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {isLoading && (
          <div className="py-8 text-center text-gray-400 text-sm">Chargement des contacts…</div>
        )}

        {!isLoading && contactList.length === 0 && (
          <div className="py-8 text-center text-gray-400 text-sm">Aucun contact disponible</div>
        )}

        {!isLoading && contactList.length > 0 && (
          <div className="space-y-6">
            {/* Contacts obligatoires */}
            {mandatoryContacts.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Contacts obligatoires
                </h2>
                <ul className="space-y-2">
                  {mandatoryContacts.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      isPending={pendingActionIds.has(contact.id)}
                      onActivate={handleActivateContact}
                      onDelete={handleDeleteContact}
                      onVisibilityChange={handleVisibilityChange}
                      onStartConversation={handleStartConversation}
                    />
                  ))}
                </ul>
              </section>
            )}

            {/* Précontacts */}
            {precontacts.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Précontacts (en attente d'activation)
                </h2>
                <ul className="space-y-2">
                  {precontacts.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      isPending={pendingActionIds.has(contact.id)}
                      onActivate={handleActivateContact}
                      onDelete={handleDeleteContact}
                      onVisibilityChange={handleVisibilityChange}
                      onStartConversation={handleStartConversation}
                    />
                  ))}
                </ul>
              </section>
            )}

            {/* Contacts actifs optionnels */}
            {activeOptionalContacts.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Contacts actifs
                </h2>
                <ul className="space-y-2">
                  {activeOptionalContacts.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      isPending={pendingActionIds.has(contact.id)}
                      onActivate={handleActivateContact}
                      onDelete={handleDeleteContact}
                      onVisibilityChange={handleVisibilityChange}
                      onStartConversation={handleStartConversation}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
