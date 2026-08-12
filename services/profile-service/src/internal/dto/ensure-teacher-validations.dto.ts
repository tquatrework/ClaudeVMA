import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/**
 * Plafond DÉCLARÉ du lot, jamais caché (arbitrage du 2026-08-10) — même valeur
 * et même raison que `POST /internal/profiles/display-names` : au-delà, la
 * requête est découpée par l'appelant, pas rognée en silence par le serveur.
 */
export const ENSURE_TEACHER_VALIDATIONS_MAX_BATCH = 200;

/**
 * Corps de `POST /internal/teachers/ensure-validations`, consommé par
 * `scripts/maintenance/backfill-teacher-validations.ts`.
 *
 * La liste vient de `GET /internal/accounts?role=formateur` sur
 * identity-access-service : `profile-service` ne connaît pas les rôles et ne
 * doit surtout pas les deviner (voir `InternalService.ensureTeacherValidations`
 * pour le détail de ce choix).
 */
export class EnsureTeacherValidationsDto {
  @IsArray({ message: 'teacherIds doit être une liste.' })
  @ArrayNotEmpty({ message: 'teacherIds ne peut pas être vide.' })
  @ArrayMaxSize(ENSURE_TEACHER_VALIDATIONS_MAX_BATCH, {
    message:
      `teacherIds ne peut pas dépasser ${ENSURE_TEACHER_VALIDATIONS_MAX_BATCH} identifiants ` +
      'par appel. Découpez la liste en plusieurs lots.',
  })
  @IsUUID('4', { each: true, message: 'Chaque teacherId doit être un UUID.' })
  teacherIds: string[];
}
