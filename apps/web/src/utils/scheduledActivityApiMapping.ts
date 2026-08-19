/**
 * Traduction `ScheduledActivity` (contrat réel du serveur, `docs/routes.md` §
 * calendar-service > "Activités planifiées") → `ActivitySession` (représentation front
 * historique consommée par `ActivitiesPage`/`ActivityDetailPage`, `src/types/calendar.ts`).
 *
 * Les deux formes divergent sur plusieurs points, vérifiés contre la pile réelle le
 * 2026-08-18 (chantier calendrier de disponibilités, point 3) :
 * - `startAt`/`endAt` (front) vs `startTime`/`endTime` (serveur) ;
 * - `studentId`/`teacherId` (front) n'existent pas côté serveur, qui ne porte qu'un
 *   `creatorId`/`creatorRole` et une liste `participantIds` — cette traduction ne peut donc
 *   les reconstituer que pour le cas `type: "cours"` créé par un `formateur` (le seul où la
 *   vérification de lien impose exactement un participant, l'élève) ; dans tous les autres cas
 *   (réunion pédagogique, entretien RP, rappel, autre), ils restent `undefined` plutôt que
 *   d'inventer une affectation ;
 * - `videoRoomId` n'existe pas non plus côté serveur : la salle est associée après coup par
 *   `useActivityDetail` (state local mis à jour après `createRoom`), jamais lue ici.
 *
 * Utilisée uniquement par `fetchActivity`/`updateActivity` (`src/api/calendar.ts`), pour ne
 * pas casser les deux pages historiques pendant l'assainissement des routes `/calendar` →
 * `/activities`. Le nouveau flux de proposition (`ProposeCourseSlotDialog`,
 * `CalendarProposalPage`) consomme directement `ScheduledActivity`, sans passer par cette
 * traduction.
 */

import type { ActivitySession, ScheduledActivity } from '../types/calendar'

export function fromApiActivity(api: ScheduledActivity): ActivitySession {
  const isSingleParticipantCourseFromTeacher =
    api.type === 'cours' && api.creatorRole === 'formateur' && api.participantIds.length === 1

  return {
    id: api.id,
    title: api.title ?? undefined,
    startAt: api.startTime,
    endAt: api.endTime,
    type: api.type,
    status: api.status,
    studentId: isSingleParticipantCourseFromTeacher ? api.participantIds[0] : undefined,
    teacherId: isSingleParticipantCourseFromTeacher ? api.creatorId : undefined,
  }
}
