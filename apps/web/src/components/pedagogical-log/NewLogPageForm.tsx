/**
 * NewLogPageForm — formulaire de création d'une entrée de cahier de texte.
 * Refonte du 2026-08-20 (points 1 et 2) : remplace l'ancien champ de texte
 * libre par 3 zones, **toutes optionnelles** — `date` (pré-remplie à la date du
 * jour), « Déroulement de la séance » et « À faire » — et corrige le
 * sélecteur de catégorie (`eleve_formateur` → `parent_formateur`).
 *
 * Réservé au formateur (point 3) : seul appelant autorisé côté page.
 * Présentationnel : le state reste porté par la page.
 *
 * Repliable par défaut depuis le 2026-08-21 : la page ne monte ce composant
 * qu'après un clic sur le bouton « Nouvelle entrée », pour que la liste des
 * entrées existantes reste immédiatement visible au chargement. `onCancel`
 * referme le formulaire sans soumettre.
 *
 * Liens insérés dans le texte (2026-08-26) : un bouton « Insérer un lien »
 * (`InsertLinkButton`) à côté de chaque champ texte insère `[texte](url)` à
 * la position du curseur — remplace l'ancien `ResourceLinkEditor` (champ
 * structuré séparé, retiré). Le rendu du lien pendant la saisie passe par
 * `LightMarkupEditor` (remplace `LightMarkupTextarea` le 2026-08-27, défaut
 * réel : l'URL doit rester cachée dès l'insertion, pas seulement recolorée —
 * un lien inséré devient un jeton n'affichant que son libellé).
 *
 * Pièce jointe choisie pendant la saisie (2026-08-27, défaut majeur) : un
 * fichier peut être sélectionné avant même que l'entrée existe — il est gardé
 * en état local (porté par `useNewLogEntryForm`) et envoyé juste après la
 * création, dans le même geste de soumission pour l'utilisateur. Auparavant,
 * le bouton de pièce jointe n'apparaissait qu'après coup, sur l'entrée déjà
 * créée (`LogEntryAttachments`), parce que l'upload exige un `logEntryId`
 * existant — cette contrainte serveur n'a pas changé, seule la séquence côté
 * front est désormais transparente pour l'utilisateur.
 *
 * Bouton « Joindre un fichier » en lien discret (2026-08-27, défaut de
 * design) : il se confondait visuellement, en bouton plein, avec les boutons
 * de validation du formulaire juste en dessous. Même style que le bouton
 * « Insérer un lien » ci-dessus — seul lien de ce type restant après le
 * retrait du bouton d'ajout sur une entrée déjà créée (voir
 * `LogEntryAttachments`, l'ajout n'est désormais possible qu'à la création).
 */

import React, { useId, useRef } from 'react'
import type { LogVisibility } from '../../api/pedagogicalLog'
import { LOG_VISIBILITY_LABELS, SELECTABLE_LOG_VISIBILITIES } from '../../utils/pedagogicalLogLabels'
import { InsertLinkButton } from './InsertLinkButton'
import { LightMarkupEditor, type LightMarkupEditorHandle } from './LightMarkupEditor'

interface NewLogPageFormProps {
  date: string
  onDateChange: (value: string) => void
  sessionSummary: string
  onSessionSummaryChange: (value: string) => void
  homework: string
  onHomeworkChange: (value: string) => void
  selectedVisibility: LogVisibility
  onVisibilityChange: (value: LogVisibility) => void
  isSaving: boolean
  errorMessage: string | null
  onSubmit: (event: React.FormEvent) => void
  onCancel: () => void

  /** Pièce jointe choisie pendant la saisie — voir `useNewLogEntryForm`. */
  attachmentsEnabled: boolean
  maxFileBytesHint: string
  pendingAttachmentName: string | null
  pendingAttachmentSizeLabel: string | null
  attachmentError: string | null
  onSelectAttachment: (file: File | null) => void
  onRemoveAttachment: () => void
}

