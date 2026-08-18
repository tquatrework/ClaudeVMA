import React, { useMemo } from 'react'
import { useLinkedCalendarBusyFree } from '../../hooks/calendar/useLinkedCalendarBusyFree'
import { toBusyFreeGridBlocks, type BusyFreeGridBlock } from '../../utils/linkedCalendarBusyFree'
import AvailabilityGrid from './AvailabilityGrid'

interface LinkedCalendarViewProps {
  /** Titulaire du calendrier consulté (jamais l'appelant lui-même dans cet usage). */
  ownerId: string
  /** Bornes ISO 8601 de la fenêtre lue — `from` inclusif, `to` exclusif. */
  from: string
  to: string
}

const LEGEND_ENTRIES: Array<{ kind: BusyFreeGridBlock['kind']; label: string; swatchClassName: string }> = [
  { kind: 'AVAILABLE', label: 'Disponible', swatchClassName: 'bg-green-100 border-green-300' },
  { kind: 'UNAVAILABLE', label: 'Indisponible', swatchClassName: 'bg-gray-200 border-gray-300' },
  { kind: 'BUSY', label: 'Occupé', swatchClassName: 'bg-amber-100 border-amber-300' },
]

/**
 * LinkedCalendarView — calendrier busy/free d'un tiers **lié**, en lecture strictement seule
 * (`GET /calendars/:ownerId/busy`, docs/routes.md § calendar-service > "Visibilité busy/free").
 * Réutilise `AvailabilityGrid` (point 1) en mode lecture seule plutôt que d'écrire une seconde
 * grille — les trois catégories de la réponse (`availableWindows`, `unavailableBlocks`,
 * `busyBlocks`) y sont traduites par `toBusyFreeGridBlocks`
 * (`src/utils/linkedCalendarBusyFree.ts`), sans jamais afficher de contenu : un bloc occupé ne
 * porte que la mention « Occupé », jamais de titre ni de type d'activité.
 *
 * Composant volontairement autonome et sans point de montage définitif pour l'instant — il sera
 * intégré au flux de proposition de créneau (point 3 du chantier calendrier de disponibilités),
 * qui décidera de son emplacement dans la navigation.
 */
export default function LinkedCalendarView({ ownerId, from, to }: LinkedCalendarViewProps) {
  const { data, isLoading, error, errorKind } = useLinkedCalendarBusyFree(ownerId, from, to)

  const gridBlocks = useMemo<BusyFreeGridBlock[]>(() => {
    if (!data) return []
    return [
      ...toBusyFreeGridBlocks(data.availableWindows, 'AVAILABLE'),
      ...toBusyFreeGridBlocks(data.unavailableBlocks, 'UNAVAILABLE'),
      ...toBusyFreeGridBlocks(data.busyBlocks, 'BUSY'),
    ]
  }, [data])

  if (isLoading) {
    return <p className="text-gray-400 text-sm">Chargement du calendrier…</p>
  }

  if (error) {
    return (
      <div
        className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"
        role="alert"
        data-error-kind={errorKind ?? undefined}
      >
        {error}
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">
        Calendrier en lecture seule — seules les disponibilités, indisponibilités et périodes
        occupées sont visibles, jamais le contenu des activités.
      </p>

      <div className="flex flex-wrap gap-4 mb-3 text-xs text-gray-600">
        {LEGEND_ENTRIES.map((entry) => (
          <span key={entry.kind} className="inline-flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded border ${entry.swatchClassName}`} aria-hidden="true" />
            {entry.label}
          </span>
        ))}
      </div>

      {gridBlocks.length === 0 && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
          <p className="text-sm text-gray-400">Aucun créneau sur cette période</p>
        </div>
      )}

      <AvailabilityGrid slots={gridBlocks} onCreateAt={() => {}} onEditSlot={() => {}} readOnly />
    </div>
  )
}
