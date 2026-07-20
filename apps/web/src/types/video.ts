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
