/**
 * useNotificationsHistory — historique paginé complet des notifications
 * (`NotificationsPage`), distinct de la liste bornée du contexte partagé
 * utilisée par la cloche (`NotificationsContext` — `useNotifications`).
 *
 * Chargement au niveau de la page, un appel par page consultée (arbitrage du
 * 2026-08-10). La page détient sa propre liste ; après un marquage lu, la
 * réponse du serveur remonte via `applyRead` plutôt qu'un ré-fetch complet —
 * même pattern que `usePendingTeacherValidations`.
 */

import { useCallback, useEffect, useState } from 'react'
import { fetchNotificationsPage } from '../../api/dashboardNotifications'
import type { DashboardNotification } from '../../types/dashboard'
import { useAsyncData } from '../useAsyncData'

const NOTIFICATIONS_PAGE_SIZE = 20

export interface UseNotificationsHistoryResult {
  notifications: DashboardNotification[]
  isLoading: boolean
  loadError: string | null
  page: number
  totalPages: number
  total: number
  goToPage: (page: number) => void
  /** Remonte la réponse d'un marquage lu : la page reste propriétaire de sa liste. */
  applyRead: (updated: DashboardNotification) => void
}

export function useNotificationsHistory(): UseNotificationsHistoryResult {
  const [page, setPage] = useState(1)
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])

  const { data, isLoading, error } = useAsyncData(
    () => fetchNotificationsPage({ page, limit: NOTIFICATIONS_PAGE_SIZE }),
    [page],
    { fallbackErrorMessage: 'Impossible de charger vos notifications.' },
  )

  useEffect(() => {
    if (!data) return
    setNotifications(data.data)
  }, [data])

  const applyRead = useCallback((updated: DashboardNotification) => {
    setNotifications((current) => current.map((n) => (n.id === updated.id ? updated : n)))
  }, [])

  const goToPage = useCallback((nextPage: number) => {
    setPage(Math.max(1, nextPage))
  }, [])

  return {
    notifications,
    isLoading,
    loadError: error,
    page: data?.page ?? page,
    totalPages: data?.totalPages ?? 0,
    total: data?.total ?? 0,
    goToPage,
    applyRead,
  }
}
