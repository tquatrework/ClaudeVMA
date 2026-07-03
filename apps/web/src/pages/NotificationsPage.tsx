/**
 * NotificationsPage — Liste des notifications de l'utilisateur connecté.
 * Appelle GET /notifications (dashboard-notification-service).
 */

import React, { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

interface Notification {
  id: string
  message: string
  read: boolean
  createdAt: string
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    // Placeholder : appel API à connecter quand dashboard-notification-service est disponible
    setIsLoading(false)
  }, [user])

  return (
    <Layout>
      <div style={{ maxWidth: '680px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--color-ink)',
            marginBottom: '20px',
          }}
        >
          Notifications
        </h1>

        {isLoading ? (
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Chargement…
          </p>
        ) : notifications.length === 0 ? (
          <div
            style={{
              background: 'var(--color-white)',
              border: '1px solid var(--color-surface)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-card)',
              padding: '32px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              Aucune notification pour l'instant.
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0' }}>
            {notifications.map((notification) => (
              <li
                key={notification.id}
                style={{
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'flex-start',
                  padding: '14px 16px',
                  background: notification.read ? 'transparent' : 'color-mix(in srgb, var(--accent) 5%, transparent)',
                  borderBottom: '1px solid var(--color-surface)',
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: notification.read ? 'var(--color-surface)' : 'var(--accent)',
                    flexShrink: 0,
                    marginTop: '5px',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--color-ink)',
                      fontWeight: notification.read ? 400 : 500,
                      margin: '0 0 4px',
                    }}
                  >
                    {notification.message}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                    {new Date(notification.createdAt).toLocaleString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}
