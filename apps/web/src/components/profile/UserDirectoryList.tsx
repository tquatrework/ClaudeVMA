/**
 * UserDirectoryList — grille de tuiles (`PersonTile`) pour un onglet de l'écran
 * « Visualisation » du rail RP (`RpUserDirectoryPage`, `GET /profiles/directory/by-role`).
 *
 * Extraite le 2026-09-02 (complément « recherche + actions par rôle ») pour garder
 * `RpUserDirectoryPage` sous le seuil de 300 lignes du projet — aucun changement de
 * comportement par rapport à la version inline.
 */

import React from 'react'
import { PersonTile } from '../ui/PersonTile'
import { formatPersonDisplayName } from '../../utils/nameFormat'
import { formatDirectoryEntrySubtitle, buildUserDirectoryTileActions } from '../../utils/userDirectoryFormat'
import type { UserDirectoryEntry } from '../../types/profile'
import type { UserRole } from '../../types/user'

interface UserDirectoryListProps {
  entries: UserDirectoryEntry[]
  role: UserRole
  genericLabel: string
  /** Fourni uniquement pour le rôle `eleve` — ouvre la modale de mémo en lecture seule. */
  onOpenMemosFor?: (entry: UserDirectoryEntry) => void
}

export function UserDirectoryList({ entries, role, genericLabel, onOpenMemosFor }: UserDirectoryListProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,_minmax(280px,_1fr))] gap-4">
      {entries.map((entry) => (
        <PersonTile
          key={entry.userId}
          displayName={formatPersonDisplayName(entry.firstName, entry.lastName, undefined, genericLabel)}
          subtitle={formatDirectoryEntrySubtitle(entry)}
          actions={buildUserDirectoryTileActions(
            role,
            entry.userId,
            onOpenMemosFor ? () => onOpenMemosFor(entry) : undefined,
          )}
          // Pas d'appel réseau pour une personne sans photo connue — le champ
          // `avatarUrl` de l'annuaire le dit déjà, inutile de tenter et d'essuyer
          // un 404 côté `useReadOnlyAvatar`.
          photoUserId={entry.avatarUrl ? entry.userId : undefined}
        />
      ))}
    </div>
  )
}
