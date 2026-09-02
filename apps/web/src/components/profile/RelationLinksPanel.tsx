/**
 * RelationLinksPanel — présentation générique d'une liste de personnes liées, sous
 * forme de liens vers leur profil (`Link` vers `/profiles/:userId`), jamais un UUID
 * affiché. Factorisée le 2026-09-02 pour ne pas dupliquer la même mise en page à
 * chaque nouvelle relation câblée sur `ProfilePage` (« Contacts essentiels ») —
 * voir `AnimatedTeachersPanel`, `StudentsOfTeacherPanel`, `AnimatorsOfTeacherPanel`.
 *
 * Toujours en lecture seule : aucune de ces relations n'a de route de rupture côté
 * serveur, donc aucune action n'est proposée ici (contrairement à
 * `LinkedTeachersPanel`, qui porte « Mettre fin » pour le RP).
 */

import React from 'react'
import { Link } from 'react-router-dom'
import type { PersonName } from '../../types/profile'
import { formatPersonName } from '../../utils/nameFormat'

export interface RelationLinkItem {
  /** Clé React — identifiant de la relation elle-même, jamais affiché. */
  id: string
  /** Identifiant de la personne liée — sert uniquement à router vers son profil. */
  targetUserId: string
  personName?: PersonName | null
}

interface RelationLinksPanelProps {
  title: string
  emptyMessage: string
  genericLabel: string
  isLoading: boolean
  loadError: string | null
  items: RelationLinkItem[]
}

export function RelationLinksPanel({
  title,
  emptyMessage,
  genericLabel,
  isLoading,
  loadError,
  items,
}: RelationLinksPanelProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">{title}</h2>
      {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}
      {!isLoading && loadError && <p className="text-red-600 text-sm">{loadError}</p>}
      {!isLoading && !loadError && items.length === 0 && (
        <p className="text-gray-400 text-sm">{emptyMessage}</p>
      )}
      {!isLoading && !loadError && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0"
            >
              <Link
                to={`/profiles/${item.targetUserId}`}
                className="text-sm text-indigo-600 hover:underline truncate"
              >
                {formatPersonName(item.personName, genericLabel)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
