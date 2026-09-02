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
import type { UserRole } from '../types/user'
import { formatTeacherExpertise } from './teacherDirectory'
import type { PersonTileAction } from '../components/ui/PersonTile'

export function formatDirectoryEntrySubtitle(
  entry: Pick<UserDirectoryEntry, 'level' | 'levels' | 'subjects'>,
): string | null {
  if (entry.level) {
    return `Niveau : ${entry.level}`
  }

  return formatTeacherExpertise(entry.levels, entry.subjects)
}

/**
 * Actions de tuile différenciées par rôle (point 2 du complément 2026-09-02,
 * `docs/architecture.md` > « Compléments demandés le 2026-09-02… ») : élève →
 * Profil/Calendrier/Cahier de texte/Mémos ; professeur/AP → Profil/Calendrier ; parent
 * financeur → Profil seul.
 *
 * `onOpenMemos` n'est fourni (et donc utilisé) que pour le rôle `eleve` — le lien
 * « Mémos » réutilise `MemoReadOnlyModal`, déjà éprouvé côté formateur sur
 * `MyStudentsPage` (bouton ouvrant une modale, pas une navigation vers `/memos`, qui
 * n'affiche que le mémo de l'appelant lui-même).
 */
export function buildUserDirectoryTileActions(
  role: UserRole,
  userId: string,
  onOpenMemos: (() => void) | undefined,
): PersonTileAction[] {
  const profileAction: PersonTileAction = { label: 'Profil', to: `/profiles/${userId}` }

  if (role === 'parent_financeur') {
    return [profileAction]
  }

  if (role === 'formateur' || role === 'animateur_pedagogique') {
    return [profileAction, { label: 'Calendrier', to: `/calendar?studentId=${userId}` }]
  }

  // role === 'eleve'
  const actions: PersonTileAction[] = [
    profileAction,
    { label: 'Calendrier', to: `/calendar?studentId=${userId}` },
    { label: 'Cahier de texte', to: `/pedagogical-log?studentId=${userId}` },
  ]
  if (onOpenMemos) {
    actions.push({ label: 'Mémos', onClick: onOpenMemos })
  }
  return actions
}
