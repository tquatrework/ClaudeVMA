import { useCallback, useState } from 'react'
import { fetchFinanceEvents, updateRewardSettings } from '../../api/finance'
import type { FinanceEvent, RewardSettings } from '../../api/finance'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage } from '../../utils/apiError'

function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

async function loadFinanceEvents(enabled: boolean): Promise<FinanceEvent[]> {
  if (!enabled) return pendingForever<FinanceEvent[]>()
  return fetchFinanceEvents()
}

export interface UseFinanceDashboardResult {
  financeEvents: FinanceEvent[]
  isLoadingEvents: boolean
  eventsError: string | null

  rewardSettings: RewardSettings
  /** PATCH /financial-settings/rewards — met à jour localement `rewardSettings` en cas de succès. */
  saveRewardSettings: (pointsPerEuro: number) => Promise<boolean>
  isSavingRewards: boolean
  rewardSaveError: string | null
  rewardSaveSuccess: boolean
  resetRewardSaveSuccess: () => void
}

/**
 * useFinanceDashboard — charge les événements financiers récents (si `enabled`, c'est-à-dire
 * l'utilisateur courant a le rôle administrateur_financier — reproduit le court-circuit
 * préexistant qui n'appelait pas l'API pour les autres rôles avant redirection) et expose
 * l'action de mise à jour des paramètres de rémunération.
 *
 * `rewardSettings` n'est jamais lu depuis le serveur (aucune route de lecture n'existe côté
 * page d'origine) : il démarre à `{ pointsPerEuro: 1 }` et n'est mis à jour que localement
 * après un enregistrement réussi, à l'identique du comportement préexistant.
 */
export function useFinanceDashboard(enabled: boolean): UseFinanceDashboardResult {
  const { data, isLoading, error: eventsError } = useAsyncData(
    () => loadFinanceEvents(enabled),
    [enabled],
    { fallbackErrorMessage: 'Erreur lors du chargement des événements financiers' },
  )

  const [rewardSettings, setRewardSettings] = useState<RewardSettings>({ pointsPerEuro: 1 })
  const [isSavingRewards, setIsSavingRewards] = useState(false)
  const [rewardSaveError, setRewardSaveError] = useState<string | null>(null)
  const [rewardSaveSuccess, setRewardSaveSuccess] = useState(false)

  const saveRewardSettings = useCallback(async (pointsPerEuro: number): Promise<boolean> => {
    setIsSavingRewards(true)
    setRewardSaveError(null)
    setRewardSaveSuccess(false)
    try {
      await updateRewardSettings({ pointsPerEuro })
      setRewardSettings({ pointsPerEuro })
      setRewardSaveSuccess(true)
      return true
    } catch (caughtError) {
      setRewardSaveError(getErrorMessage(caughtError, 'Impossible de mettre à jour les paramètres.'))
      return false
    } finally {
      setIsSavingRewards(false)
    }
  }, [])

  const resetRewardSaveSuccess = useCallback(() => setRewardSaveSuccess(false), [])

  return {
    financeEvents: data ?? [],
    isLoadingEvents: isLoading,
    eventsError,
    rewardSettings,
    saveRewardSettings,
    isSavingRewards,
    rewardSaveError,
    rewardSaveSuccess,
    resetRewardSaveSuccess,
  }
}
