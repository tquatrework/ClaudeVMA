/**
 * RpOpenActivityPublisher — formulaire de publication d'une activité non pourvue (RP).
 * Extrait de OpenActivitiesPage (lot 10 — normalisation, découpage > 300 lignes).
 */

import React from 'react'

interface RpOpenActivityPublisherProps {
  newActivityTitle: string
  newActivityDescription: string
  newActivitySubject: string
  newActivityLevel: string
  newActivityRequiredSlots: number
  newActivityDeadline: string
  isPublishing: boolean
  publishError: string | null
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onSubjectChange: (value: string) => void
  onLevelChange: (value: string) => void
  onRequiredSlotsChange: (value: number) => void
  onDeadlineChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
  onCancel: () => void
}

export function RpOpenActivityPublisher({
  newActivityTitle,
  newActivityDescription,
  newActivitySubject,
  newActivityLevel,
  newActivityRequiredSlots,
  newActivityDeadline,
  isPublishing,
  publishError,
  onTitleChange,
  onDescriptionChange,
  onSubjectChange,
  onLevelChange,
  onRequiredSlotsChange,
  onDeadlineChange,
  onSubmit,
  onCancel,
}: RpOpenActivityPublisherProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-800">Publier une activité non pourvue</h2>
      <p className="text-sm text-gray-500">
        Cette annonce sera visible par tous les formateurs disponibles sur la plateforme.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="activity-title" className="block text-sm text-gray-700 mb-1">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              id="activity-title"
              type="text"
              required
              value={newActivityTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isPublishing}
            />
          </div>
          <div>
            <label htmlFor="activity-subject" className="block text-sm text-gray-700 mb-1">
              Matière <span className="text-red-500">*</span>
            </label>
            <input
              id="activity-subject"
              type="text"
              required
              value={newActivitySubject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isPublishing}
            />
          </div>
          <div>
            <label htmlFor="activity-level" className="block text-sm text-gray-700 mb-1">
              Niveau <span className="text-red-500">*</span>
            </label>
            <input
              id="activity-level"
              type="text"
              required
              value={newActivityLevel}
              onChange={(e) => onLevelChange(e.target.value)}
              placeholder="ex: Terminale, 3ème…"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isPublishing}
            />
          </div>
          <div>
            <label htmlFor="activity-slots" className="block text-sm text-gray-700 mb-1">
              Nombre de postes <span className="text-red-500">*</span>
            </label>
            <input
              id="activity-slots"
              type="number"
              required
              min={1}
              value={newActivityRequiredSlots}
              onChange={(e) => onRequiredSlotsChange(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isPublishing}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="activity-deadline" className="block text-sm text-gray-700 mb-1">
              Date limite (optionnel)
            </label>
            <input
              id="activity-deadline"
              type="date"
              value={newActivityDeadline}
              onChange={(e) => onDeadlineChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isPublishing}
            />
          </div>
        </div>

        <div>
          <label htmlFor="activity-description" className="block text-sm text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="activity-description"
            required
            rows={4}
            value={newActivityDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            disabled={isPublishing}
          />
        </div>

        {publishError && <p className="text-red-600 text-sm">{publishError}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPublishing}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isPublishing}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPublishing ? 'Publication…' : 'Publier l\'annonce'}
          </button>
        </div>
      </form>
    </div>
  )
}
