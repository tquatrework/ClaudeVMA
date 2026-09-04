/**
 * ForumCreateForm — création OU édition d'un forum, réservée au responsable pédagogique.
 *
 * Mode création (comportement inchangé) : `POST /forums` — visible immédiatement, aucune étape de
 * validation. Mode édition (présence de la prop `forum`, ajouté le 2026-09-04) : `PATCH /forums/:id`
 * — pré-remplit les champs avec les valeurs actuelles du forum, tout RP peut éditer n'importe quel
 * forum (pas seulement son créateur), un forum caché reste éditable. Dans les deux modes,
 * `allowedRoles` est envoyé comme l'état courant des cases cochées (vide = ouvert à tous, ce qui
 * normalise explicitement en `null` côté serveur en édition).
 *
 * `level`/`difficulty`/`theme`/`competences` retirés le 2026-09-04 (complément « Sujets (topics) »)
 * — héritage du modèle générique de contenu, sans usage réel pour les Forums, colonnes supprimées
 * côté serveur.
 */

import React, { useState } from 'react'
import { createForum, updateForum } from '../../api/forums'
import { getErrorMessage } from '../../utils/apiError'
import { getRoleLabel } from '../../utils/role'
import { FORUM_LABELS } from '../../utils/forumLabels'
import { ErrorMessage } from '../ui/ErrorMessage'
import { FORUM_RESTRICTABLE_ROLES, type Forum, type ForumRestrictableRole } from '../../types/forum'

interface ForumCreateFormProps {
  /** Forum à éditer — sa présence bascule le formulaire en mode édition (PATCH plutôt que POST) et
   * pré-remplit les champs avec ses valeurs actuelles. Omis = mode création (comportement inchangé). */
  forum?: Forum
  onCreated?: (createdForum: Forum) => void
  onUpdated?: (updatedForum: Forum) => void
  onCancel: () => void
}

export function ForumCreateForm({ forum, onCreated, onUpdated, onCancel }: ForumCreateFormProps) {
  const isEditMode = Boolean(forum)

  const [title, setTitle] = useState(forum?.title ?? '')
  const [description, setDescription] = useState(forum?.description ?? '')
  const [tags, setTags] = useState(forum?.tags ?? '')
  const [selectedRoles, setSelectedRoles] = useState<ForumRestrictableRole[]>(forum?.allowedRoles ?? [])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const toggleRole = (role: ForumRestrictableRole) => {
    setSelectedRoles((previous) =>
      previous.includes(role) ? previous.filter((current) => current !== role) : [...previous, role],
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      if (isEditMode && forum) {
        const updatedForum = await updateForum(forum.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          tags: tags.trim() || undefined,
          allowedRoles: selectedRoles,
        })
        onUpdated?.(updatedForum)
      } else {
        const createdForum = await createForum({
          title: title.trim(),
          description: description.trim() || undefined,
          tags: tags.trim() || undefined,
          allowedRoles: selectedRoles.length > 0 ? selectedRoles : undefined,
        })
        onCreated?.(createdForum)
      }
    } catch (caughtError: unknown) {
      setSubmitError(
        getErrorMessage(
          caughtError,
          isEditMode ? FORUM_LABELS.updateForumError : 'Impossible de créer le forum.',
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-800">
        {isEditMode ? FORUM_LABELS.editTitle : 'Créer un forum'}
      </h2>
      <p className="text-sm text-gray-500">
        {isEditMode ? FORUM_LABELS.editHelp : 'Le forum est visible immédiatement, sans étape de validation.'}
      </p>

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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
          />
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
            disabled={isSubmitting}
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
                  disabled={isSubmitting}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                {getRoleLabel(role)}
              </label>
            ))}
          </div>
        </fieldset>

        {submitError && <ErrorMessage message={submitError} onClose={() => setSubmitError(null)} />}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting || title.trim().length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting
              ? isEditMode
                ? FORUM_LABELS.saving
                : 'Création…'
              : isEditMode
                ? FORUM_LABELS.saveChanges
                : 'Créer le forum'}
          </button>
        </div>
      </form>
    </div>
  )
}
