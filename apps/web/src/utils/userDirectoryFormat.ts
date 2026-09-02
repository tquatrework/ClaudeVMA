/**
 * Formatage de la ligne secondaire d'une tuile de l'annuaire par rôle
 * (`GET /profiles/directory/by-role`, écran « Visualisation » du rail RP, 2026-09-02).
 *
 * Un seul mécanisme pour les 4 rôles, sans branchement explicite par rôle dans les composants
 * appelants : `level` (niveau **suivi**, élève uniquement) prime s'il est renseigné, sinon on
 * retombe sur `levels`/`subjects` (niveaux **enseignés** + matières, formateur/AP uniquement) via
 * `formatTeacherExpertise`, déjà éprouvé pour l'annuaire des formateurs validés. Pour
 * `role=parent_financeur`, les trois champs valent toujours `null` (`docs/routes.md`) : la
 * fonction renvoie alors `null`, et l'appelant n'affiche aucune ligne secondaire — comportement
 * normal, pas une anomalie.
 */

import type { UserDirectoryEntry } from '../types/profile'
import { formatTeacherExpertise } from './teacherDirectory'

export function formatDirectoryEntrySubtitle(
  entry: Pick<UserDirectoryEntry, 'level' | 'levels' | 'subjects'>,
): string | null {
  if (entry.level) {
    return `Niveau : ${entry.level}`
  }

  return formatTeacherExpertise(entry.levels, entry.subjects)
}
