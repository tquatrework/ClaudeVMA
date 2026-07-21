import { fetchRecordings } from '../../api/video'
import type { VideoRecording } from '../../types/video'
import { useAsyncData } from '../useAsyncData'

function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

async function loadRecordings(roomId: string, skip: boolean): Promise<VideoRecording[]> {
  if (skip) return pendingForever<VideoRecording[]>()

  try {
    return await fetchRecordings(roomId)
  } catch {
    // Forme reconnue en priorité par getErrorMessage (response.data.message), pour reproduire
    // exactement le message fixe historique de RecordingListPanel quel que soit le statut HTTP.
    throw { response: { data: { message: 'Impossible de charger les enregistrements' } } }
  }
}

export interface UseRecordingListResult {
  recordings: VideoRecording[]
  isLoading: boolean
  error: string | null
}

/**
 * useRecordingList — charge les enregistrements d'une salle (GET /video/rooms/:roomId/recordings)
 * pour RecordingListPanel.
 *
 * `skip` reproduit le comportement préexistant pour parent_financeur (VID-FB-001, VID-AC-001) :
 * aucun appel réseau n'est déclenché — le chargement reste indéfiniment en attente, à la manière
 * de `useVideoJoin`. Le composant appelant court-circuite l'affichage sur `isParent` avant que cet
 * état ne soit visible.
 */
export function useRecordingList(roomId: string, skip: boolean): UseRecordingListResult {
  const { data, isLoading, error } = useAsyncData(
    () => loadRecordings(roomId, skip),
    [roomId, skip],
  )

  return { recordings: data ?? [], isLoading, error }
}
