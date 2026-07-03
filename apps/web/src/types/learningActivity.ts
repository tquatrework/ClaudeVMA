/**
 * Types partagés — Activités non pourvues (learning-activity-service)
 * Partagés entre OpenActivitiesPage et OpenActivityDetailPage.
 */

export type OpenActivityStatus = 'open' | 'partially_filled' | 'filled' | 'cancelled'

/** Libellés affichés par statut d'activité non pourvue */
export const OPEN_ACTIVITY_STATUS_LABELS: Record<OpenActivityStatus, string> = {
  open: 'Ouverte',
  partially_filled: 'Partiellement pourvue',
  filled: 'Pourvue',
  cancelled: 'Annulée',
}

/** Classes CSS de badge par statut d'activité non pourvue */
export const OPEN_ACTIVITY_STATUS_BADGE_CLASSES: Record<OpenActivityStatus, string> = {
  open: 'bg-green-100 text-green-700',
  partially_filled: 'bg-yellow-100 text-yellow-700',
  filled: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-700',
}
