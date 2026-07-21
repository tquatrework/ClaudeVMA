/**
 * Types partagés — salles vidéo (video-session-service)
 *
 * Superset des champs utilisés par VideoPage (vue formateur/RP/AP/TI, avec
 * participants et activité liée) et VideoJoinPage (vue de rejointe rapide
 * depuis un événement calendrier). Les deux pages consomment le même type,
 * chacune n'affichant que les champs pertinents à son contexte.
 */

export type VideoRoomStatus = 'active' | 'ended' | 'scheduled'

export interface VideoRoomInfo {
  id: string
  status: VideoRoomStatus
  joinUrl?: string
  participants?: string[]
  activityId?: string
  calendarSessionId?: string
}

/** Réponse de GET /video/rooms/:id/join */
export interface JoinRoomResult {
  joinUrl: string
  token?: string
}

/** Corps de POST /video/rooms/:id/attendance */
export interface AttendancePayload {
  userId?: string
  joinedAt: string
}

/** Élément de GET /video/rooms/:roomId/recordings */
export interface VideoRecording {
  id: string
  downloadUrl?: string
  expiresAt?: string
  isExpired: boolean
}

/** Commentaire horodaté sur un enregistrement (POST /recordings/:recordingId/comments) */
export interface RecordingComment {
  id: string
  timestampSeconds: number
  content: string
  createdAt: string
}

/** Corps de POST /recordings/:recordingId/comments */
export interface RecordingCommentPayload {
  timestampSeconds: number
  content: string
}

/** Réponse de POST /video/rooms/:roomId/summary */
export interface CourseSummary {
  id: string
  roomId: string
  authorId: string
  content: string
  isPermanent: boolean
  publishedAt: string
  createdAt: string
}
