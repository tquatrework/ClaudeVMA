/**
 * TutorialCreateForm — formulaire de création d'un tutoriel vidéo.
 * Extrait de TutorialCatalogPage (lot 10 — normalisation, découpage > 300 lignes).
 */

import React from 'react'

interface TutorialCreateFormProps {
  newTitle: string
  newDescription: string
  newSubject: string
  newLevel: string
  newVideoUrl: string
  isCreating: boolean
  createError: string | null
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onSubjectChange: (value: string) => void
  onLevelChange: (value: string) => void
  onVideoUrlChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
  onCancel: () => void
}

export function TutorialCreateForm({
  newTitle,
  newDescription,
  newSubject,
  newLevel,
  newVideoUrl,
  isCreating,
  createError,
  onTitleChange,
  onDescriptionChange,
  onSubjectChange,
  onLevelChange,
  onVideoUrlChange,
  onSubmit,
  onCancel,
}: TutorialCreateFormProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-800">Créer un tutoriel</h2>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="tuto-title" className="block text-sm text-gray-700 mb-1">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              id="tuto-title"
              type="text"
              required
              value={newTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isCreating}
            />
          </div>
          <div>
            <label htmlFor="tuto-subject" className="block text-sm text-gray-700 mb-1">
              Matière <span className="text-red-500">*</span>
            </label>
            <input
              id="tuto-subject"
              type="text"
              required
              value={newSubject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isCreating}
            />
          </div>
          <div>
            <label htmlFor="tuto-level" className="block text-sm text-gray-700 mb-1">
              Niveau <span className="text-red-500">*</span>
            </label>
            <input
              id="tuto-level"
              type="text"
              required
              value={newLevel}
              onChange={(e) => onLevelChange(e.target.value)}
              placeholder="ex: Terminale, 3ème…"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isCreating}
            />
          </div>
          <div>
            <label htmlFor="tuto-video-url" className="block text-sm text-gray-700 mb-1">
              URL vidéo (optionnel)
            </label>
            <input
              id="tuto-video-url"
              type="url"
              value={newVideoUrl}
              onChange={(e) => onVideoUrlChange(e.target.value)}
              placeholder="https://…"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isCreating}
            />
          </div>
        </div>

        <div>
          <label htmlFor="tuto-description" className="block text-sm text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="tuto-description"
            required
            rows={3}
            value={newDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            disabled={isCreating}
          />
        </div>

        {createError && (
          <p className="text-red-600 text-sm">{createError}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isCreating}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isCreating}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? 'Création…' : 'Créer le tutoriel'}
          </button>
        </div>
      </form>
    </div>
  )
}
