/**
 * NotebookEntryList — rendu factorisé d'une liste d'entrées de carnet personnel.
 *
 * Extrait de `NotebookPage.tsx` (chantier « accès admin/parent au carnet
 * personnel », 2026-08-28) pour être réutilisé tel quel par une future section
 * de lecture seule sur la fiche d'un tiers (RP/AF/TI, ou parent sur son
 * enfant) — même rendu d'entrée, simplement sans bouton « Supprimer ».
 *
 * `onDelete` est optionnel : absent, le bouton « Supprimer » ne s'affiche pas
 * du tout — c'est ce qui permet la réutilisation en lecture seule sans
 * dupliquer le composant ni ajouter un booléen `readOnly` redondant avec
 * l'absence du callback.
 */

import React from 'react'
import type { NotebookEntry } from '../../api/pedagogicalLogNotebook'

interface NotebookEntryListProps {
  entries: NotebookEntry[]
  emptyMessage: string
  onDelete?: (entryId: string) => void
}

export function NotebookEntryList({ entries, emptyMessage, onDelete }: NotebookEntryListProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
        <p className="text-gray-400 text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{entry.content}</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">
              {new Date(entry.createdAt).toLocaleString('fr-FR')}
            </p>
            {onDelete && (
              <button
                onClick={() => onDelete(entry.id)}
                className="text-xs text-red-400 hover:underline"
              >
                Supprimer
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
