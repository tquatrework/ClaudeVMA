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
              to={hasRole('responsable_pedagogique') ? '/rp/teacher-requests' : '/teacher-requests'}
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

// ─── Sous-composant ContactRow ─────────────────────────────────────────────────

interface ContactRowProps {
  contact: Contact
  isPending: boolean
  onActivate: (contactId: string) => Promise<void>
  onDelete: (contactId: string) => Promise<void>
  onVisibilityChange: (contactId: string, visibility: ContactVisibility) => Promise<void>
  onStartConversation: (contact: Contact) => void
}

function ContactRow({
  contact,
  isPending,
  onActivate,
  onDelete,
  onVisibilityChange,
  onStartConversation,
}: ContactRowProps) {
  const displayLabel =
    contact.displayName ?? contact.email ?? `Contact ${contact.id.slice(0, 8)}…`

  return (
    <li className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      {/* Identité du contact */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm truncate">{displayLabel}</span>
          {contact.role && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
              {contact.role}
            </span>
          )}
          {contact.mandatory && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              Obligatoire
            </span>
          )}
          {contact.status === 'precontact' && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
              Précontact
            </span>
          )}
        </div>
        {contact.email && contact.displayName && (
          <p className="text-xs text-gray-500 mt-0.5">{contact.email}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Sélecteur de visibilité (ContactVisibilitySettings inline) */}
        <div className="flex items-center gap-2">
          <label
            htmlFor={`visibility-${contact.id}`}
            className="text-xs text-gray-500 whitespace-nowrap"
          >
            Visibilité
          </label>
          <select
            id={`visibility-${contact.id}`}
            value={contact.visibility ?? 'visible'}
            onChange={(e) =>
              onVisibilityChange(contact.id, e.target.value as ContactVisibility)
            }
            disabled={isPending}
            className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
            aria-label={`Visibilité de ${displayLabel}`}
          >
            <option value="visible">Visible</option>
            <option value="hidden">Masqué</option>
          </select>
        </div>

        {/* Bouton Activer (précontacts uniquement) */}
        {contact.status === 'precontact' && (
          <button
            onClick={() => onActivate(contact.id)}
            disabled={isPending}
            className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
          >
            {isPending ? '…' : 'Activer'}
          </button>
        )}

        {/* Bouton Supprimer (contacts actifs non obligatoires uniquement) */}
        {!contact.mandatory && contact.status === 'active' && (
          <button
            onClick={() => onDelete(contact.id)}
            disabled={isPending}
            className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50 whitespace-nowrap"
          >
            {isPending ? '…' : 'Supprimer'}
          </button>
        )}

        {/* Bouton Écrire (contacts actifs uniquement) */}
        {contact.status === 'active' && (
          <button
            onClick={() => onStartConversation(contact)}
            disabled={isPending}
            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
          >
            Écrire
          </button>
        )}
      </div>
    </li>
  )
}
