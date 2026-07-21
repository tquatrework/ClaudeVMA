/**
 * ImportantContacts — Liste de contacts importants
 *
 * Partagé entre EleveDashboard et potentiellement les autres dashboards.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import type { DashboardContact } from '../../types/dashboard'
import { getAvatarLetter } from '../../utils/role'
import { DashboardSectionTitle } from './DashboardCard'

interface ImportantContactsProps {
  contacts: DashboardContact[]
  isLoading: boolean
}

export function ImportantContacts({ contacts, isLoading }: ImportantContactsProps) {
  return (
    <div>
      <DashboardSectionTitle>Contacts importants</DashboardSectionTitle>

      {isLoading ? (
        <p className="text-[13px] text-[color:var(--color-text-secondary)]">Chargement…</p>
      ) : contacts.length === 0 ? (
        <div>
          <p className="text-[13px] text-[color:var(--color-text-secondary)] mb-3">
            Aucun contact pour l'instant.
          </p>
          <Link to="/contacts" className="text-[12px] text-[color:var(--accent)] no-underline">
            Gérer les contacts →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {contacts.map((contact) => (
            <div key={contact.id} className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[var(--accent-alpha-10)] border border-[var(--color-surface)] flex items-center justify-center text-[color:var(--accent)] font-bold text-[13px] shrink-0">
                {getAvatarLetter(contact.displayName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[color:var(--color-ink)] m-0 overflow-hidden text-ellipsis whitespace-nowrap">
                  {contact.displayName ?? contact.email ?? 'Contact'}
                </p>
                {contact.role && (
                  <p className="text-[11px] text-[color:var(--color-text-secondary)] m-0">
                    {contact.role}
                  </p>
                )}
              </div>
              <Link
                to="/messages"
                className="text-[11px] text-[color:var(--accent)] border border-[var(--color-surface)] rounded-[var(--radius-pill)] py-[3px] px-2 no-underline shrink-0"
              >
                Écrire
              </Link>
            </div>
          ))}
          <Link
            to="/contacts"
            className="text-[12px] text-[color:var(--accent)] no-underline mt-1"
          >
            Tous les contacts →
          </Link>
        </div>
      )}
    </div>
  )
}
