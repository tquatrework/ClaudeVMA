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
 * Liens dans le texte (2026-08-26) : `sessionSummary`/`homework` sont rendus
 * via `LightMarkupText` (transforme `[texte](url)` en vrai lien cliquable) au
 * lieu de texte brut ; en édition, un bouton « Insérer un lien »
 * (`InsertLinkButton`) accompagne chaque `LightMarkupEditor` (remplace
 * `LightMarkupTextarea` le 2026-08-27 — un lien inséré devient un jeton
 * n'affichant que son libellé, jamais l'URL ni les crochets, dès l'insertion
 * — voir ce composant). Remplace l'ancien `ResourceLinkEditor`/`resourceLinks`
 * (champ structuré séparé, retiré).
 *
 * Pièces jointes d'une entrée déjà créée (révisé le 2026-08-27, second
 * correctif du jour) : l'édition d'une entrée redonne le même niveau de
 * contrôle qu'une nouvelle entrée non encore validée, pièce jointe comprise.
 * `LogEntryAttachments` est donc monté dans les DEUX branches — édition et
 * affichage — avec `canManage` vrai uniquement en édition (`canEdit`) ; hors
 * édition, la section reste toujours en lecture seule, pour tous les rôles y
 * compris le formateur auteur. Les réglages système (`attachmentSettings`)
 * sont transmis dans les deux cas, seule leur utilisation change.
 *
 * Extrait de PedagogicalLogPage (lot 10 — normalisation, découpage > 300 lignes).
 * Présentationnel : le state d'édition reste porté par la page.
 */

import React, { useRef } from 'react'
import type { PedagogicalLogPage as LogPage, LogVisibility } from '../../api/pedagogicalLog'
import type { PedagogicalLogAttachmentSettings } from '../../api/pedagogicalLogAttachments'
import { formatIsoCalendarDate } from '../../utils/dateFormat'
import { getLogVisibilityLabel } from '../../utils/pedagogicalLogLabels'
import { LightMarkupText } from '../ui/LightMarkupText'
import { LogEntryAttachments } from './LogEntryAttachments'
import { InsertLinkButton } from './InsertLinkButton'
import { LightMarkupEditor, type LightMarkupEditorHandle } from './LightMarkupEditor'

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
  /** Réglages système des pièces jointes — transmis à `LogEntryAttachments` dans les deux branches. */
  attachmentSettings: PedagogicalLogAttachmentSettings
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
  attachmentSettings,
}: PedagogicalLogEntryItemProps) {
  const editSummaryRef = useRef<LightMarkupEditorHandle>(null)
  const editHomeworkRef = useRef<LightMarkupEditorHandle>(null)

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
                <label className="block text-xs text-gray-500 mb-1" id={`edit-summary-${logPage.id}-label`}>
                  Déroulement de la séance
                </label>
                <LightMarkupEditor
                  id={`edit-summary-${logPage.id}`}
                  ariaLabelledBy={`edit-summary-${logPage.id}-label`}
                  ref={editSummaryRef}
                  value={editValues.sessionSummary}
                  onChange={(value) => onEditValuesChange({ ...editValues, sessionSummary: value })}
                  rows={3}
                  borderClassName="border-indigo-300"
                />
                <InsertLinkButton
                  fieldLabel="Déroulement de la séance"
                  editorRef={editSummaryRef}
                  value={editValues.sessionSummary}
                  onChange={(value) => onEditValuesChange({ ...editValues, sessionSummary: value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1" id={`edit-homework-${logPage.id}-label`}>
                  À faire
                </label>
                <LightMarkupEditor
                  id={`edit-homework-${logPage.id}`}
                  ariaLabelledBy={`edit-homework-${logPage.id}-label`}
                  ref={editHomeworkRef}
                  value={editValues.homework}
                  onChange={(value) => onEditValuesChange({ ...editValues, homework: value })}
                  rows={3}
                  borderClassName="border-indigo-300"
                />
                <InsertLinkButton
                  fieldLabel="À faire"
                  editorRef={editHomeworkRef}
                  value={editValues.homework}
                  onChange={(value) => onEditValuesChange({ ...editValues, homework: value })}
                />
              </div>
            </>
          )}
          {!logPage.isSpecialPage && (
            <LogEntryAttachments
              logId={logPage.id}
              canManage={canEdit}
              attachmentSettings={attachmentSettings}
            />
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
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    <LightMarkupText text={logPage.sessionSummary} />
                  </p>
                </div>
              )}
              {logPage.homework && (
                <div>
                  <p className="text-xs font-semibold text-gray-500">À faire</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    <LightMarkupText text={logPage.homework} />
                  </p>
                </div>
              )}
              {!logPage.sessionSummary && !logPage.homework && (
                <p className="text-sm text-gray-400 italic">Entrée vide, non encore complétée.</p>
              )}
            </div>
          )}

          {!logPage.isSpecialPage && (
            <LogEntryAttachments
              logId={logPage.id}
              canManage={false}
              attachmentSettings={attachmentSettings}
            />
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
