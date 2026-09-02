/**
 * EvaluationCreationSection — bouton de création + formulaire d'Évaluation.
 * Même découpage que `ExerciseCreationSection`/`QuizCreationSection`.
 *
 * **Reprise d'un brouillon après un aller-retour vers la création/le choix d'un Exercice
 * (2026-09-02)** : quand `resumedDraft` devient non nul (posé par `EvaluationCatalogPage` au
 * retour de `/content/exercises`), le formulaire s'ouvre automatiquement, pré-rempli. `draftToOpen`
 * est un état **local**, capturé une seule fois depuis `resumedDraft` au moment où l'effet se
 * déclenche — pas une lecture directe du prop à chaque rendu — pour ne pas dépendre de l'ordre
 * d'application des mises à jour de `onResumedDraftConsumed` (qui vide `resumedDraft` côté parent
 * dans le même geste) : `EvaluationForm` doit recevoir le brouillon réel à son montage, pas déjà
 * `undefined`.
 */

import React, { useEffect, useState } from 'react'
import { EvaluationForm } from './EvaluationForm'
import type { Evaluation } from '../../types/evaluation'
import type { EditableEvaluationFormState } from '../../utils/evaluationDraft'

interface EvaluationCreationSectionProps {
  canCreateEvaluation: boolean
  onEvaluationCreated: (createdEvaluation: Evaluation) => void
  onOpenCreateForm: () => void
  onListsChanged: () => void
  /** Brouillon à restaurer après un aller-retour vers `/content/exercises` (bouton « Nouveau » ou
   * « Rechercher » de `EvaluationExercisePicker`). `null`/`undefined` en usage normal. */
  resumedDraft?: EditableEvaluationFormState | null
  /** Appelé une fois `resumedDraft` consommé, pour que la page parente le remette à `null` — sinon
   * une ouverture normale ultérieure du formulaire réutiliserait ce même brouillon périmé. */
  onResumedDraftConsumed?: () => void
}

export function EvaluationCreationSection({
  canCreateEvaluation,
  onEvaluationCreated,
  onOpenCreateForm,
  onListsChanged,
  resumedDraft,
  onResumedDraftConsumed,
}: EvaluationCreationSectionProps) {
  const [shouldShowCreateForm, setShouldShowCreateForm] = useState(false)
  const [draftToOpen, setDraftToOpen] = useState<EditableEvaluationFormState | undefined>(undefined)

  useEffect(() => {
    if (!resumedDraft) return
    setDraftToOpen(resumedDraft)
    setShouldShowCreateForm(true)
    onResumedDraftConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumedDraft])

  if (!canCreateEvaluation) return null

  return (
    <div className="space-y-4">
      {!shouldShowCreateForm && (
        <button
          type="button"
          onClick={() => {
            onOpenCreateForm()
            setDraftToOpen(undefined)
            setShouldShowCreateForm(true)
          }}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
        >
          Créer une nouvelle évaluation
        </button>
      )}

      {shouldShowCreateForm && (
        <EvaluationForm
          initialDraft={draftToOpen}
          onSaved={(createdEvaluation) => {
            setShouldShowCreateForm(false)
            onEvaluationCreated(createdEvaluation)
            onListsChanged()
          }}
          onCancel={() => setShouldShowCreateForm(false)}
        />
      )}
    </div>
  )
}
