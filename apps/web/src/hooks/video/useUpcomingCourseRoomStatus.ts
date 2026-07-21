import { fetchRoomInfo } from '../../api/video'
import type { VideoRoomInfo } from '../../types/video'
import { useAsyncData } from '../useAsyncData'

/**
 * useUpcomingCourseRoomStatus — charge le statut d'une salle (GET /video/rooms/:id) pour afficher
 * un badge optionnel dans UpcomingCourseJoinButton.
 *
 * Reproduit le comportement préexistant : cette information est purement indicative — un échec
 * réseau est silencieusement ignoré (le badge reste simplement absent) plutôt que d'afficher une
 * erreur, exactement comme le `.catch` vide d'origine. Ce non-bloquant volontaire est le même
 * choix déjà fait pour les logs de séance optionnels de `useActivityDetail`.
 */
export function useUpcomingCourseRoomStatus(roomId: string): VideoRoomInfo | null {
  const { data } = useAsyncData<VideoRoomInfo | null>(
    () => fetchRoomInfo(roomId).catch(() => null),
    [roomId],
  )

  return data ?? null
}
