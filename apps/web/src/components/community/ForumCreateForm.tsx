/**
 * ForumCreateForm — création d'un forum, réservée au responsable pédagogique.
 *
 * `POST /forums` — visible immédiatement, aucune étape de validation. `allowedRoles` est
 * optionnel : aucune case cochée = ouvert à tout compte connecté (comportement par défaut,
 * `docs/routes.md` § Forums).
 */

import React, { useState } from 'react'
import { createForum } from '../../api/communityPath'
import { getErrorMessage } from '../../utils/apiError'
import { getRoleLabel } from '../../utils/role'
import { ErrorMessage } from '../ui/ErrorMessage'
import { FORUM_RESTRICTABLE_ROLES, type Forum, type ForumRestrictableRole } from '../../types/forum'

interface ForumCreateFormProps {
  onCreated: (createdForum: Forum) => void
  onCancel: () => void
}

export function ForumCreateForm({ onCreated, onCancel }: ForumCreateFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [theme, setTheme] = useState('')
  const [competences, setCompetences] = useState('')
  const [tags, setTags] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<ForumRestrictableRole[]>([])

  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const toggleRole = (role: ForumRestrictableRole) => {
    setSelectedRoles((previous) =>
      previous.includes(role) ? previous.filter((current) => current !== role) : [...previous, role],
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsCreating(true)
    setCreateError(null)

    try {
      const createdForum = await createForum({
        title: title.trim(),
        description: description.trim() || undefined,
        level: level.trim() || undefined,
        difficulty: difficulty.trim() || undefined,
        theme: theme.trim() || undefined,
        competences: competences.trim() || undefined,
        tags: tags.trim() || undefined,
        allowedRoles: selectedRoles.length > 0 ? selectedRoles : undefined,
      })
      onCreated(createdForum)
    } catch (caughtError: unknown) {
      setCreateError(getErrorMessage(caughtError, 'Impossible de créer le forum.'))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-800">Créer un forum</h2>
      <p className="text-sm text-gray-500">Le forum est visible immédiatement, sans étape de validation.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="forum-title" className="block text-sm text-gray-700 mb-1">
            Titre <span className="text-red-500">*</span>
          </label>
          <input
            id="forum-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isCreating}
          />
        </div>

        <div>
          <label htmlFor="forum-description" className="block text-sm text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="forum-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            disabled={isCreating}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="forum-level" className="block text-sm text-gray-700 mb-1">
              Niveau
            </label>
            <input
              id="forum-level"
              type="text"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isCreating}
            />
          </div>
          <div>
            <label htmlFor="forum-difficulty" className="block text-sm text-gray-700 mb-1">
              Difficulté
            </label>
            <input
              id="forum-difficulty"
              type="text"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isCreating}
            />
          </div>
          <div>
            <label htmlFor="forum-theme" className="block text-sm text-gray-700 mb-1">
              Thème
            </label>
            <input
              id="forum-theme"
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isCreating}
            />
          </div>
          <div>
            <label htmlFor="forum-competences" className="block text-sm text-gray-700 mb-1">
              Compétences travaillées
            </label>
            <input
              id="forum-competences"
              type="text"
              value={competences}
              onChange={(e) => setCompetences(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isCreating}
            />
          </div>
        </div>

        <div>
          <label htmlFor="forum-tags" className="block text-sm text-gray-700 mb-1">
            Tags (séparés par des virgules)
          </label>
          <input
            id="forum-tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="algèbre, trigonométrie"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isCreating}
          />
        </div>

        <fieldset>
          <legend className="block text-sm text-gray-700 mb-1">
            Rôles autorisés — laisser vide pour ouvrir le forum à tous
          </legend>
          <div className="flex flex-wrap gap-3">
            {FORUM_RESTRICTABLE_ROLES.map((role) => (
              <label key={role} className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                  disabled={isCreating}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                {getRoleLabel(role)}
              </label>
            ))}
          </div>
        </fieldset>

        {createError && <ErrorMessage message={createError} onClose={() => setCreateError(null)} />}

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
            disabled={isCreating || title.trim().length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? 'Création…' : 'Créer le forum'}
          </button>
        </div>
      </form>
    </div>
  )
}
