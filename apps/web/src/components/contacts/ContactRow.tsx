/**
 * ContactRow — ligne de contact autorisé (activer / supprimer / visibilité / écrire).
 * Extrait de ContactsPage (lot 10 — normalisation, découpage > 300 lignes).
 */

import React from 'react'
import type { Contact, ContactVisibility } from '../../api/communication'

interface ContactRowProps {
  contact: Contact
  isPending: boolean
  onActivate: (contactId: string) => Promise<void>
  onDelete: (contactId: string) => Promise<void>
  onVisibilityChange: (contactId: string, visibility: ContactVisibility) => Promise<void>
  onStartConversation: (contact: Contact) => void
}

export function ContactRow({
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
