import { fetchLinkedCalendarBusyFree } from '../../api/calendar'
import type { LinkedCalendarBusyFree } from '../../types/calendar'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'
import { useAsyncData } from '../useAsyncData'

/**
 * Catégorie d'échec exposée à l'appelant, pour un affichage éventuellement différencié —
 * jamais pour révéler un détail technique : les trois messages restent génériques et en
 * français, sans identifiant ni cause technique.
 *
 * - `access_denied` (`403`) : aucune relation n'ouvre ce calendrier à l'appelant.
 * - `service_unavailable` (`503`) : `profile-service`, consulté par calendar-service pour
 *   vérifier le lien, est injoignable.
 * - `other` : tout le reste (réseau, `400` fenêtre invalide, `500`, etc.).
 */
export type LinkedCalendarBusyFreeErrorKind = 'access_denied' | 'service_unavailable' | 'other'

export interface UseLinkedCalendarBusyFreeResult {
  data: LinkedCalendarBusyFree | null
  isLoading: boolean
  error: string | null
  errorKind: LinkedCalendarBusyFreeErrorKind | null
  refetch: () => void
}

const ACCESS_DENIED_MESSAGE = "Vous n'avez pas accès au calendrier de cette personne."
const SERVICE_UNAVAILABLE_MESSAGE =
  'Le calendrier est temporairement indisponible. Veuillez réessayer plus tard.'
const DEFAULT_ERROR_MESSAGE = 'Impossible de charger ce calendrier.'

interface LoadResult {
  data: LinkedCalendarBusyFree | null
  errorKind: LinkedCalendarBusyFreeErrorKind | null
  errorMessage: string | null
}

const EMPTY_RESULT: LoadResult = { data: null, errorKind: null, errorMessage: null }

/**
 * Classe l'échec en un des trois cas prévus par le contrat de la route (docs/routes.md §
 * calendar-service > "Visibilité busy/free"), sans jamais laisser passer un message technique
 * ou un UUID à l'écran — même principe que `usePedagogicalArchives` (catch dans le chargeur,
 * jamais dans `useAsyncData`, pour pouvoir qualifier l'échec plutôt que juste le traduire).
 */
function toLoadResult(caughtError: unknown): LoadResult {
  const status = getErrorStatus(caughtError)

  if (status === 403) {
    return { data: null, errorKind: 'access_denied', errorMessage: ACCESS_DENIED_MESSAGE }
  }
  if (status === 503) {
    return { data: null, errorKind: 'service_unavailable', errorMessage: SERVICE_UNAVAILABLE_MESSAGE }
  }
  return {
    data: null,
    errorKind: 'other',
    errorMessage: getErrorMessage(caughtError, DEFAULT_ERROR_MESSAGE),
  }
}

async function loadBusyFree(ownerId: string, from: string, to: string): Promise<LoadResult> {
  try {
    const data = await fetchLinkedCalendarBusyFree(ownerId, from, to)
    return { data, errorKind: null, errorMessage: null }
  } catch (caughtError: unknown) {
    return toLoadResult(caughtError)
  }
}

/**
 * useLinkedCalendarBusyFree — lit le calendrier busy/free d'un tiers lié
 * (`GET /calendars/:ownerId/busy?from=&to=`) pour une fenêtre donnée, en lecture strictement
 * seule : jamais de contenu (id/titre/type/participants), seulement trois catégories de
 * créneaux. Voir `LinkedCalendarView` pour la composition avec `AvailabilityGrid`.
 *
 * `ownerId` peut être `undefined` pendant le chargement de la personne consultée en amont —
 * le hook renvoie alors un résultat vide plutôt que d'appeler l'API avec un identifiant absent.
 */
export function useLinkedCalendarBusyFree(
  ownerId: string | undefined,
  from: string,
  to: string,
): UseLinkedCalendarBusyFreeResult {
  const { data, isLoading, refetch } = useAsyncData(
    () => (ownerId ? loadBusyFree(ownerId, from, to) : Promise.resolve(EMPTY_RESULT)),
    [ownerId, from, to],
  )

  return {
    data: data?.data ?? null,
    isLoading,
    error: data?.errorMessage ?? null,
    errorKind: data?.errorKind ?? null,
    refetch,
  }
}
