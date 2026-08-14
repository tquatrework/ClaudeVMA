/**
 * NotificationsPage — historique paginé complet des notifications de
 * l'utilisateur connecté (`GET /notifications`, dashboard-notification-service).
 *
 * Le clic sur une ligne non lue appelle `markAsRead` du contexte partagé
 * (`NotificationsContext`), pour que le compteur de la cloche se mette à jour
 * même depuis cette page — puis remonte la réponse du serveur dans la liste
 * paginée propre à la page (`useNotificationsHistory`), sans ré-appeler la liste.
 */

import React from 'react'
import Layout from '../components/Layout'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { useNotificationsHistory } from '../hooks/dashboard/useNotificationsHistory'
import { getNotificationDisplayText } from '../utils/notificationLabels'
import { formatActivityDate } from '../utils/dateFormat'

export default function NotificationsPage() {
  const { user } = useAuth()
  const { markAsRead } = useNotifications()
  const { notifications, isLoading, loadError, page, totalPages, total, goToPage, applyRead } =
    useNotificationsHistory()

  const handleRowClick = async (notificationId: string, isRead: boolean) => {
    if (isRead) return
    try {
      const updated = await markAsRead(notificationId)
      applyRead(updated)
    } catch {
      // Le marquage a échoué : la notification reste non lue à l'écran, l'utilisateur peut réessayer.
    }
  }

  const hasPagination = totalPages > 1

  return (
    <Layout>
      <div className="max-w-2xl space-y-5">
        <PageHeader
          title="Notifications"
          subtitle={total > 0 ? `${total} notification${total > 1 ? 's' : ''} au total` : undefined}
        />

        {loadError && <ErrorMessage message={loadError} />}

        {isLoading && (
          <p className="text-sm text-[color:var(--color-text-secondary)]">Chargement…</p>
        )}

        {!isLoading && !loadError && notifications.length === 0 && (
          <div
            style={{ boxShadow: 'var(--shadow-card)' }}
            className="bg-[var(--color-white)] border border-[var(--color-surface)] rounded-[var(--radius-card)] p-8 text-center"
          >
            <p className="text-sm text-[color:var(--color-text-secondary)]">
              Aucune notification pour l'instant.
            </p>
          </div>
        )}

        {!isLoading && notifications.length > 0 && (
          <ul
            style={{ boxShadow: 'var(--shadow-card)' }}
            className="list-none m-0 p-0 flex flex-col bg-[var(--color-white)] border border-[var(--color-surface)] rounded-[var(--radius-card)] overflow-hidden"
          >
            {notifications.map((notification) => (
              <li key={notification.id} className="border-b border-[var(--color-surface)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => handleRowClick(notification.id, notification.isRead)}
                  style={{
                    background: notification.isRead
                      ? 'transparent'
                      : 'color-mix(in srgb, var(--accent) 5%, transparent)',
                  }}
                  className="w-full text-left flex items-start gap-3 px-4 py-3.5 border-none cursor-pointer hover:bg-[var(--color-bg)] transition-colors duration-150 ease-in-out"
                >
                  <span
                    style={{ background: notification.isRead ? 'var(--color-surface)' : 'var(--accent)' }}
                    className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                  />
                  <span className="flex-1 min-w-0">
                    <span
                      style={{ color: 'var(--color-ink)', fontWeight: notification.isRead ? 400 : 600 }}
                      className="block text-[13px] leading-snug"
                    >
                      {getNotificationDisplayText(notification, user?.role)}
                    </span>
                    <span className="block text-[11px] text-[color:var(--color-text-secondary)] mt-1">
                      {formatActivityDate(notification.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {hasPagination && (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || isLoading}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 disabled:opacity-40"
            >
              Page précédente
            </button>
            <span className="text-xs text-gray-500">
              Page {page} sur {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || isLoading}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 disabled:opacity-40"
            >
              Page suivante
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
