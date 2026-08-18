/**
 * linkedCalendarBusyFree.ts — traduction des blocs busy/free (`{start, end}` ISO 8601 UTC,
 * `GET /calendars/:ownerId/busy`, docs/routes.md § calendar-service > "Visibilité busy/free")
 * vers la représentation attendue par `AvailabilityGrid` (grille hebdomadaire, `dayOfWeek` +
 * `HH:mm`), pour réutiliser ce composant en lecture seule plutôt que d'en écrire un second.
 *
 * Fonctions pures, aucun appel réseau ni état React — même esprit que `availabilityTime.ts` et
 * `availabilitySlotApiMapping.ts`, dont `extractTimeOfDayFromIso` est réutilisée ici plutôt que
 * réimplémentée.
 */

import type { BusyFreeTimeBlock } from '../types/calendar'
import { extractTimeOfDayFromIso } from './availabilitySlotApiMapping'

/**
 * Catégorie d'un bloc affiché sur la grille en lecture seule — les deux premières valeurs
 * partagent le vocabulaire de `AvailabilityKind` (créneaux de disponibilité déclarés par le
 * titulaire), `BUSY` est propre à cette vue (activités du titulaire, jamais éditable, jamais de
 * contenu affiché).
 */
export type BusyFreeGridBlockKind = 'AVAILABLE' | 'UNAVAILABLE' | 'BUSY'

/** Bloc affichable par `AvailabilityGrid`, en lecture seule. */
export interface BusyFreeGridBlock {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  kind: BusyFreeGridBlockKind
}

/**
 * Jour de semaine (0 dimanche … 6 samedi) d'une date ISO 8601, en UTC — même convention que
 * `dayOfWeek` sur les créneaux de disponibilité (`Date.prototype.getUTCDay()`, jamais le fuseau
 * du navigateur, pour rester cohérent avec `extractTimeOfDayFromIso`). `null` si la chaîne
 * n'est pas une date valide.
 */
export function extractDayOfWeekFromIso(isoDateTime: string): number | null {
  const parsed = new Date(isoDateTime)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.getUTCDay()
}

/**
 * Traduit un bloc busy/free vers un bloc affichable par `AvailabilityGrid`. `null` si `start`
 * n'est pas une date exploitable — un bloc illisible est ignoré, jamais affiché avec une heure
 * inventée.
 *
 * Un bloc qui chevauche minuit (jour de fin différent du jour de début) est **écrêté
 * visuellement** à la fin de la journée de début (`23:59`) : cette vue est en lecture seule et
 * purement informative, aucune valeur affichée n'est jamais renvoyée au serveur.
 */
export function toBusyFreeGridBlock(
  block: BusyFreeTimeBlock,
  kind: BusyFreeGridBlockKind,
  index: number,
): BusyFreeGridBlock | null {
  const dayOfWeek = extractDayOfWeekFromIso(block.start)
  const startTime = extractTimeOfDayFromIso(block.start)
  if (dayOfWeek === null || startTime === null) return null

  const endDayOfWeek = extractDayOfWeekFromIso(block.end)
  const rawEndTime = extractTimeOfDayFromIso(block.end)
  const endTime = endDayOfWeek === dayOfWeek && rawEndTime !== null ? rawEndTime : '23:59'

  return {
    id: `${kind}-${index}-${block.start}`,
    dayOfWeek,
    startTime,
    endTime,
    kind,
  }
}

/** Traduit une liste de blocs busy/free d'une même catégorie. Blocs illisibles écartés. */
export function toBusyFreeGridBlocks(
  blocks: BusyFreeTimeBlock[],
  kind: BusyFreeGridBlockKind,
): BusyFreeGridBlock[] {
  return blocks
    .map((block, index) => toBusyFreeGridBlock(block, kind, index))
    .filter((block): block is BusyFreeGridBlock => block !== null)
}
