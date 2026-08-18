import React from 'react'
import { AVAILABILITY_DAY_OPTIONS, getDayLabel } from '../../utils/availabilityDays'
import {
  GRID_START_HOUR,
  GRID_END_HOUR,
  computeVerticalPosition,
  formatTimeRangeLabel,
} from '../../utils/availabilityTime'

const HOUR_ROW_HEIGHT_PX = 40
const GRID_HOURS = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR },
  (_, index) => GRID_START_HOUR + index,
)
const GRID_HEIGHT_PX = GRID_HOURS.length * HOUR_ROW_HEIGHT_PX

/**
 * Catégorie affichable par la grille — `AVAILABLE`/`UNAVAILABLE` sont les créneaux éditables du
 * titulaire (point 1) ; `BUSY` s'y ajoute pour la vue busy/free d'un tiers lié en lecture seule
 * (point 2, `LinkedCalendarView`) — un bloc « Occupé » n'est jamais un créneau créable/éditable.
 */
export type AvailabilityGridBlockKind = 'AVAILABLE' | 'UNAVAILABLE' | 'BUSY'

/**
 * Forme minimale attendue par la grille. `AvailabilitySlot` (point 1) et `BusyFreeGridBlock`
 * (point 2, `src/utils/linkedCalendarBusyFree.ts`) la satisfont toutes les deux — la grille reste
 * générique sur le type exact reçu (`T`) pour que `onEditSlot` reçoive l'objet complet d'origine,
 * jamais une forme appauvrie.
 */
export interface AvailabilityGridSlot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  kind: AvailabilityGridBlockKind
}

const KIND_STYLES: Record<AvailabilityGridBlockKind, string> = {
  AVAILABLE: 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200',
  UNAVAILABLE: 'bg-gray-200 text-gray-700 border border-gray-300 hover:bg-gray-300',
  BUSY: 'bg-amber-100 text-amber-800 border border-amber-300',
}

const KIND_LABELS: Record<AvailabilityGridBlockKind, string> = {
  AVAILABLE: 'Disponible',
  UNAVAILABLE: 'Indisponible',
  BUSY: 'Occupé',
}

function formatHourLabel(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`
}

interface AvailabilityGridProps<T extends AvailabilityGridSlot> {
  slots: T[]
  /** Cellule horaire vide cliquée — ouvre le formulaire de création pré-rempli. Sans effet en lecture seule. */
  onCreateAt: (dayOfWeek: number, startTime: string) => void
  /** Bloc de créneau existant cliqué — ouvre le formulaire en édition/suppression. Sans effet en lecture seule. */
  onEditSlot: (slot: T) => void
  /**
   * Lecture seule — désactive toute interaction d'édition (cellules vides ET blocs existants).
   * Utilisée par `LinkedCalendarView` (point 2) pour la vue busy/free d'un tiers lié ; jamais
   * activée sur ses propres disponibilités (point 1, `AvailabilityTab`).
   */
  readOnly?: boolean
}

/**
 * AvailabilityGrid — grille hebdomadaire Tailwind faite main, 7 colonnes (lundi → dimanche),
 * plage 07:00–22:00. Interaction retenue (arbitrage) : clic sur une cellule horaire vide pour
 * créer, clic sur un bloc existant pour éditer/supprimer — pas de clic-glisser.
 *
 * Générique sur `T` (contraint par `AvailabilityGridSlot`) pour que `onEditSlot` reçoive
 * toujours l'objet complet fourni par l'appelant (`AvailabilitySlot` au point 1,
 * `BusyFreeGridBlock` au point 2), jamais une forme appauvrie au type minimal de la grille.
 */
export default function AvailabilityGrid<T extends AvailabilityGridSlot>({
  slots,
  onCreateAt,
  onEditSlot,
  readOnly = false,
}: AvailabilityGridProps<T>) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="grid grid-cols-[3rem_repeat(7,1fr)] border-b border-gray-200 bg-gray-50">
        <div className="p-2" />
        {AVAILABILITY_DAY_OPTIONS.map((day) => (
          <div
            key={day.value}
            className="p-2 text-xs font-medium text-gray-600 text-center border-l border-gray-200"
          >
            {day.label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[3rem_repeat(7,1fr)]">
        <div className="relative" style={{ height: `${GRID_HEIGHT_PX}px` }}>
          {GRID_HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 text-[10px] text-gray-400 -translate-y-1/2 pr-1 text-right"
              style={{ top: `${(hour - GRID_START_HOUR) * HOUR_ROW_HEIGHT_PX}px` }}
            >
              {formatHourLabel(hour)}
            </div>
          ))}
        </div>

        {AVAILABILITY_DAY_OPTIONS.map((day) => {
          const daySlots = slots.filter((slot) => slot.dayOfWeek === day.value)
          return (
            <div
              key={day.value}
              className="relative border-l border-gray-100"
              style={{ height: `${GRID_HEIGHT_PX}px` }}
            >
              {GRID_HOURS.map((hour) => {
                const cellStartTime = formatHourLabel(hour)
                return (
                  <button
                    key={hour}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onCreateAt(day.value, cellStartTime)}
                    aria-label={`Ajouter un créneau ${day.label.toLowerCase()} à ${cellStartTime}`}
                    className="absolute left-0 right-0 border-b border-gray-100 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:hover:bg-transparent disabled:cursor-default"
                    style={{
                      top: `${(hour - GRID_START_HOUR) * HOUR_ROW_HEIGHT_PX}px`,
                      height: `${HOUR_ROW_HEIGHT_PX}px`,
                    }}
                  />
                )
              })}

              {daySlots.map((slot) => {
                const { topPercent, heightPercent } = computeVerticalPosition(
                  slot.startTime,
                  slot.endTime,
                )
                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onEditSlot(slot)}
                    aria-label={`${readOnly ? 'Consulter' : 'Modifier'} le créneau ${getDayLabel(
                      slot.dayOfWeek,
                    ).toLowerCase()} ${formatTimeRangeLabel(slot.startTime, slot.endTime)} — ${
                      KIND_LABELS[slot.kind]
                    }`}
                    className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] leading-tight text-left overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-default disabled:hover:bg-none ${KIND_STYLES[slot.kind]}`}
                    style={{
                      top: `${topPercent}%`,
                      height: `${Math.max(heightPercent, 4)}%`,
                    }}
                  >
                    <span className="block font-medium">{KIND_LABELS[slot.kind]}</span>
                    <span className="block">
                      {formatTimeRangeLabel(slot.startTime, slot.endTime)}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