export function NewLogPageForm({
  date,
  onDateChange,
  sessionSummary,
  onSessionSummaryChange,
  homework,
  onHomeworkChange,
  selectedVisibility,
  onVisibilityChange,
  isSaving,
  errorMessage,
  onSubmit,
  onCancel,
  attachmentsEnabled,
  maxFileBytesHint,
  pendingAttachmentName,
  pendingAttachmentSizeLabel,
  attachmentError,
  onSelectAttachment,
  onRemoveAttachment,
}: NewLogPageFormProps) {
  const sessionSummaryRef = useRef<LightMarkupEditorHandle>(null)
  const homeworkRef = useRef<LightMarkupEditorHandle>(null)
  const attachmentInputId = useId()

  return (
    <div className="mb-6">
      <form
        onSubmit={onSubmit}
        className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-gray-700">Nouvelle entrée</h2>

        {errorMessage && (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        )}

        <div>
          <label htmlFor="log-visibility-select" className="block text-xs text-gray-500 mb-1">
            Destinataires
          </label>
          <select
            id="log-visibility-select"
            value={selectedVisibility}
            onChange={(event) => onVisibilityChange(event.target.value as LogVisibility)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {SELECTABLE_LOG_VISIBILITIES.map((visibility) => (
              <option key={visibility} value={visibility}>
                {LOG_VISIBILITY_LABELS[visibility]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="log-date" className="block text-xs text-gray-500 mb-1">
            Date de la séance
          </label>
          <input
            id="log-date"
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label id="log-session-summary-label" className="block text-xs text-gray-500 mb-1">
            Déroulement de la séance
          </label>
          <LightMarkupEditor
            id="log-session-summary"
            ariaLabelledBy="log-session-summary-label"
            ref={sessionSummaryRef}
            value={sessionSummary}
            onChange={onSessionSummaryChange}
            placeholder="Notions abordées, difficultés observées… (optionnel)"
            rows={3}
          />
          <InsertLinkButton
            fieldLabel="Déroulement de la séance"
            editorRef={sessionSummaryRef}
            value={sessionSummary}
            onChange={onSessionSummaryChange}
          />
        </div>

        <div>
          <label id="log-homework-label" className="block text-xs text-gray-500 mb-1">
            À faire
          </label>
          <LightMarkupEditor
            id="log-homework"
            ariaLabelledBy="log-homework-label"
            ref={homeworkRef}
            value={homework}
            onChange={onHomeworkChange}
            placeholder="Exercices, révisions… (optionnel)"
            rows={3}
          />
          <InsertLinkButton
            fieldLabel="À faire"
            editorRef={homeworkRef}
            value={homework}
            onChange={onHomeworkChange}
          />
        </div>

        {attachmentsEnabled && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Pièce jointe</label>
            {pendingAttachmentName ? (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="truncate">{pendingAttachmentName}</span>
                {pendingAttachmentSizeLabel && (
                  <span className="text-xs text-gray-400">({pendingAttachmentSizeLabel})</span>
                )}
                <button
                  type="button"
                  onClick={onRemoveAttachment}
                  className="text-xs text-red-400 hover:underline"
                >
                  Retirer
                </button>
              </div>
            ) : (
              <>
                <label
                  htmlFor={attachmentInputId}
                  className="cursor-pointer text-xs text-indigo-500 hover:underline"
                >
                  + Joindre un fichier
                </label>
                <input
                  id={attachmentInputId}
                  type="file"
                  className="sr-only"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] ?? null
                    onSelectAttachment(selectedFile)
                    event.target.value = ''
                  }}
                />
                <p className="mt-0.5 text-xs text-gray-400">{maxFileBytesHint}</p>
              </>
            )}
            {attachmentError && (
              <p className="mt-1 text-xs text-red-600" role="alert">
                {attachmentError}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? 'Ajout…' : 'Ajouter une entrée'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}
