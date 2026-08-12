/**
 * Formatage de l'annuaire des formateurs validés (`GET /profiles/teachers/validated`).
 *
 * Deux règles produit s'y appliquent :
 * - **aucun UUID à l'écran** (arbitrage du 2026-08-09) : un formateur sans prénom ni
 *   nom reçoit un libellé générique explicite, jamais son `userId` en repli ;
 * - `levels` / `subjects` à `null` = **non renseigné**, `[]` = liste vide enregistrée.
 *   Ni l'un ni l'autre ne doit produire le mot « null » à l'écran.
 */

import type { ValidatedTeacher } from '../types/profile'
import type { SelectableTeacher } from '../types/teacherRequests'
import { formatPersonDisplayName } from './nameFormat'

/** Libellé générique quand le profil administratif ne porte ni prénom ni nom. */
const TEACHER_GENERIC_LABEL = 'Professeur'

/**
 * Niveaux et matières, en une ligne lisible destinée à aider le RP à choisir.
 * Renvoie `null` quand rien n'est exploitable — l'appelant affiche alors sa
 * propre mention plutôt qu'une étiquette vide.
 */
export function formatTeacherExpertise(
  levels: string[] | null | undefined,
  subjects: string[] | null | undefined,
): string | null {
  const parts: string[] = []

  if (levels && levels.length > 0) {
    parts.push(`Niveaux : ${levels.join(', ')}`)
  }
  if (subjects && subjects.length > 0) {
    parts.push(`Matières : ${subjects.join(', ')}`)
  }

  return parts.length > 0 ? parts.join(' · ') : null
}

/**
 * Traduit une entrée d'annuaire en option sélectionnable par le composeur :
 * un nom lisible, l'expertise quand elle est renseignée, et l'identifiant
 * conservé pour l'appel suivant — jamais pour l'affichage.
 */
export function toSelectableTeacher(teacher: ValidatedTeacher): SelectableTeacher {
  return {
    userId: teacher.userId,
    displayName: formatPersonDisplayName(
      teacher.firstName,
      teacher.lastName,
      undefined,
      TEACHER_GENERIC_LABEL,
    ),
    expertise: formatTeacherExpertise(teacher.levels, teacher.subjects),
  }
}
