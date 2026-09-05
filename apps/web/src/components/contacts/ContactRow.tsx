/**
 * ContactRow — ligne d'un contact actif (écrire / rompre).
 * Réécrite le 2026-09-05 pour la refonte Contacts (docs/architecture/contacts-messagerie.md,
 * 2026-09-04) : l'ancien modèle ContactPolicy (précontact/mandatory/visibilité) n'existe
 * plus côté serveur.
 */

import React from 'react'
import type { Contact } from '../../api/contacts'
import { formatContactDisplayName } from '../../hooks/communication/useContacts'
import { formatLocalDate } from '../../utils/dateFormat'

interface ContactRowProps {
  contact: Contact
  isBreaking: boolean
  onBreak: (contactId: string) => void
  onStartConversation: (contact: Contact) => void
}

export function ContactRow({ contact, isBreaking, onBreak, onStartConversation }: ContactRowProps) {
  const displayLabel = formatContactDisplayName(contact)

  return (
    <li className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      {/* Identité du contact */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm truncate">{displayLabel}</span>
          {contact.origin === 'default' && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              Contact automatique
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">Contact depuis le {formatLocalDate(contact.createdAt)}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onStartConversation(contact)}
          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 whitespace-nowrap"
        >
          Écrire
        </button>
        <button
          onClick={() => onBreak(contact.id)}
          disabled={isBreaking}
          className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50 whitespace-nowrap"
        >
          {isBreaking ? '…' : 'Rompre'}
        </button>
      </div>
    </li>
  )
}
