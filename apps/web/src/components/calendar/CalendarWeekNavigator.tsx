import React from 'react'
import { formatWeekRangeLabel } from '../../utils/calendarDisplayWeek'

interface CalendarWeekNavigatorProps {
  weekStart: Date
  isCurrentWeek: boolean
  onPreviousWeek: () => void
  onNextWeek: () => void
  onToday: () => void
}

/**
 * CalendarWeekNavigator — navigation semaine par semaine au-dessus de la grille unifiée
 * (correction du 2026-08-20, point B). Affiche le libellé de la semaine affichée (mois/année) et
 * permet de créer un événement au-delà de la semaine courante — la grille étant désormais la vue
 * d'une semaine calendaire précise plutôt qu'un gabarit hebdomadaire récurrent.
 */
export default function CalendarWeekNavigator({
  weekStart,
  isCurrentWeek,
  onPreviousWeek,
  onNextWeek,
  onToday,
}: CalendarWeekNavigatorProps) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPreviousWeek}
          aria-label="Semaine précédente"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={onNextWeek}
          aria-label="Semaine suivante"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          ›
        </button>
        {!isCurrentWeek && (
          <button
            type="button"
            onClick={onToday}
            className="text-xs text-indigo-600 hover:underline px-1"
          >
            Aujourd'hui
          </button>
        )}
      </div>
      <p className="text-sm font-medium text-gray-700">{formatWeekRangeLabel(weekStart)}</p>
    </div>
  )
}
