/**
 * usePedagogicalArchives — archives pédagogiques d'une personne (liste + timeline).
 *
 * Deux règles portées ici, et une seule requête par **changement de personne
 * consultée** — changer de sujet est une navigation légitime, changer d'onglet non.
 *
 * 1. `404` n'est PAS une erreur. Le serveur répond `404` avec le même message pour
 *    « aucune archive » et « aucune relation ouvrant ce droit » : les deux cas sont
 *    volontairement indiscernables, et l'écran affiche un état vide dans les deux.
 * 2. Tout autre échec (`503` profile-service injoignable, `500`, réseau) reste une
 *    vraie erreur, affichée comme telle. C'est précisément la confusion qui avait
 *    masqué pendant des semaines des routes montées sur le mauvais préfixe : un
 *    `404` de Nest « Cannot GET … » y était lu comme « pas encore d'archives ».
 */

import {
  fetchArchiveTimeline,
  fetchPedagogicalArchives,
  type ArchiveTimelineGroup,
  type PedagogicalArchiveItem,
} from '../../api/archiveDocument'
import { getErrorStatus } from '../../utils/apiError'
import { useAsyncData } from '../useAsyncData'

export interface PedagogicalArchivesData {
  archiveItems: PedagogicalArchiveItem[]
  timelineGroups: ArchiveTimelineGroup[]
}

export interface UsePedagogicalArchivesResult extends PedagogicalArchivesData {
  isLoading: boolean
  error: string | null
}

const EMPTY_RESULT: PedagogicalArchivesData = { archiveItems: [], timelineGroups: [] }

/** Une absence d'archive et un refus se ressemblent volontairement : les deux sont vides. */
function toEmptyOnNotFound(caughtError: unknown): never | PedagogicalArchivesData {
  if (getErrorStatus(caughtError) === 404) return EMPTY_RESULT
  throw caughtError
}

async function loadArchivesFor(userId: string): Promise<PedagogicalArchivesData> {
  if (!userId) return EMPTY_RESULT

  try {
    const [archivesPage, timelinePage] = await Promise.all([
      fetchPedagogicalArchives(userId),
      fetchArchiveTimeline(userId),
    ])
    return { archiveItems: archivesPage.data, timelineGroups: timelinePage.data }
  } catch (caughtError: unknown) {
    return toEmptyOnNotFound(caughtError)
  }
}

export function usePedagogicalArchives(userId: string): UsePedagogicalArchivesResult {
  const { data, isLoading, error } = useAsyncData(() => loadArchivesFor(userId), [userId], {
    fallbackErrorMessage: 'Impossible de charger les archives pédagogiques.',
  })

  return {
    archiveItems: data?.archiveItems ?? [],
    timelineGroups: data?.timelineGroups ?? [],
    isLoading,
    error,
  }
}
