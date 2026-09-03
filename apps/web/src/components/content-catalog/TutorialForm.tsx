/**
 * TutorialForm — création et édition d'un Tutoriel/Vidéo (content-catalog-service).
 *
 * Refonte du 2026-09-03 (`docs/architecture.md` > « Refonte des Tutos/Vidéos »), sur le même
 * patron que `ExerciseForm`/`QuizForm`/`EvaluationForm` : rôles créateurs formateur/AP/RP, statut
 * initial selon le rôle (`pending_validation` formateur, `validated` AP/RP), titre obligatoire
 * avec suggestion par défaut lue depuis `GET /tutorials/default-title`.
 *
 * Deux formats exclusifs, choisis à la création : `video` (une seule URL) ou `post` (séquence de
 * blocs titre/texte/image, même mécanisme Memo-style que l'Exercice — `TutorialBlockEditor`,
 * réutilise l'encodage image base64 inline de l'Exercice, aucun second mécanisme). Un lien
 * optionnel vers un Quizz existant peut être ajouté en fin de tutoriel (`TutorialQuizLinkPicker`).
 */

import React, { useEffect, useState } from 'react'
import { createTutorial, fetchTutorialDefaultTitle, updateTutorial } from '../../api/tutorials'
import { getErrorMessage } from '../../utils/apiError'
import {
  buildTutorialCreatePayload,
  TutorialFormValidationError,
  type EditableTutorialFormState,
} from '../../utils/tutorialPayload'
import { resolveTutorialImagePayloadBlocks } from '../../utils/tutorialImageResolution'
import { useTutorialImageConstraints } from '../../hooks/content-catalog/useTutorialImageConstraints'
import {
  getTutorialRequestBodyTooLargeMessage,
  isTutorialRequestBodyTooLarge,
} from '../../utils/tutorialImageConstraints'
import { TUTORIAL_FORMAT_LABELS } from '../../utils/tutorialLabels'
import { TutorialMetadataFields } from './TutorialMetadataFields'
import { createEditableTutorialBlock, type EditableTutorialBlock } from './TutorialBlockEditor'
import { TutorialBlocksSection } from './TutorialBlocksSection'
import { TutorialQuizLinkPicker } from './TutorialQuizLinkPicker'
import type { PublicTutorialDetail, TutorialFormat } from '../../types/tutorial'

interface TutorialFormProps {
  /** `edit` réservé à l'auteur du tutoriel — vérifié côté serveur, pas ici. */
  mode?: 'create' | 'edit'
  /** Requis en mode `edit` — identifiant du tutoriel modifié. */
  tutorialId?: string
  /** État initial pré-rempli — requis en mode `edit`, ignoré en mode `create`. */
  initialState?: EditableTutorialFormState
  onSaved: (tutorial: PublicTutorialDetail) => void
  onCancel: () => void
}

