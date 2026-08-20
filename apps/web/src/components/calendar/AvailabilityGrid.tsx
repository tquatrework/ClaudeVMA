import React from 'react'
import { AVAILABILITY_DAY_OPTIONS, getDayLabel } from '../../utils/availabilityDays'
import {
  GRID_START_HOUR,
  GRID_END_HOUR,
  computeVerticalPosition,
  formatTimeRangeLabel,
} from '../../utils/availabilityTime'
import {
  QUARTERS_PER_HOUR,
  absoluteQuarterIndex,
  formatQuarterTime,
} from '../../utils/calendarQuarterHour'
import { formatDisplayDayDate, type CalendarDisplayDay } from '../../utils/calendarDisplayWeek'
import { useGridRangeSelection } from '../../hooks/calendar/useGridRangeSelection'

const HOUR_ROW_HEIGHT_PX = 40
const QUARTER_ROW_HEIGHT_PX = HOUR_ROW_HEIGHT_PX / QUARTERS_PER_HOUR
const GRID_HOURS = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR },
  (_, index) => GRID_START_HOUR + index,
)
const GRID_HEIGHT_PX = GRID_HOURS.length * HOUR_ROW_HEIGHT_PX

/** Un quart d'heure de la grille — cible d'interaction, jamais tracé visuellement (point C). */
const QUARTER_CELLS = GRID_HOURS.flatMap((hour) =>
  Array.from({ length: QUARTERS_PER_HOUR }, (_, quarterInHour) => ({ hour, quarterInHour })),
)

/**
 * Catégorie affichable par la grille — `AVAILABLE`/`UNAVAILABLE` sont les créneaux éditables du
 * titulaire (point 1) ; `BUSY` s'y ajoute pour la vue busy/free d'un tiers lié en lecture seule
 * (point 2, `LinkedCalendarView`) — un bloc « Occupé » n'est jamais un créneau créable/éditable.
 * `PROPOSED`/`CONFIRMED` s'y ajoutent pour les propositions/confirmations de créneau de cours
 * (point 3, `CalendarUnifiedView` + `useOwnerCalendarActivities`) — jamais éditables non plus, mais
 * `PROPOSED` porte des actions inline (accepter/refuser), voir `renderBlockOverlay`.
 * `EVENT` s'y ajoute pour les événements de calendrier (`CalendarEvent`,
 * `GET /calendars/:ownerId/events`) fusionnés visuellement sur la même grille (chantier calendrier
 * vue unifiée, point 1) — jamais éditable par clic direct sur le bloc (l'édition d'un événement
 * n'existe pas côté front) : le clic ouvre un détail en lecture, voir `renderBlockOverlay` et
 * `onOverlayBlockClick`. `EVENT_PENDING` en est une variante : un événement où le titulaire de la
 * grille est **invité** et n'a pas encore répondu (`viewerInvitationStatus: "pending"`) — couleur
 * dédiée pour le distinguer au premier coup d'œil ; le clic ouvre le même détail, qui porte alors
 * Accepter/Refuser (bug réel corrigé le 2026-08-20, voir `CalendarUnifiedView`).
 */
export type AvailabilityGridBlockKind =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'BUSY'
  | 'PROPOSED'
  | 'CONFIRMED'
  | 'EVENT'
  | 'EVENT_PENDING'

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
  // Pastel/plus clair que `CONFIRMED` — un créneau proposé n'est pas encore acquis.
  PROPOSED: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  CONFIRMED: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
  // Couleur distincte (rose), inutilisée par les autres kinds, pour distinguer un événement de
  // calendrier d'une proposition/confirmation de cours au premier coup d'œil.
  EVENT: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100',
  // Couleur distincte (orange), volontairement différente de EVENT (rose), BUSY (amber) et
  // PROPOSED/CONFIRMED (indigo) — une invitation en attente ne doit pas se confondre avec un
  // événement déjà accepté (bug réel corrigé le 2026-08-20, voir CalendarUnifiedView).
  EVENT_PENDING: 'bg-orange-50 text-orange-700 border border-orange-300 hover:bg-orange-100',
}

