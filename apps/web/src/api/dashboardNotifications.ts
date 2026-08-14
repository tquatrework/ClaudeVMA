/**
 * Module API — dashboard-notification-service
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'
import type { DashboardNotification } from '../types/dashboard'
import type { PaginatedResponse } from '../types/pagination'
import { normalizeListResponse } from '../utils/dashboardFormat'

export interface FetchNotificationsParams {
  page?: number
  limit?: number
  isRead?: boolean
}

/**
 * GET /notifications — Liste mes notifications.
 * Le backend peut répondre un tableau ou une enveloppe `{ data: [...] }` — normalisé ici via
 * `normalizeListResponse` pour que les hooks appelants reçoivent toujours un tableau. Utilisé
 * pour des listes bornées non paginées à l'écran (cloche, dashboards) — `params.limit` borne la
 * requête côté serveur ; pour une pagination affichée (page précédente/suivante), voir
 * `fetchNotificationsPage` ci-dessous.
 */
export async function fetchNotifications(
  params: FetchNotificationsParams = {},
): Promise<DashboardNotification[]> {
  const { data } = await apiClient.get<{ data?: DashboardNotification[] } | DashboardNotification[]>(
    '/notifications',
    { params },
  )
  return normalizeListResponse(data)
}

/**
 * GET /notifications — variante paginée conservant l'enveloppe complète
 * (`page`, `limit`, `total`, `totalPages`), pour les écrans qui affichent une
 * pagination réelle (historique complet des notifications).
 */
export async function fetchNotificationsPage(
  params: FetchNotificationsParams = {},
): Promise<PaginatedResponse<DashboardNotification>> {
  const { data } = await apiClient.get<PaginatedResponse<DashboardNotification>>('/notifications', {
    params,
  })
  return data
}

/**
 * GET /notifications/unread-count — compteur de notifications non lues,
 * pour le badge de la cloche.
 */
export async function fetchUnreadNotificationCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>('/notifications/unread-count')
  return data.count
}

/**
 * POST /notifications/:id/read — marque une notification comme lue, renvoie
 * la notification à jour (utilisée pour mettre à jour l'état local sans
 * ré-appeler la liste — règle du 2026-08-10 sur le chargement des données).
 */
export async function markNotificationAsRead(notificationId: string): Promise<DashboardNotification> {
  const { data } = await apiClient.post<DashboardNotification>(`/notifications/${notificationId}/read`)
  return data
}
