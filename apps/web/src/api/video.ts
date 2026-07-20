/**
 * Module API — salles vidéo (video-session-service)
 *
 * Toutes les requêtes passent par apiClient (base /api/v1). Chemins conformes
 * à docs/routes.md (préfixe canonique `/video/rooms`, alias legacy de
 * `/video-sessions`).
 */

import apiClient from './client'
import type { AttendancePayload, JoinRoomResult, VideoRoomInfo } from '../types/video'

/**
 * GET /video/rooms/:id — Lire les informations d'une salle
 */
export async function fetchRoomInfo(roomId: string): Promise<VideoRoomInfo> {
  const { data } = await apiClient.get<VideoRoomInfo>(`/video/rooms/${roomId}`)
  return data
}

/**
 * GET /video/rooms/:id/join — Rejoindre la salle (génère un token d'accès)
 */
export async function joinRoom(roomId: string): Promise<JoinRoomResult> {
  const { data } = await apiClient.get<JoinRoomResult>(`/video/rooms/${roomId}/join`)
  return data
}

/**
 * POST /video/rooms/:id/attendance — Enregistrer la présence
 */
export async function recordAttendance(roomId: string, payload: AttendancePayload): Promise<void> {
  await apiClient.post(`/video/rooms/${roomId}/attendance`, payload)
}

/**
 * POST /video/rooms/:id/close — Clôturer la session
 */
export async function closeRoom(roomId: string): Promise<void> {
  await apiClient.post(`/video/rooms/${roomId}/close`)
}
