import { useCallback, useEffect, useState } from 'react'
import { quarterIndexToTime } from '../../utils/calendarQuarterHour'
import { addOneHourToTime } from '../../utils/availabilityTime'

export interface GridDragAnchor {
  dayOfWeek: number
  quarterIndex: number
}

export interface UseGridRangeSelectionOptions {
  /** Heure de départ de la grille (`GRID_START_HOUR`), pour convertir un index de quart en `HH:mm`. */
  gridStartHour: number
  /**
   * Appelé une fois la sélection terminée (relâchement de la souris). Un simple clic (sans
   * glissement) produit une plage par défaut d'une heure ; un glissement produit la plage
   * réellement survolée, au quart d'heure près.
   */
  onSelectRange: (dayOfWeek: number, startTime: string, endTime: string) => void
  /** `false` désactive tout déclenchement (lecture seule, ou création non autorisée). */
  enabled: boolean
}

export interface UseGridRangeSelectionResult {
  /** Ce quart d'heure appartient-il à la sélection en cours (pour le surlignage visuel) ? */
  isQuarterSelected: (dayOfWeek: number, quarterIndex: number) => boolean
  /** Amorce une sélection — appelé au `mousedown` sur un quart d'heure. */
  startDrag: (dayOfWeek: number, quarterIndex: number) => void
  /** Étend la sélection en cours — appelé au `mouseenter` d'un quart d'heure pendant un glissement. */
  extendDrag: (dayOfWeek: number, quarterIndex: number) => void
}

/**
 * useGridRangeSelection — sélection multi-créneaux par glisser sur `AvailabilityGrid` (correction
 * du 2026-08-20, point C). La grille est subdivisée en quarts d'heure pour l'interaction
 * (`calendarQuarterHour.ts`), sans que cette subdivision soit tracée visuellement — seul un
 * `mousedown` + `mouseenter` + `mouseup` sur les cases concernées la révèle.
 *
 * Le relâchement de la souris est écouté sur `window` (et non sur le seul bouton visé) : un
 * glissement peut se terminer hors de la grille (ex. relâché sur l'en-tête), et la sélection doit
 * malgré tout se finaliser sur la dernière case survolée.
 */
export function useGridRangeSelection({
  gridStartHour,
  onSelectRange,
  enabled,
}: UseGridRangeSelectionOptions): UseGridRangeSelectionResult {
  const [anchor, setAnchor] = useState<GridDragAnchor | null>(null)
  const [current, setCurrent] = useState<number | null>(null)

  const startDrag = useCallback(
    (dayOfWeek: number, quarterIndex: number) => {
      if (!enabled) return
      setAnchor({ dayOfWeek, quarterIndex })
      setCurrent(quarterIndex)
    },
    [enabled],
  )

  const extendDrag = useCallback((dayOfWeek: number, quarterIndex: number) => {
    setAnchor((activeAnchor) => {
      if (activeAnchor && activeAnchor.dayOfWeek === dayOfWeek) {
        setCurrent(quarterIndex)
      }
      return activeAnchor
    })
  }, [])

  useEffect(() => {
    if (!anchor) return undefined

    const handleMouseUp = () => {
      const endIndex = current ?? anchor.quarterIndex
      const startIndex = Math.min(anchor.quarterIndex, endIndex)
      const lastIndex = Math.max(anchor.quarterIndex, endIndex)
      const startTime = quarterIndexToTime(startIndex, gridStartHour)
      const endTime =
        startIndex === lastIndex
          ? addOneHourToTime(startTime)
          : quarterIndexToTime(lastIndex + 1, gridStartHour)

      onSelectRange(anchor.dayOfWeek, startTime, endTime)
      setAnchor(null)
      setCurrent(null)
    }

    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [anchor, current, gridStartHour, onSelectRange])

  const isQuarterSelected = useCallback(
    (dayOfWeek: number, quarterIndex: number) => {
      if (!anchor || anchor.dayOfWeek !== dayOfWeek) return false
      const endIndex = current ?? anchor.quarterIndex
      const startIndex = Math.min(anchor.quarterIndex, endIndex)
      const lastIndex = Math.max(anchor.quarterIndex, endIndex)
      return quarterIndex >= startIndex && quarterIndex <= lastIndex
    },
    [anchor, current],
  )

  return { isQuarterSelected, startDrag, extendDrag }
}
