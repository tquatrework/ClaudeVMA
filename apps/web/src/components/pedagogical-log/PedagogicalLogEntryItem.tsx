/**
 * PedagogicalLogEntryItem — une entrée du cahier de texte, avec édition et
 * suppression inline.
 * Extrait de PedagogicalLogPage (lot 10 — normalisation, découpage > 300 lignes).
 * Présentationnel : le state d'édition reste porté par la page.
 */

import React from 'react'
import type { PedagogicalLogPage as LogPage, LogVisibility } from '../../api/pedagogicalLog'

interface PedagogicalLogEntryItemProps {
  logPage: LogPage
  visibilityLabel: Record<LogVisibility, string>
  isEditing: boolean
  editContent: string
  onEditContentChange: (value: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  isSavingEdit: boolean
  canEdit: boolean
  canDelete: boolean
  onDelete: () => void
  isDeleting: boolean
}

export function PedagogicalLogEntryItem({
  logPage,
  visibilityLabel,
  isEditing,
  editContent,
  onEditContentChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  isSavingEdit,
  canEdit,
  canDelete,
  onDelete,
  isDeleting,
}: PedagogicalLogEntryItemProps) {
  return (
    <li
      className={`bg-white border rounded-xl p-4 ${
        logPage.isSpecialPage ? 'border-purple-200 bg-purple-50' : 'border-gray-200'
      }`}
    >
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editContent}
            onChange={(e) => onEditContentChange(e.target.value)}
            rows={4}
            className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
          <div className="flex gap-3">
            <button
              onClick={onSaveEdit}
              disabled={isSavingEdit || !editContent.trim()}
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSavingEdit ? 'Sauvegarde…' : 'Enregistrer'}
            </button>
            <button
              onClick={onCancelEdit}
              className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-200"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <>
          {logPage.isSpecialPage && (
            <span className="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mb-2">
              Page spéciale{logPage.hiddenFromStudent ? ' — masquée à l\'élève' : ''}
            </span>
          )}
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{logPage.content}</p>
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-gray-400 space-x-2">
              <span>{new Date(logPage.createdAt).toLocaleString('fr-FR')}</span>
              <span className="text-gray-300">·</span>
              <span className="italic">{logPage.authorRole}</span>
              <span className="text-gray-300">·</span>
              <span className="italic">{visibilityLabel[logPage.visibility]}</span>
            </div>
            <div className="flex gap-2">
              {canEdit && (
                <button
                  onClick={onStartEdit}
                  className="text-xs text-indigo-500 hover:underline"
                >
                  Modifier
                </button>
              )}
              {canDelete && (
                <button
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="text-xs text-red-400 hover:underline disabled:opacity-50"
                >
                  {isDeleting ? 'Suppression…' : 'Supprimer'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </li>
  )
}
