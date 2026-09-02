/**
 * useExercisePickerReturnMode — mode « retour vers la création d'Évaluation » de
 * `ExerciseCatalogPage` (2026-09-02), déclenché par les boutons « Nouveau » et « Rechercher » de
 * `EvaluationExercisePicker`.
 *
 * Lit `location.state` posé par `EvaluationForm` avant la navigation
 * (`EvaluationExercisePickerNavigationState`) et expose deux actions de retour vers
 * `/content/evaluations`, qui posent l'état de reprise (`EvaluationDraftResumeState`) lu par
 * `EvaluationCatalogPage`. Extrait en hook dédié pour garder `ExerciseCatalogPage` lisible (règle
 * du projet, seuil de 300 lignes) plutôt que d'éparpiller cette logique de navigation dans le
 * corps de la page.
 */

import { useLocation, useNavigate } from 'react-router-dom'
import type {
  EvaluationDraftResumeState,
  EvaluationExercisePickerNavigationState,
} from '../../utils/evaluationDraft'

export interface ExercisePickerReturnMode {
  /** `true` si cette page a été atteinte depuis la création d'une Évaluation en cours. */
  isPicking: boolean
  intent: 'create' | 'search' | undefined
  prefillKeyword: string | undefined
  /** Retourne vers la création d'Évaluation avec cet Exercice ajouté à la suite ordonnée. */
  returnWithExercise: (exercise: { id: string; title: string }) => void
  /** Retourne vers la création d'Évaluation sans rien ajouter (ex. lien « Retour »). */
  returnWithoutExercise: () => void
}

export function useExercisePickerReturnMode(): ExercisePickerReturnMode {
  const location = useLocation()
  const navigate = useNavigate()

  const navigationState = location.state as EvaluationExercisePickerNavigationState | null
  const isPicking = !!navigationState?.returnToEvaluationDraft

  const returnWithExercise = (exercise: { id: string; title: string }) => {
    const resumeState: EvaluationDraftResumeState = {
      resumeEvaluationDraft: true,
      newExercise: exercise,
    }
    navigate('/content/evaluations', { state: resumeState })
  }

  const returnWithoutExercise = () => {
    const resumeState: EvaluationDraftResumeState = { resumeEvaluationDraft: true }
    navigate('/content/evaluations', { state: resumeState })
  }

  return {
    isPicking,
    intent: navigationState?.exercisePickerIntent,
    prefillKeyword: navigationState?.prefillKeyword,
    returnWithExercise,
    returnWithoutExercise,
  }
}
