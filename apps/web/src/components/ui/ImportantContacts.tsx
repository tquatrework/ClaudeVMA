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
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Chargement…</p>
      ) : contacts.length === 0 ? (
        <div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
            Aucun contact pour l'instant.
          </p>
          <Link
            to="/contacts"
            style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}
          >
            Gérer les contacts →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {contacts.map((contact) => (
            <div key={contact.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--accent-alpha-10, rgba(91,108,240,0.10))',
                  border: '1px solid var(--color-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  fontSize: '13px',
                  flexShrink: 0,
                }}
              >
                {getAvatarLetter(contact.displayName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--color-ink)',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {contact.displayName ?? contact.email ?? 'Contact'}
                </p>
                {contact.role && (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                    {contact.role}
                  </p>
                )}
              </div>
              <Link
                to="/messages"
                style={{
                  fontSize: '11px',
                  color: 'var(--accent)',
                  border: '1px solid var(--color-surface)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '3px 8px',
                  textDecoration: 'none',
                  flexShrink: 0,
                }}
              >
                Écrire
              </Link>
            </div>
          ))}
          <Link
            to="/contacts"
            style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', marginTop: '4px' }}
          >
            Tous les contacts →
          </Link>
        </div>
      )}
    </div>
  )
}