export function TutorialForm({ mode = 'create', tutorialId, initialState, onSaved, onCancel }: TutorialFormProps) {
  const [title, setTitle] = useState(initialState?.title ?? '')
  const [tagsInput, setTagsInput] = useState(initialState?.tagsInput ?? '')
  const [description, setDescription] = useState(initialState?.description ?? '')
  const [level, setLevel] = useState(initialState?.level ?? '')
  const [difficulty, setDifficulty] = useState(initialState?.difficulty ?? '')
  const [theme, setTheme] = useState(initialState?.theme ?? '')
  const [competenciesInput, setCompetenciesInput] = useState(initialState?.competenciesInput ?? '')
  const [format, setFormat] = useState<TutorialFormat>(initialState?.format ?? 'post')
  const [videoUrl, setVideoUrl] = useState(initialState?.videoUrl ?? '')
  const [linkedQuizId, setLinkedQuizId] = useState<string | null>(initialState?.linkedQuizId ?? null)
  const [blocks, setBlocks] = useState<EditableTutorialBlock[]>(
    initialState?.blocks ?? [createEditableTutorialBlock('title')],
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { imageConstraints } = useTutorialImageConstraints()

  // Suggestion de titre par défaut, lue à l'ouverture du formulaire de création uniquement — ne
  // remplace jamais un titre déjà saisi par l'utilisateur.
  useEffect(() => {
    if (mode !== 'create') return
    let isCancelled = false
    fetchTutorialDefaultTitle()
      .then(({ title: defaultTitle }) => {
        if (isCancelled) return
        setTitle((current) => (current === '' ? defaultTitle : current))
      })
      .catch(() => {
        // Pas de suggestion disponible : l'utilisateur saisit son titre lui-même.
      })
    return () => {
      isCancelled = true
    }
  }, [mode])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setIsSubmitting(true)
    try {
      const resolvedImageBlocks =
        format === 'post'
          ? await resolveTutorialImagePayloadBlocks(blocks, mode === 'edit' ? tutorialId : undefined)
          : new Map()

      const payload = buildTutorialCreatePayload(
        { title, tagsInput, description, level, difficulty, theme, competenciesInput, format, videoUrl, linkedQuizId, blocks },
        resolvedImageBlocks,
      )

      const serializedPayload = JSON.stringify(payload)
      if (isTutorialRequestBodyTooLarge(serializedPayload, imageConstraints.maxRequestBodyBytes)) {
        throw new TutorialFormValidationError(
          getTutorialRequestBodyTooLargeMessage(imageConstraints.maxRequestBodyBytes),
        )
      }

      const saved =
        mode === 'edit' && tutorialId
          ? await updateTutorial(tutorialId, payload)
          : await createTutorial(payload)
      onSaved(saved)
    } catch (caughtError: unknown) {
      if (caughtError instanceof TutorialFormValidationError) {
        setFormError(caughtError.message)
      } else {
        setFormError(
          getErrorMessage(
            caughtError,
            mode === 'edit' ? 'Impossible de modifier le tutoriel.' : 'Impossible de créer le tutoriel.',
          ),
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-800">
        {mode === 'edit' ? 'Modifier le tutoriel' : 'Créer un nouveau tutoriel'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="tutorial-title" className="block text-sm text-gray-700 mb-1">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              id="tutorial-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="tutorial-tags" className="block text-sm text-gray-700 mb-1">
              Tags de recherche (séparés par des virgules)
            </label>
            <input
              id="tutorial-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="fractions, géométrie"
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="tutorial-description" className="block text-sm text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="tutorial-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <TutorialMetadataFields
          level={level}
          onLevelChange={setLevel}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          theme={theme}
          onThemeChange={setTheme}
          competenciesInput={competenciesInput}
          onCompetenciesInputChange={setCompetenciesInput}
          isSubmitting={isSubmitting}
        />

        <div>
          <label className="block text-xs text-gray-600 mb-1">Format</label>
          <div className="flex gap-4">
            {(Object.keys(TUTORIAL_FORMAT_LABELS) as TutorialFormat[]).map((formatOption) => (
              <label key={formatOption} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="tutorial-format"
                  value={formatOption}
                  checked={format === formatOption}
                  onChange={() => setFormat(formatOption)}
                  disabled={isSubmitting}
                />
                {TUTORIAL_FORMAT_LABELS[formatOption]}
              </label>
            ))}
          </div>
        </div>

        {format === 'video' ? (
          <div>
            <label htmlFor="tutorial-video-url" className="block text-sm text-gray-700 mb-1">
              Adresse de la vidéo <span className="text-red-500">*</span>
            </label>
            <input
              id="tutorial-video-url"
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://…"
              disabled={isSubmitting}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        ) : (
          <TutorialBlocksSection
            blocks={blocks}
            onBlocksChange={setBlocks}
            isSubmitting={isSubmitting}
            tutorialId={tutorialId}
            maxImageInputBytes={imageConstraints.maxImageInputBytes}
          />
        )}

        <TutorialQuizLinkPicker value={linkedQuizId} onChange={setLinkedQuizId} isSubmitting={isSubmitting} />

        {formError && <p className="text-red-600 text-sm">{formError}</p>}

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
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting
              ? mode === 'edit'
                ? 'Enregistrement…'
                : 'Création…'
              : mode === 'edit'
                ? 'Enregistrer les modifications'
                : 'Créer le tutoriel'}
          </button>
        </div>
      </form>
    </div>
  )
}
