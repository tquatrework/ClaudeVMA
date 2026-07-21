/**
 * OpenActivitiesList — liste des activités non pourvues.
 * Extrait de OpenActivitiesPage (lot 10 — normalisation, découpage > 300 lignes).
 */

import React from 'react'
import { StatusBadge } from '../ui/StatusBadge'
import {
  OPEN_ACTIVITY_STATUS_LABELS,
  OPEN_ACTIVITY_STATUS_BADGE_CLASSES,
} from '../../types/learningActivity'
import type { OpenActivity } from '../../api/learningActivity'

interface OpenActivitiesListProps {
  activityList: OpenActivity[]
  onSelectActivity: (activityId: string) => void
}

export function OpenActivitiesList({ activityList, onSelectActivity }: OpenActivitiesListProps) {
  if (activityList.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-gray-400 text-sm">Aucune activité non pourvue pour le moment.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {activityList.map((activity) => (
        <li key={activity.id}>
          <button
            type="button"
            onClick={() => onSelectActivity(activity.id)}
            className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{activity.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{activity.description}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    {activity.subject}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {activity.level}
                  </span>
                  {activity.deadline && (
                    <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded">
                      Date limite : {new Date(activity.deadline).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                <StatusBadge
                  status={activity.status}
                  label={OPEN_ACTIVITY_STATUS_LABELS[activity.status]}
                  badgeClasses={OPEN_ACTIVITY_STATUS_BADGE_CLASSES}
                />
                <span className="text-xs text-gray-400">
                  {activity.filledSlots}/{activity.requiredSlots} poste
                  {activity.requiredSlots > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
