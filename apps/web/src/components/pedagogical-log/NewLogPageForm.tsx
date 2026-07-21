/**
 * NewLogPageForm — formulaire d'ajout d'une nouvelle page de cahier de texte.
 * Extrait de PedagogicalLogPage (lot 10 — normalisation, découpage > 300 lignes).
 * Présentationnel : le state (contenu, visibilité) reste porté par la page.
 */

import React from 'react'
import type { LogVisibility } from '../../api/pedagogicalLog'

interface NewLogPageFormProps {
  newContent: string
  onNewContentChange: (value: string) => void
  selectedVisibility: LogVisibility
  onVisibilityChange: (value: LogVisibility) => void
  isSaving: boolean
  onSubmit: (event: React.FormEvent) => void
  isResponsablePedagogique: boolean
  onOpenSpecialPageDialog: () => void
}

export function NewLogPageForm({
  newContent,
  onNewContentChange,
  selectedVisibility,
  onVisibilityChange,
  isSaving,
  onSubmit,
  isResponsablePedagogique,
  onOpenSpecialPageDialog,
}: NewLogPageFormProps) {
  return (
    <div className="mb-6 space-y-3">
      <form
        onSubmit={onSubmit}
        className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-gray-700">Nouvelle entrée</h2>

        <div>
          <label htmlFor="visibility-select" className="block text-xs text-gray-500 mb-1">
            Visibilité
          </label>
          <select
            id="visibility-select"
            value={selectedVisibility}
            onChange={(e) => onVisibilityChange(e.target.value as LogVisibility)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="eleve_parent_formateur">Élève + Parent + Formateur</option>
            <option value="eleve_formateur">Élève + Formateur</option>
            <option value="formateur_rp">Formateur + RP uniquement</option>
          </select>
        </div>

        <textarea
          value={newContent}
          onChange={(e) => onNewContentChange(e.target.value)}
          placeholder="Décrivez la séance, les notions abordées, les difficultés observées…"
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
        <button
          type="submit"
          disabled={isSaving || !newContent.trim()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? 'Ajout…' : 'Ajouter une entrée'}
        </button>
      </form>

      {/* RP special page button */}
      {isResponsablePedagogique && (
        <button
          onClick={onOpenSpecialPageDialog}
          className="text-sm text-purple-600 border border-purple-200 px-4 py-2 rounded-lg hover:bg-purple-50 transition-colors"
        >
          Créer une page spéciale (RP)
        </button>
      )}
    </div>
  )
}
