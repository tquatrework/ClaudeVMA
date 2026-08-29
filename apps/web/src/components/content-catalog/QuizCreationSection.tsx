/**
 * QuizCreationSection — les deux façons de produire un Quizz : à la main
 * (`QuizForm`) ou en lot depuis un fichier (`QuizImportPanel`,
 * `docs/architecture.md` > « Import de Quizz depuis un tableur »).
 *
 * Extrait de `QuizzPage` pour rester sous le seuil de 300 lignes du fichier de
 * page (`src/CLAUDE.md`) : ce bloc porte son propre état d'affichage (lequel
 * des deux panneaux est ouvert), la page ne fait qu'orchestrer les listes à
 * rafraîchir une fois un Quizz produit.
 */

import React, { useState } from 'react'
import { QuizForm } from './QuizForm'
import { QuizImportPanel } from './QuizImportPanel'
import { QUIZ_IMPORT_LABELS } from '../../utils/quizImport'
import type { PublicQuizDetail } from '../../types/quiz'

interface QuizCreationSectionProps {
  canCreateQuiz: boolean
  /** Un Quizz vient d'être créé à la main — la page affiche son bandeau de succès. */
  onQuizCreated: (createdQuiz: PublicQuizDetail) => void
  /** Avant d'ouvrir le formulaire de création : la page efface un bandeau de succès déjà affiché. */
  onOpenCreateForm: () => void
  /** Catalogue et « Mes Quizz » doivent être rechargés (création ou import terminés). */
  onListsChanged: () => void
}

export function QuizCreationSection({
  canCreateQuiz,
  onQuizCreated,
  onOpenCreateForm,
  onListsChanged,
}: QuizCreationSectionProps) {
  const [shouldShowCreateForm, setShouldShowCreateForm] = useState(false)
  const [shouldShowImportPanel, setShouldShowImportPanel] = useState(false)

  if (!canCreateQuiz) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            onOpenCreateForm()
            setShouldShowImportPanel(false)
            setShouldShowCreateForm(true)
          }}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
        >
          Créer un nouveau Quizz
        </button>
        <button
          type="button"
          onClick={() => {
            setShouldShowCreateForm(false)
            setShouldShowImportPanel(true)
          }}
          className="px-4 py-2 text-indigo-700 bg-white border border-indigo-300 text-sm font-medium rounded-md hover:bg-indigo-50 transition-colors"
        >
          {QUIZ_IMPORT_LABELS.triggerAction}
        </button>
      </div>

      {shouldShowCreateForm && (
        <QuizForm
          onSaved={(createdQuiz) => {
            setShouldShowCreateForm(false)
            onQuizCreated(createdQuiz)
            onListsChanged()
          }}
          onCancel={() => setShouldShowCreateForm(false)}
        />
      )}

      {shouldShowImportPanel && (
        <QuizImportPanel
          onImported={onListsChanged}
          onCancel={() => setShouldShowImportPanel(false)}
        />
      )}
    </div>
  )
}
