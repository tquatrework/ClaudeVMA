/**
 * useEvaluationForEdit — charge une Évaluation existante et construit l'état d'édition initial
 * pour `EvaluationForm` (`mode="edit"`), utilisé par `EvaluationEditPage`.
 *
 * Compose deux domaines (`content-catalog-service` pour l'évaluation, l'Exercice pour son titre
 * affiché dans le sélecteur) — orchestration UI d'un cas d'usage, donc un hook métier plutôt
 * qu'une fonction ajoutée à `api/evaluations.ts` (règle du projet : les fonctions d'`api/*`
 * restent transport pur pour un seul domaine).
 */

import { fetchEvaluation } from '../../api/evaluations'
import { fetchExercise } from '../../api/exercises'
import { buildEditableScoringStateFromEvaluation } from '../../utils/evaluationScoring'
import { useAsyncData, type UseAsyncDataResult } from '../useAsyncData'
import type { Evaluation } from '../../types/evaluation'
import type { EditableEvaluationFormState } from '../../utils/evaluationDraft'

export interface EvaluationForEditResult {
  evaluation: Evaluation
  initialState: EditableEvaluationFormState
}

export function useEvaluationForEdit(
  evaluationId: string,
): UseAsyncDataResult<EvaluationForEditResult> {
  return useAsyncData<EvaluationForEditResult>(
    async () => {
      const evaluation = await fetchEvaluation(evaluationId)
      const sortedItems = [...evaluation.exerciseItems].sort((a, b) => a.order - b.order)
      const exercises = await Promise.all(
        sortedItems.map((item) => fetchExercise(item.exerciseId)),
      )

      const initialState: EditableEvaluationFormState = {
        title: evaluation.title,
        level: evaluation.level ?? '',
        difficulty: evaluation.difficulty ?? '',
        theme: evaluation.theme ?? '',
        competenciesInput: (evaluation.competencies ?? []).join(', '),
        tagsInput: evaluation.tags.join(', '),
        durationMinutes: String(Math.round(evaluation.durationSeconds / 60)),
        blockBackNavigation: evaluation.blockBackNavigation,
        exerciseItems: sortedItems.map((item, index) => ({
          exerciseId: item.exerciseId,
          title: exercises[index].title ?? 'Exercice sans titre',
          titleOverride: item.titleOverride ?? '',
        })),
        scoring: buildEditableScoringStateFromEvaluation(evaluation),
      }

      return { evaluation, initialState }
    },
    [evaluationId],
    { fallbackErrorMessage: 'Impossible de charger cette évaluation pour modification.' },
  )
}
