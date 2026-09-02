/**
 * buildEvaluationPayload — traduit l'état d'édition de `EvaluationForm` en payload d'API
 * (`CreateEvaluationPayload`, réutilisé tel quel par `PUT /evaluations/:id`), ou lève une erreur
 * avec un message français directement affichable.
 *
 * Extrait de `EvaluationForm.tsx` (règle du projet, seuil de 300 lignes) — même patron que
 * `buildQuizCreatePayload` (`quizPayload.ts`).
 */

import { buildEvaluationScoringPayload, type EditableEvaluationScoringState } from './evaluationScoring'
import type { EditableEvaluationExerciseItem } from '../components/content-catalog/EvaluationExercisePicker'
import type { CreateEvaluationPayload } from '../types/evaluation'
import type { PublicExercisePart } from '../types/exercise'

export interface EvaluationFormFields {
  title: string
  level: string
  difficulty: string
  theme: string
  competenciesInput: string
  tagsInput: string
  durationMinutes: string
  blockBackNavigation: boolean
}

export function buildEvaluationPayload(
  fields: EvaluationFormFields,
  exerciseItems: EditableEvaluationExerciseItem[],
  scoringState: EditableEvaluationScoringState,
  questionPartsByExerciseId: Record<string, PublicExercisePart[]>,
): CreateEvaluationPayload {
  if (!fields.title.trim()) {
    throw new Error('Le titre est obligatoire.')
  }
  if (exerciseItems.length === 0) {
    throw new Error('Ajoutez au moins un exercice.')
  }
  const durationSeconds = Number(fields.durationMinutes) * 60
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('La durée doit être un nombre de minutes supérieur à zéro.')
  }

  const scoring = buildEvaluationScoringPayload(scoringState, exerciseItems, questionPartsByExerciseId)

  const competencies = fields.competenciesInput
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
  const tags = fields.tagsInput
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  return {
    title: fields.title.trim(),
    // `order` doit être >= 1 (vérifié en HTTP direct le 2026-09-02 :
    // `exerciseItems.0.order must not be less than 1`), contrairement à `order` sur les blocs
    // d'Exercice qui, lui, part de 0 — deux DTO distincts, pas la même convention.
    exerciseItems: exerciseItems.map((item, index) => ({
      exerciseId: item.exerciseId,
      order: index + 1,
      ...(item.titleOverride.trim() ? { titleOverride: item.titleOverride.trim() } : {}),
    })),
    ...(fields.level.trim() ? { level: fields.level.trim() } : {}),
    ...(fields.difficulty.trim() ? { difficulty: fields.difficulty.trim() } : {}),
    ...(fields.theme.trim() ? { theme: fields.theme.trim() } : {}),
    ...(competencies.length > 0 ? { competencies } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    durationSeconds,
    blockBackNavigation: fields.blockBackNavigation,
    ...(scoring ? { scoring } : {}),
  }
}
