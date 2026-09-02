/**
 * useCountdownTimer — décompte vers une échéance ISO, mis à jour chaque seconde.
 *
 * Hook transverse (pas de logique métier) — premier besoin réel : le chronomètre d'une tentative
 * d'Évaluation (`deadlineAt`), mais réutilisable pour tout compte à rebours futur. Aucun décompte
 * de ce type n'existait déjà dans le projet (`formatCountdown` dans `utils/dateFormat.ts` calcule
 * un texte statique au moment de l'appel, il ne s'auto-actualise pas).
 */

import { useEffect, useState } from 'react'

export interface CountdownTimerState {
  remainingSeconds: number
  isExpired: boolean
  /** Format `mm:ss` (ou `hh:mm:ss` au-delà d'une heure), jamais négatif à l'affichage. */
  formatted: string
}

function formatRemaining(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds)
  const hours = Math.floor(clamped / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const seconds = Math.floor(clamped % 60)
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

/** @param deadlineIso Échéance ISO. `null` désactive le décompte (pas de tentative démarrée). */
export function useCountdownTimer(deadlineIso: string | null): CountdownTimerState {
  const computeRemaining = () =>
    deadlineIso ? Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 1000) : 0

  const [remainingSeconds, setRemainingSeconds] = useState(computeRemaining)

  useEffect(() => {
    if (!deadlineIso) {
      setRemainingSeconds(0)
      return
    }
    setRemainingSeconds(computeRemaining())
    const intervalId = setInterval(() => {
      setRemainingSeconds(computeRemaining())
    }, 1000)
    return () => clearInterval(intervalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineIso])

  return {
    remainingSeconds,
    isExpired: remainingSeconds <= 0,
    formatted: formatRemaining(remainingSeconds),
  }
}
