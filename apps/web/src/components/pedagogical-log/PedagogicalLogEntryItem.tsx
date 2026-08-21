/**
 * PedagogicalLogEntryItem — une entrée du cahier de texte, avec édition et
 * suppression inline.
 *
 * Refonte du 2026-08-20 : une entrée normale affiche `date` / `sessionSummary`
 * / `homework` (plus de champ `content` libre — réservé aux pages spéciales du
 * RP, mécanisme inchangé). Écriture réservée au formateur auteur (`canEdit` /
 * `canDelete` sont calculés par la page, cette entrée ne fait qu'afficher les
 * boutons qu'on lui autorise).
 *
 * Extrait de PedagogicalLogPage (lot 10 — normalisation, découpage > 300 lignes).
 * Présentationnel : le state d'édition reste porté par la page.
 */

import React from 'react'
import type { PedagogicalLogPage as LogPage, LogVisibility } from '../../api/pedagogicalLog'
import { formatIsoCalendarDate } from '../../utils/dateFormat'
import { getLogVisibilityLabel } from '../../utils/pedagogicalLogLabels'

export interface LogEntryEditValues {
  date: string
  sessionSummary: string
  homework: string
}

interface PedagogicalLogEntryItemProps {
  logPage: LogPage
  isEditing: boolean
  editValues: LogEntryEditValues
  onEditValuesChange: (values: LogEntryEditValues) => void
  /** Page spéciale RP uniquement — mécanisme d'édition inchangé (champ `content` libre). */
  editContent: string
  onEditContentChange: (value: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  isSavingEdit: boolean
  editError: string | null
  canEdit: boolean
  canDelete: boolean
  onDelete: () => void
  isDeleting: boolean
}

const VISIBILITY_LABELS: Record<LogVisibility, string> = {
  eleve_parent_formateur: getLogVisibilityLabel('eleve_parent_formateur'),
  parent_formateur: getLogVisibilityLabel('parent_formateur'),
  formateur_rp: getLogVisibilityLabel('formateur_rp'),
  special: getLogVisibilityLabel('special'),
}

function isEmptyAutoCreatedEntry(logPage: LogPage): boolean {
  return Boolean(logPage.autoCreated) && !logPage.sessionSummary?.trim() && !logPage.homework?.trim()
}

export function PedagogicalLogEntryItem({
  logPage,
  isEditing,
  editValues,
  onEditValuesChange,
  editContent,
  onEditContentChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  isSavingEdit,
  editError,
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
          {editError && (
            <p className="text-sm text-red-600" role="alert">
              {editError}
            </p>
          )}
          {logPage.isSpecialPage ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1" htmlFor={`edit-content-${logPage.id}`}>
                Contenu
              </label>
              <textarea
                id={`edit-content-${logPage.id}`}
                value={editContent}
                onChange={(event) => onEditContentChange(event.target.value)}
                rows={4}
                className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1" htmlFor={`edit-date-${logPage.id}`}>
                  Date de la séance
                </label>
                <input
                  id={`edit-date-${logPage.id}`}
                  type="date"
                  value={editValues.date}
                  onChange={(event) => onEditValuesChange({ ...editValues, date: event.target.value })}
                  className="border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1" htmlFor={`edit-summary-${logPage.id}`}>
                  Déroulement de la séance
                </label>
                <textarea
                  id={`edit-summary-${logPage.id}`}
                  value={editValues.sessionSummary}
                  onChange={(event) =>
                    onEditValuesChange({ ...editValues, sessionSummary: event.target.value })
                  }
                  rows={3}
                  className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1" htmlFor={`edit-homework-${logPage.id}`}>
                  À faire
                </label>
                <textarea
                  id={`edit-homework-${logPage.id}`}
                  value={editValues.homework}
                  onChange={(event) => onEditValuesChange({ ...editValues, homework: event.target.value })}
                  rows={3}
                  className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
              </div>
            </>
          )}
          <div className="flex gap-3">
            <button
              onClick={onSaveEdit}
              disabled={isSavingEdit}
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
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {logPage.isSpecialPage && (
              <span className="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                Page spéciale{logPage.hiddenFromStudent ? " — masquée à l'élève" : ''}
              </span>
            )}
            {isEmptyAutoCreatedEntry(logPage) && (
              <span className="inline-block text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Générée automatiquement — à compléter
              </span>
            )}
            {logPage.date && (
              <span className="text-sm font-medium text-gray-700">
                {formatIsoCalendarDate(logPage.date)}
              </span>
            )}
          </div>

          {logPage.isSpecialPage ? (
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{logPage.content}</p>
          ) : (
            <div className="space-y-2">
              {logPage.sessionSummary && (
                <div>
                  <p className="text-xs font-semibold text-gray-500">Déroulement de la séance</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{logPage.sessionSummary}</p>
                </div>
              )}
              {logPage.homework && (
                <div>
                  <p className="text-xs font-semibold text-gray-500">À faire</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{logPage.homework}</p>
                </div>
              )}
              {!logPage.sessionSummary && !logPage.homework && (
                <p className="text-sm text-gray-400 italic">Entrée vide, non encore complétée.</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-gray-400 space-x-2">
              <span>{new Date(logPage.createdAt).toLocaleString('fr-FR')}</span>
              <span className="text-gray-300">·</span>
              <span className="italic">{logPage.authorRole}</span>
              <span className="text-gray-300">·</span>
              <span className="italic">{VISIBILITY_LABELS[logPage.visibility]}</span>
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
