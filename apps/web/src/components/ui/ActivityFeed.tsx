/**
 * ActivityFeed — Fil d'activité / notifications récentes
 *
 * Composant partagé entre EleveDashboard, ProfesseurDashboard, RpDashboard, ApDashboard.
 * Remplace les listes de notifications dupliquées dans chaque page.
 */

import React from 'react'
import type { DashboardNotification } from '../../types/dashboard'
import { formatActivityDate } from '../../utils/dateFormat'
import { DashboardSectionTitle } from './DashboardCard'

interface ActivityFeedProps {
  notifications: DashboardNotification[]
  isLoading: boolean
  /** Titre de la section. Défaut : "Activité récente" */
  title?: string
}

export function ActivityFeed({ notifications, isLoading, title = 'Activité récente' }: ActivityFeedProps) {
  return (
    <div>
      <DashboardSectionTitle>{title}</DashboardSectionTitle>

      {isLoading ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Chargement…</p>
      ) : notifications.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          Aucune activité récente.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {notifications.map((notification) => (
            <li
              key={notification.id}
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                padding: '10px 0',
                borderBottom: '1px solid var(--color-surface)',
              }}
            >
              <div
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: notification.read ? 'var(--color-surface)' : 'var(--accent)',
                  flexShrink: 0,
                  marginTop: '4px',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-ink)',
                    fontWeight: notification.read ? 400 : 500,
                    margin: '0 0 2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {notification.message}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  {formatActivityDate(notification.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
