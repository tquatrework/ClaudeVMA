import React, { createContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationAsRead as markNotificationAsReadRequest,
} from '../api/dashboardNotifications'
import type { DashboardNotification } from '../types/dashboard'
import { getErrorMessage } from '../utils/apiError'

/**
 * NotificationsContext — système de notifications transversal (cloche),
 * arbitrage du 2026-08-14 (`docs/architecture.md`).
 *
 * Modelé exactement sur `AuthContext.tsx` : monté une fois au sommet de
 * l'arbre applicatif authentifié (`App.tsx`), chargé **au montage**
 * uniquement — pas de polling, pas de re-fetch au changement de page (règle
 * du 2026-08-10 sur le chargement des données). `markAsRead` met à jour
 * l'état partagé avec la réponse du serveur, jamais par un ré-fetch complet.
 */

const RECENT_NOTIFICATIONS_LIMIT = 20

export interface NotificationsState {
  /** Liste bornée des notifications les plus récentes, pour le menu de la cloche. */
  notifications: DashboardNotification[]
  unreadCount: number
  isLoading: boolean
  loadError: string | null
  /** Marque une notification comme lue et renvoie la valeur mise à jour par le serveur. */
  markAsRead: (notificationId: string) => Promise<DashboardNotification>
}

// eslint-disable-next-line react-refresh/only-export-components
export const NotificationsContext = createContext<NotificationsState | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Évite de recharger à chaque re-rendu de `isAuthenticated` (ex. rafraîchissement de
  // `user` par `AuthContext`) : un seul chargement par session authentifiée.
  const hasLoadedRef = useRef(false)
  // Miroir synchrone de `notifications`, pour que `markAsRead` sache si la notification
  // était déjà lue sans dépendre d'une closure obsolète (voir plus bas).
  const notificationsRef = useRef<DashboardNotification[]>([])
  notificationsRef.current = notifications

  useEffect(() => {
    if (!isAuthenticated) {
      // Session fermée (déconnexion) : réinitialise pour permettre un nouveau chargement
      // au prochain login, et ne pas laisser les notifications d'un compte affichées
      // pour un autre.
      hasLoadedRef.current = false
      setNotifications([])
      setUnreadCount(0)
      setLoadError(null)
      return
    }

    if (hasLoadedRef.current) return
    hasLoadedRef.current = true

    let isIgnored = false
    setIsLoading(true)
    setLoadError(null)

    Promise.all([
      fetchNotifications({ limit: RECENT_NOTIFICATIONS_LIMIT }),
      fetchUnreadNotificationCount(),
    ])
      .then(([recentNotifications, count]) => {
        if (isIgnored) return
        setNotifications(recentNotifications)
        setUnreadCount(count)
      })
      .catch((caughtError: unknown) => {
        if (isIgnored) return
        setLoadError(getErrorMessage(caughtError, 'Impossible de charger les notifications.'))
      })
      .finally(() => {
        if (isIgnored) return
        setIsLoading(false)
      })

    return () => {
      isIgnored = true
    }
  }, [isAuthenticated])

  const markAsRead = useCallback(async (notificationId: string) => {
    const wasUnread = notificationsRef.current.find((n) => n.id === notificationId)?.isRead === false

    const updated = await markNotificationAsReadRequest(notificationId)

    setNotifications((current) => current.map((n) => (n.id === notificationId ? updated : n)))

    if (wasUnread && updated.isRead) {
      setUnreadCount((count) => Math.max(0, count - 1))
    }

    return updated
  }, [])

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, isLoading, loadError, markAsRead }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}
