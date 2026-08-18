import { useCallback, useState } from 'react'
import { fetchScheduledActivity } from '../../api/calendar'
import type { ScheduledActivity } from '../../types/calendar'
import { useAsyncData } from '../useAsyncData'

const STORAGE_KEY_PREFIX = 'visiomath:course-proposals:'

/**
 * useSentCourseProposals — suivi des propositions de créneau **envoyées par l'utilisateur
 * courant depuis ce navigateur** (`localStorage`, clé par `userId`).
 *
 * **Limite assumée et documentée** : `calendar-service` n'expose aucune route de liste pour
 * les activités planifiées (`ScheduledActivity`) — vérifié le 2026-08-18 contre la pile réelle,
 * voir l'écart signalé en tête de `src/api/calendar.ts`. Ce hook ne fabrique donc pas une
 * boîte de réception complète : il retient uniquement les identifiants des propositions créées
 * depuis ce navigateur (`addProposal`, appelé après un `POST /activities` réussi), puis relit
 * leur statut **à chaque fois** via `GET /activities/:activityId` — jamais de statut mis en
 * cache localement, seul l'identifiant l'est. Le destinataire d'une proposition n'a, lui,
 * aujourd'hui aucun moyen de la découvrir dans l'interface tant que le serveur n'expose pas de
 * liste ou de notification dédiée — limite à lever côté backend, pas contournable ici.
 */
export interface UseSentCourseProposalsResult {
  proposals: ScheduledActivity[]
  isLoading: boolean
  loadError: string | null
  refetch: () => void
  /** À appeler avec l'activité renvoyée par `POST /activities` dès sa création. */
  addProposal: (activity: ScheduledActivity) => void
}

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`
}

function readStoredActivityIds(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeStoredActivityIds(userId: string, activityIds: string[]): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(activityIds))
  } catch {
    // Stockage indisponible (navigation privée, quota) : la session en cours reste
    // fonctionnelle, seule la persistance entre visites est perdue — non bloquant.
  }
}

async function loadSentProposals(userId: string): Promise<ScheduledActivity[]> {
  const activityIds = readStoredActivityIds(userId)
  const results = await Promise.all(
    activityIds.map((activityId) => fetchScheduledActivity(activityId).catch(() => null)),
  )
  return results.filter((activity): activity is ScheduledActivity => activity !== null)
}

export function useSentCourseProposals(userId: string | undefined): UseSentCourseProposalsResult {
  const [refreshToken, setRefreshToken] = useState(0)

  const { data, isLoading, error, refetch } = useAsyncData(
    () => (userId ? loadSentProposals(userId) : Promise.resolve([])),
    [userId, refreshToken],
    { fallbackErrorMessage: 'Impossible de charger vos propositions envoyées.' },
  )

  const addProposal = useCallback(
    (activity: ScheduledActivity) => {
      if (!userId) return
      const existingIds = readStoredActivityIds(userId)
      if (!existingIds.includes(activity.id)) {
        writeStoredActivityIds(userId, [activity.id, ...existingIds])
      }
      setRefreshToken((previous) => previous + 1)
    },
    [userId],
  )

  return {
    proposals: data ?? [],
    isLoading,
    loadError: error,
    refetch,
    addProposal,
  }
}
