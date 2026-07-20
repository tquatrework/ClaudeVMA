import { fetchNotifications } from '../../api/dashboardNotifications'
import type { DashboardNotification } from '../../types/dashboard'
import { useAsyncData } from '../useAsyncData'

export interface UseDashboardNotificationsResult {
  notifications: DashboardNotification[]
  isLoadingNotifications: boolean
  notificationsError: string | null
}

/**
 * useDashboardNotifications — charge GET /notifications et n'en garde que les `limit`
 * premières, factorisant la logique identique dupliquée entre EleveDashboardPage,
 * ProfesseurDashboardPage, ApDashboardPage et RpDashboardPage (chacune n'affiche qu'un
 * nombre différent d'entrées via `ActivityFeed`).
 *
 * `ActivityFeed` n'a pas de créneau d'affichage d'erreur (comportement préexistant :
 * l'échec de chargement des notifications dégradait silencieusement vers la liste vide,
 * jamais vers un message bloquant) — `notificationsError` est exposé pour un usage futur
 * mais n'est pas rendu par ces pages, à l'identique du comportement d'origine.
 */
export function useDashboardNotifications(limit: number): UseDashboardNotificationsResult {
  const { data, isLoading, error } = useAsyncData(fetchNotifications, [], {
    fallbackErrorMessage: 'Impossible de charger les notifications',
  })

  return {
    notifications: (data ?? []).slice(0, limit),
    isLoadingNotifications: isLoading,
    notificationsError: error,
  }
}
