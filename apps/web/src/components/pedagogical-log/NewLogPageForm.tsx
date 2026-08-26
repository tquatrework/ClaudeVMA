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
 */

import React from 'react'
import type { LogVisibility, ResourceLink } from '../../api/pedagogicalLog'
import { LOG_VISIBILITY_LABELS, SELECTABLE_LOG_VISIBILITIES } from '../../utils/pedagogicalLogLabels'
import { ResourceLinkEditor } from './ResourceLinkEditor'

interface NewLogPageFormProps {
  date: string
  onDateChange: (value: string) => void
  sessionSummary: string
  onSessionSummaryChange: (value: string) => void
  homework: string
  onHomeworkChange: (value: string) => void
  resourceLinks: ResourceLink[]
  onResourceLinksChange: (links: ResourceLink[]) => void
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
  resourceLinks,
  onResourceLinksChange,
  selectedVisibility,
  onVisibilityChange,
  isSaving,
  errorMessage,
  onSubmit,
  onCancel,
}: NewLogPageFormProps) {
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
            value={sessionSummary}
            onChange={(event) => onSessionSummaryChange(event.target.value)}
            placeholder="Notions abordées, difficultés observées… (optionnel)"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </div>

        <div>
          <label htmlFor="log-homework" className="block text-xs text-gray-500 mb-1">
            À faire
          </label>
          <textarea
            id="log-homework"
            value={homework}
            onChange={(event) => onHomeworkChange(event.target.value)}
            placeholder="Exercices, révisions… (optionnel)"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </div>

        <ResourceLinkEditor
          links={resourceLinks}
          onChange={onResourceLinksChange}
          idPrefix="new-log-page"
        />

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
