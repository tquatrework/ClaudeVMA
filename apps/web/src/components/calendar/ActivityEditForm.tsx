/**
 * ActivityEditForm — formulaire d'édition (titre, statut) d'une activité de calendrier.
 * Extrait de ActivityDetailPage (lot 10 — normalisation, découpage > 300 lignes).
 */

import React from 'react'

interface ActivityEditFormProps {
  editTitle: string
  onEditTitleChange: (value: string) => void
  editStatus: string
  onEditStatusChange: (value: string) => void
  isSaving: boolean
  onSubmit: (event: React.FormEvent) => void
  onCancel: () => void
}

export function ActivityEditForm({
  editTitle,
  onEditTitleChange,
  editStatus,
  onEditStatusChange,
  isSaving,
  onSubmit,
  onCancel,
}: ActivityEditFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
        <input
          type="text"
          value={editTitle}
          onChange={(e) => onEditTitleChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
        <select
          value={editStatus}
          onChange={(e) => onEditStatusChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">— Inchangé —</option>
          <option value="scheduled">Planifiée</option>
          <option value="ongoing">En cours</option>
          <option value="completed">Terminée</option>
          <option value="cancelled">Annulée</option>
        </select>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? 'Sauvegarde…' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-200"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
