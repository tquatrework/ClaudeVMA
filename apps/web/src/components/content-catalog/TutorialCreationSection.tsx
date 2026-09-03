/**
 * TutorialCreationSection — bouton de création + formulaire de Tutoriel.
 *
 * Extrait de `TutorialCatalogPage` pour rester sous le seuil de 300 lignes du fichier de page —
 * même découpage que `ExerciseCreationSection`/`QuizCreationSection`. Pas de panneau d'import
 * (aucun import CSV/Excel demandé pour ce type de contenu — `docs/architecture.md` > « Refonte
 * des Tutos/Vidéos », point 9).
 */

import React, { useState } from 'react'
import { TutorialForm } from './TutorialForm'
import type { PublicTutorialDetail } from '../../types/tutorial'

interface TutorialCreationSectionProps {
  canCreateTutorial: boolean
  /** Un tutoriel vient d'être créé — la page affiche son bandeau de succès. */
  onTutorialCreated: (createdTutorial: PublicTutorialDetail) => void
  /** Avant d'ouvrir le formulaire de création : la page efface un bandeau déjà affiché. */
  onOpenCreateForm: () => void
  /** Catalogue et « Mes Tutoriels » doivent être rechargés (création terminée). */
  onListsChanged: () => void
}

export function TutorialCreationSection({
  canCreateTutorial,
  onTutorialCreated,
  onOpenCreateForm,
  onListsChanged,
}: TutorialCreationSectionProps) {
  const [shouldShowCreateForm, setShouldShowCreateForm] = useState(false)

  if (!canCreateTutorial) return null

  return (
    <div className="space-y-4">
      {!shouldShowCreateForm && (
        <button
          type="button"
          onClick={() => {
            onOpenCreateForm()
            setShouldShowCreateForm(true)
          }}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
        >
          Créer un nouveau tutoriel
        </button>
      )}

      {shouldShowCreateForm && (
        <TutorialForm
          onSaved={(createdTutorial) => {
            setShouldShowCreateForm(false)
            onTutorialCreated(createdTutorial)
            onListsChanged()
          }}
          onCancel={() => setShouldShowCreateForm(false)}
        />
      )}
    </div>
  )
}
