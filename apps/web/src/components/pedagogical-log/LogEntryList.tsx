/**
 * LogEntryList — état chargement/vide/liste des entrées du cahier de texte.
 * Extrait de PedagogicalLogPage (refonte du 2026-08-20, découpage > 300 lignes).
 * Présentationnel : tout le state d'édition reste porté par la page.
 */

import React from 'react'
import type { PedagogicalLogPage as LogPage } from '../../api/pedagogicalLog'
import type { PedagogicalLogAttachmentSettings } from '../../api/pedagogicalLogAttachments'
import { canDeleteLogEntry, canEditLogEntry, type LogEntryViewerContext } from '../../utils/pedagogicalLogPermissions'
import { PedagogicalLogEntryItem, type LogEntryEditValues } from './PedagogicalLogEntryItem'

interface LogEntryListProps {
  entries: LogPage[]
  isLoading: boolean
  canWriteNormalEntry: boolean
  viewer: LogEntryViewerContext
  /** Réglages système des pièces jointes — transmis à chaque entrée pour son bouton d'ajout en mode édition. */
  attachmentSettings: PedagogicalLogAttachmentSettings

  editingLogId: string | null
  editValues: LogEntryEditValues
  onEditValuesChange: (values: LogEntryEditValues) => void
  editContent: string
  onEditContentChange: (value: string) => void
  onStartEdit: (entry: LogPage) => void
  onCancelEdit: () => void
  onSaveEdit: (entry: LogPage) => void
  updatingLogId: string | null
  updateError: string | null

  onDelete: (entry: LogPage) => void
  deletingLogId: string | null
}

export default function LogEntryList({
  entries,
  isLoading,
  canWriteNormalEntry,
  viewer,
  attachmentSettings,
  editingLogId,
  editValues,
  onEditValuesChange,
  editContent,
  onEditContentChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  updatingLogId,
  updateError,
  onDelete,
  deletingLogId,
}: LogEntryListProps) {
  if (isLoading) {
    return <p className="text-gray-400 text-sm">Chargement…</p>
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
        <p className="text-gray-400 text-sm">Aucune entrée dans le cahier de texte</p>
        {canWriteNormalEntry && (
          <p className="text-xs text-gray-300 mt-1">
            Utilisez le formulaire ci-dessus pour ajouter la première page.
          </p>
        )}
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <PedagogicalLogEntryItem
          key={entry.id}
          logPage={entry}
          isEditing={editingLogId === entry.id}
          editValues={editValues}
          onEditValuesChange={onEditValuesChange}
          editContent={editContent}
          onEditContentChange={onEditContentChange}
          onStartEdit={() => onStartEdit(entry)}
          onCancelEdit={onCancelEdit}
          onSaveEdit={() => onSaveEdit(entry)}
          isSavingEdit={updatingLogId === entry.id}
          editError={editingLogId === entry.id ? updateError : null}
          canEdit={canEditLogEntry(entry, viewer)}
          canDelete={canDeleteLogEntry(entry, viewer)}
          onDelete={() => onDelete(entry)}
          isDeleting={deletingLogId === entry.id}
          attachmentSettings={attachmentSettings}
        />
      ))}
    </ul>
  )
}
