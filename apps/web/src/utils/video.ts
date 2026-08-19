import type { VideoRoomStatus } from '../types/video'

/**
 * `waiting` est l'état initial d'une salle fraîchement créée côté video-session-service
 * (docs/routes.md) : la transition WAITING → ACTIVE n'a lieu que côté serveur, au premier appel
 * à `GET /video/rooms/:id/join`. Le bouton « Rejoindre » doit donc apparaître aussi bien pour
 * `active` que pour `waiting` — c'est ce clic qui déclenche la transition. Sans ce traitement,
 * une salle fraîchement créée reste bloquée : aucun bouton ne peut jamais déclencher l'appel qui
 * ferait passer la salle à `active`.
 */
export function isJoinableRoomStatus(status: VideoRoomStatus): boolean {
  return status === 'active' || status === 'waiting'
}
