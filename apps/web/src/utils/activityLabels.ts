/**
 * Libellés français des activités planifiées (`ScheduledActivity`) — point unique de
 * traduction technique → français (règle du 2026-08-09), sur le modèle de
 * `notificationLabels.ts`/`teacherRequestLabels.ts`.
 */

import type { ActivityStatus, ActivityType } from '../types/calendar'

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  cours: 'Cours',
  reunion_pedagogique: 'Réunion pédagogique',
  entretien_rp: 'Entretien avec le responsable pédagogique',
  rappel: 'Rappel',
  autre: 'Autre',
}

export function getActivityTypeLabel(type: ActivityType): string {
  return ACTIVITY_TYPE_LABELS[type] ?? type
}

const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  proposed: 'En attente de réponse',
  confirmed: 'Accepté',
  cancelled: 'Refusé',
  completed: 'Terminé',
}

export function getActivityStatusLabel(status: ActivityStatus): string {
  return ACTIVITY_STATUS_LABELS[status] ?? status
}

/** Classes Tailwind par statut, pour `StatusBadge`. */
export const ACTIVITY_STATUS_BADGE_CLASSES: Record<ActivityStatus, string> = {
  proposed: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-500',
}