const KIND_LABELS: Record<AvailabilityGridBlockKind, string> = {
  AVAILABLE: 'Disponible',
  UNAVAILABLE: 'Indisponible',
  BUSY: 'Occupé',
  PROPOSED: 'Proposition de cours',
  CONFIRMED: 'Cours confirmé',
  EVENT: 'Événement',
  EVENT_PENDING: 'Invitation en attente',
}

function formatHourLabel(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`
}

interface AvailabilityGridProps<T extends AvailabilityGridSlot> {
  slots: T[]
  /**
   * Sélection terminée sur une plage de cases vides (correction du 2026-08-20, point C) — un
   * simple clic produit une plage par défaut d'une heure, un glissement produit la plage
   * réellement survolée, au quart d'heure près. Remplace l'ancien `onCreateAt(dayOfWeek,
   * startTime)`, qui ne portait pas de fin. Sans effet en lecture seule.
   */
  onCreateAt: (dayOfWeek: number, startTime: string, endTime: string) => void
  /** Bloc de créneau existant cliqué — ouvre le formulaire en édition/suppression. Sans effet en lecture seule. */
  onEditSlot: (slot: T) => void
  /**
   * Lecture seule — désactive toute interaction d'édition (cellules vides ET blocs existants).
   * Utilisée par `LinkedCalendarView` (point 2) pour la vue busy/free d'un tiers lié ; jamais
   * activée sur ses propres disponibilités (point 1, `CalendarUnifiedView`).
   */
  readOnly?: boolean
  /**
   * Cellule horaire vide cliquable pour créer un nouvel objet — distinct de `readOnly`, qui
   * désactive aussi l'édition des blocs existants. `canCreate: false` désactive uniquement la
   * création sur cellule vide (absence de mode actif sur `CalendarModeSelector` — correction du
   * 2026-08-20, point A) sans toucher à l'édition des disponibilités existantes ni à la
   * consultation des autres blocs. Par défaut `true`.
   */
  canCreate?: boolean
  /**
   * Jours réels de la semaine affichée (correction du 2026-08-20, point B) — quand fourni, la
   * date de chaque jour (ex. « 18/08 ») s'affiche sous son nom dans l'en-tête. Optionnel : une
   * grille en lecture seule sans notion de semaine navigable (`LinkedCalendarView`) peut s'en
   * passer, elle affiche alors seulement le nom du jour, comme avant.
   */
  days?: CalendarDisplayDay[]
  /**
   * Rendu additionnel superposé à un bloc — utilisé par `CalendarUnifiedView` (point 3) pour les
   * actions inline Accepter/Refuser d'une proposition de créneau de cours, l'affichage (sans
   * action) d'un cours déjà confirmé, ou le libellé d'un événement de calendrier (point 1). Quand
   * cette fonction renvoie un contenu non `null` pour un `slot` donné, le bloc n'est **plus**
   * cliquable pour l'édition (rendu en `<div>`, jamais en `<button>` imbriqué) — seuls les
   * contrôles renvoyés le sont, `onEditSlot` n'est alors jamais invoqué pour ce bloc ; voir
   * `onOverlayBlockClick` pour le déclenchement d'une action au clic sur le bloc lui-même.
   */
  renderBlockOverlay?: (slot: T) => React.ReactNode
  /**
   * Clic sur un bloc dont `renderBlockOverlay` a renvoyé un contenu — le `<div>` porteur de
   * l'overlay n'a par défaut aucune interaction propre en dehors des contrôles qu'il superpose ;
   * ce callback comble ce vide (chantier calendrier vue unifiée, point 4 : « cliquer sur le
   * créneau pour y voir apparaître Accepter/Refuser »). Le clic sur un contrôle interne (bouton
   * Accepter/Refuser/Rejoindre) remonte aussi ici par bouillonnement DOM — sans effet indésirable,
   * voir `CalendarUnifiedView` pour la logique de bascule.
   */
  onOverlayBlockClick?: (slot: T) => void
}

/**
 * AvailabilityGrid — grille hebdomadaire Tailwind faite main, 7 colonnes (lundi → dimanche),
 * plage 07:00–22:00. Interaction (révisée le 2026-08-20, point C) : clic sur une case vide pour
 * créer une plage d'une heure par défaut, glisser sur plusieurs cases pour créer une plage exacte
 * au quart d'heure près — le tout ajustable ensuite dans la modale de détails de l'appelant. Clic
 * sur un bloc existant pour éditer/supprimer.
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
  canCreate = true,
  days,
  renderBlockOverlay,
  onOverlayBlockClick,
}: AvailabilityGridProps<T>) {
  const { isQuarterSelected, startDrag, extendDrag } = useGridRangeSelection({
    gridStartHour: GRID_START_HOUR,
    onSelectRange: onCreateAt,
    enabled: !readOnly && canCreate,
  })

  const dateByDayOfWeek = new Map((days ?? []).map((day) => [day.dayOfWeek, day.date]))

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="grid grid-cols-[3rem_repeat(7,1fr)] border-b border-gray-200 bg-gray-50">
        <div className="p-2" />
        {AVAILABILITY_DAY_OPTIONS.map((day) => {
          const realDate = dateByDayOfWeek.get(day.value)
          return (
            <div
              key={day.value}
              className="p-2 text-xs font-medium text-gray-600 text-center border-l border-gray-200"
            >
              <div>{day.label}</div>
              {realDate && (
                <div className="text-[10px] font-normal text-gray-400">
                  {formatDisplayDayDate(realDate)}
                </div>
              )}
            </div>
          )
        })}
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
              {QUARTER_CELLS.map(({ hour, quarterInHour }) => {
                const absoluteIndex = absoluteQuarterIndex(hour, quarterInHour, GRID_START_HOUR)
                const quarterStartTime = formatQuarterTime(hour, quarterInHour)
                const isSelected = isQuarterSelected(day.value, absoluteIndex)
                return (
                  <button
                    key={absoluteIndex}
                    type="button"
                    disabled={readOnly || !canCreate}
                    onMouseDown={() => startDrag(day.value, absoluteIndex)}
                    onMouseEnter={() => extendDrag(day.value, absoluteIndex)}
                    aria-label={`Ajouter un créneau ${day.label.toLowerCase()} à ${quarterStartTime}`}
                    className={`absolute left-0 right-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-default ${
                      quarterInHour === 0 ? 'border-b border-gray-100' : ''
                    } ${canCreate ? 'hover:bg-indigo-50 disabled:hover:bg-transparent' : ''} ${
                      isSelected ? 'bg-indigo-100' : ''
                    }`}
                    style={{
                      top: `${(hour - GRID_START_HOUR) * HOUR_ROW_HEIGHT_PX + quarterInHour * QUARTER_ROW_HEIGHT_PX}px`,
                      height: `${QUARTER_ROW_HEIGHT_PX}px`,
                    }}
                  />
                )
              })}

              {daySlots.map((slot) => {
                const { topPercent, heightPercent } = computeVerticalPosition(
                  slot.startTime,
                  slot.endTime,
                )
                const style = {
                  top: `${topPercent}%`,
                  height: `${Math.max(heightPercent, 4)}%`,
                }
                const overlay = renderBlockOverlay?.(slot)

                if (overlay) {
                  // `overflow-hidden` a été retiré délibérément : un bloc PROPOSED/CONFIRMED peut
                  // révéler un contenu (boutons Accepter/Refuser, "Rejoindre le cours") plus haut
                  // que la hauteur du créneau lui-même (calculée sur sa seule durée réelle). Avec
                  // `overflow-hidden`, ce contenu restait présent dans le DOM — cliquable par un
                  // test, invisible pour un utilisateur réel, un bloc de 40px de haut coupant un
                  // bouton commençant 3px sous son bord bas. `z-10` fait passer ce débordement
                  // au-dessus des blocs voisins (chevauchement temporaire assumé) plutôt que sous.
                  return (
                    <div
                      key={slot.id}
                      onClick={onOverlayBlockClick ? () => onOverlayBlockClick(slot) : undefined}
                      className={`absolute left-0.5 right-0.5 z-10 rounded px-1 py-0.5 text-[10px] leading-tight ${KIND_STYLES[slot.kind]} ${
                        onOverlayBlockClick ? 'cursor-pointer' : ''
                      }`}
                      style={style}
                    >
                      {overlay}
                    </div>
                  )
                }

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
                    className={`absolute left-0.5 right-0.5 z-10 rounded px-1 py-0.5 text-[10px] leading-tight text-left overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-default disabled:hover:bg-none ${KIND_STYLES[slot.kind]}`}
                    style={style}
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
