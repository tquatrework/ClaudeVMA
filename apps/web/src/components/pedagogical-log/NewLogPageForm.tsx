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
 * structuré séparé, retiré). Nécessite une référence DOM vers chaque
 * `<textarea>` pour connaître la position du curseur au moment du clic.
 */

import React, { useRef } from 'react'
import type { LogVisibility } from '../../api/pedagogicalLog'
import { LOG_VISIBILITY_LABELS, SELECTABLE_LOG_VISIBILITIES } from '../../utils/pedagogicalLogLabels'
import { InsertLinkButton } from './InsertLinkButton'

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
}: NewLogPageFormProps) {
  const sessionSummaryRef = useRef<HTMLTextAreaElement>(null)
  const homeworkRef = useRef<HTMLTextAreaElement>(null)

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
          <label htmlFor="log-session-summary" className="block text-xs text-gray-500 mb-1">
            Déroulement de la séance
          </label>
          <textarea
            id="log-session-summary"
            ref={sessionSummaryRef}
            value={sessionSummary}
            onChange={(event) => onSessionSummaryChange(event.target.value)}
            placeholder="Notions abordées, difficultés observées… (optionnel)"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
          <InsertLinkButton
            fieldLabel="Déroulement de la séance"
            textareaRef={sessionSummaryRef}
            value={sessionSummary}
            onChange={onSessionSummaryChange}
          />
        </div>

        <div>
          <label htmlFor="log-homework" className="block text-xs text-gray-500 mb-1">
            À faire
          </label>
          <textarea
            id="log-homework"
            ref={homeworkRef}
            value={homework}
            onChange={(event) => onHomeworkChange(event.target.value)}
            placeholder="Exercices, révisions… (optionnel)"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
          <InsertLinkButton
            fieldLabel="À faire"
            textareaRef={homeworkRef}
            value={homework}
            onChange={onHomeworkChange}
          />
        </div>

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
