/**
 * Module API — salles vidéo (video-session-service)
 *
 * Toutes les requêtes passent par apiClient (base /api/v1). Chemins conformes
 * à docs/routes.md (préfixe canonique `/video/rooms`, alias legacy de
 * `/video-sessions`).
 */

import apiClient from './client'
import type {
  AttendancePayload,
  CourseSummary,
  JoinRoomResult,
  RecordingComment,
  RecordingCommentPayload,
  VideoRecording,
  VideoRoomInfo,
} from '../types/video'

export interface CreateRoomPayload {
  activityId: string
}

/**
 * POST /video/rooms — Créer une salle vidéo rattachée à une activité.
 * Utilisé par ActivityDetailPage.
 */
export async function createRoom(payload: CreateRoomPayload): Promise<VideoRoomInfo> {
  const { data } = await apiClient.post<VideoRoomInfo>('/video/rooms', payload)
  return data
}

/**
 * GET /video/rooms/:id — Lire les informations d'une salle
 */
export async function fetchRoomInfo(roomId: string): Promise<VideoRoomInfo> {
  const { data } = await apiClient.get<VideoRoomInfo>(`/video/rooms/${roomId}`)
  return data
}

/**
 * GET /video/rooms/:id/join — Rejoindre la salle (génère un token LiveKit réel + l'URL du
 * serveur à joindre en direct, voir docs/routes.md > video-session-service, contrat du
 * 2026-08-19).
 */
export async function joinRoom(roomId: string): Promise<JoinRoomResult> {
  const { data } = await apiClient.get<JoinRoomResult>(`/video/rooms/${roomId}/join`)
  return data
}

/**
 * GET /video/rooms/by-activity/:activityId — Résoudre la salle créée automatiquement pour une
 * activité de calendrier confirmée (`type: "cours"`). `404` si aucune salle n'existe encore pour
 * cette activité (cas normal, voir docs/routes.md).
 */
export async function fetchRoomByActivity(activityId: string): Promise<VideoRoomInfo> {
  const { data } = await apiClient.get<VideoRoomInfo>(`/video/rooms/by-activity/${activityId}`)
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

/**
 * GET /video/rooms/:roomId/recordings — Lister les enregistrements visibles.
 * Utilisé par RecordingListPanel (parent_financeur refusé côté serveur, VID-FB-001/VID-AC-001).
 */
export async function fetchRecordings(roomId: string): Promise<VideoRecording[]> {
  const { data } = await apiClient.get<VideoRecording[]>(`/video/rooms/${roomId}/recordings`)
  return data
}

/**
 * POST /recordings/:recordingId/comments — Ajouter un commentaire horodaté sur un enregistrement.
 * Utilisé par RecordingCommentTimeline.
 */
export async function addRecordingComment(
  recordingId: string,
  payload: RecordingCommentPayload,
): Promise<RecordingComment> {
  const { data } = await apiClient.post<RecordingComment>(
    `/recordings/${recordingId}/comments`,
    payload,
  )
  return data
}

/**
 * POST /video/rooms/:roomId/summary — Publier le résumé de cours (permanent, VID-AC-002).
 * Utilisé par CourseSummaryView.
 */
export async function publishCourseSummary(roomId: string, content: string): Promise<CourseSummary> {
  const { data } = await apiClient.post<CourseSummary>(`/video/rooms/${roomId}/summary`, {
    content,
  })
  return data
}
