/**
 * Module API — dashboard-notification-service
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'
import type { DashboardNotification } from '../types/dashboard'
import { normalizeListResponse } from '../utils/dashboardFormat'

/**
 * GET /notifications — Liste mes notifications.
 * Le backend peut répondre un tableau ou une enveloppe `{ data: [...] }` — normalisé ici via
 * `normalizeListResponse` pour que les hooks appelants reçoivent toujours un tableau.
 */
export async function fetchNotifications(): Promise<DashboardNotification[]> {
  const { data } = await apiClient.get<{ data?: DashboardNotification[] } | DashboardNotification[]>(
    '/notifications',
  )
  return normalizeListResponse(data)
}
