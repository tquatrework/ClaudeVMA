import { useContext, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { NotificationsContext } from '../../context/NotificationsContext'
import { getNotificationDisplayText, getNotificationTargetPath } from '../../utils/notificationLabels'
import { formatActivityDate } from '../../utils/dateFormat'
import type { DashboardNotification } from '../../types/dashboard'

/**
 * NotificationBell — bouton cloche + menu déroulant des notifications
 * récentes, partagé par `Layout` et `DashboardShell` (les deux coquilles
 * applicatives, cf. `AccountStatusBanners`, extraite pour la même raison :
 * une seule copie, jamais deux à faire diverger).
 *
 * Le menu ne se referme pas au clic sur une ligne : seul le marquage lu a
 * lieu, la ligne passe visuellement de non-lue à lue sur place (état porté
 * par le contexte partagé, jamais localement — règle du 2026-08-10).
 *
 * Utilise `useContext` directement (pas le hook `useNotifications`, qui lève
 * une erreur en l'absence de provider) : `Layout`/`DashboardShell` sont montés
 * par la quasi-totalité des pages de l'application, y compris dans des tests
 * de composants qui n'ont rien à voir avec les notifications et ne montent
 * pas `<NotificationsProvider>`. En production, `App.tsx` monte toujours le
 * provider — ce repli n'a donc d'effet qu'en isolation (tests, Storybook).
 */
export function NotificationBell() {
  const { user } = useAuth()
  const notificationsState = useContext(NotificationsContext)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Repli sûr en l'absence de provider (voir commentaire ci-dessus) : cloche inerte,
  // sans compteur ni contenu, plutôt qu'un crash de toute la coquille applicative.
  const notifications = notificationsState?.notifications ?? []
  const unreadCount = notificationsState?.unreadCount ?? 0
  const isLoading = notificationsState?.isLoading ?? false
  const markAsRead = notificationsState?.markAsRead
  const navigate = useNavigate()

  // Marque lu (si nécessaire) PUIS navigue vers l'écran concerné — un formateur qui reçoit
  // « Nouvelle proposition de professeur » doit atterrir directement sur sa boîte de
  // réception (`/teacher-requests`), pas seulement voir la ligne passer à lue.
  const handleRowClick = (notification: DashboardNotification) => {
    if (!notification.isRead && markAsRead) {
      markAsRead(notification.id).catch(() => {
        // Échec du marquage : la ligne reste visuellement non lue, l'utilisateur peut recliquer.
      })
    }
    setIsOpen(false)
    const targetPath = getNotificationTargetPath(notification.type)
    if (targetPath) {
      navigate(targetPath)
    }
  }

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : 'Notifications'}
        aria-expanded={isOpen}
        className="relative flex items-center justify-center w-[30px] h-[30px] rounded-[var(--radius-field)] text-[color:var(--color-text-secondary)] bg-transparent border-none text-[17px] cursor-pointer transition-colors duration-150 ease-in-out"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{ boxShadow: 'var(--shadow-card)' }}
          className="absolute right-0 top-[38px] w-[340px] max-h-[420px] overflow-y-auto bg-[var(--color-white)] border border-[var(--color-surface)] rounded-[var(--radius-card)] z-[200] py-1.5"
        >
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--color-surface)]">
            <span className="text-[13px] font-semibold text-[color:var(--color-ink)]">
              Notifications
            </span>
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-[12px] text-[color:var(--accent)] no-underline"
            >
              Tout voir
            </Link>
          </div>

          {isLoading ? (
            <p className="px-3.5 py-3 text-[13px] text-[color:var(--color-text-secondary)]">
              Chargement…
            </p>
          ) : notifications.length === 0 ? (
            <p className="px-3.5 py-3 text-[13px] text-[color:var(--color-text-secondary)]">
              Aucune notification pour l'instant.
            </p>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleRowClick(notification)}
                style={{
                  background: notification.isRead
                    ? 'transparent'
                    : 'color-mix(in srgb, var(--accent) 5%, transparent)',
                }}
                className="w-full text-left flex items-start gap-2.5 px-3.5 py-2.5 border-0 border-b border-[var(--color-surface)] last:border-b-0 cursor-pointer hover:bg-[var(--color-bg)] transition-colors duration-150 ease-in-out"
              >
                <span
                  style={{ background: notification.isRead ? 'var(--color-surface)' : 'var(--accent)' }}
                  className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                />
                <span className="flex-1 min-w-0">
                  <span
                    style={{ color: 'var(--color-ink)', fontWeight: notification.isRead ? 400 : 600 }}
                    className="block text-[12.5px] leading-snug"
                  >
                    {getNotificationDisplayText(notification, user?.role)}
                  </span>
                  <span className="block text-[11px] text-[color:var(--color-text-secondary)] mt-0.5">
                    {formatActivityDate(notification.createdAt)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
