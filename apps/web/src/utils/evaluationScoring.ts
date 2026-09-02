/**
 * evaluationScoring — barème informatif d'une Évaluation (arbitrage du 2026-09-02,
 * `docs/architecture.md` > « Barème informatif pour l'Évaluation »).
 *
 * Purement informatif : jamais utilisé pour un calcul automatique, la correction reste
 * entièrement manuelle (`learning-activity-service`, inchangé). Le créateur choisit une
 * granularité unique par Évaluation — par Exercice, ou par question (référence aux blocs de
 * catégorie `question` de chaque Exercice) — jamais les deux à la fois.
 *
 * Contrat serveur (`docs/routes.md` > content-catalog-service > Évaluations > « Barème
 * informatif ») :
 *   scoring?: {mode: 'per_exercise'|'per_question', entries: [{exerciseId, partId?, points}]}
 * - mode per_exercise : une entrée par exercice, `partId` interdit, doublon d'`exerciseId` interdit.
 * - mode per_question : une entrée par bloc question, `partId` obligatoire, doublon de
 *   (exerciseId, partId) interdit.
 * - chaque exerciseId référencé doit figurer dans exerciseItems de la même requête.
 * - points : nombre strictement positif.
 * - aucune contrainte de somme totale.
 */

import type { EditableEvaluationExerciseItem } from '../components/content-catalog/EvaluationExercisePicker'
import type { Evaluation, EvaluationScoring, EvaluationScoringMode } from '../types/evaluation'
import type { PublicExercisePart } from '../types/exercise'

/** État d'édition du barème, porté par `EditableEvaluationFormState` (voir `evaluationDraft.ts`). */
export interface EditableEvaluationScoringState {
  mode: 'none' | EvaluationScoringMode
  /** Clé = exerciseId. Saisie brute (chaîne), vide si non renseignée pour cet exercice. */
  pointsByExerciseId: Record<string, string>
  /** Clé = `questionScoringKey(exerciseId, partId)`. Saisie brute (chaîne), vide si non renseignée. */
  pointsByPartKey: Record<string, string>
}

export function createEmptyScoringState(): EditableEvaluationScoringState {
  return { mode: 'none', pointsByExerciseId: {}, pointsByPartKey: {} }
}

export function questionScoringKey(exerciseId: string, partId: string): string {
  return `${exerciseId}:${partId}`
}

/**
 * Traduit l'état d'édition en payload `scoring` pour `POST`/`PUT /evaluations`, ou lève une
 * erreur avec un message français directement affichable (mêmes conventions que
 * `buildQuizCreatePayload`). Une saisie de points vide pour un exercice/une question est
 * tolérée — le serveur n'exige pas une couverture totale (`docs/routes.md`). Au moins un point
 * renseigné est en revanche exigé dès qu'un mode autre que « Aucun barème » est choisi, pour
 * éviter d'enregistrer un mode sans aucune entrée réelle.
 *
 * `questionPartsByExerciseId` est requis en mode `per_question` (voir
 * `useExerciseQuestionParts`) — un exercice absent de cette table (chargement pas encore
 * terminé) fait lever une erreur explicite plutôt que d'ignorer silencieusement ses questions.
 */
export function buildEvaluationScoringPayload(
  state: EditableEvaluationScoringState,
  exerciseItems: Pick<EditableEvaluationExerciseItem, 'exerciseId'>[],
  questionPartsByExerciseId: Record<string, PublicExercisePart[]>,
): EvaluationScoring | undefined {
  if (state.mode === 'none') return undefined

  const parsePoints = (raw: string, label: string): number => {
    const points = Number(raw)
    if (!Number.isFinite(points) || points <= 0) {
      throw new Error(`Le barème de ${label} doit être un nombre de points strictement positif.`)
    }
    return points
  }

  if (state.mode === 'per_exercise') {
    const entries = exerciseItems
      .filter((item) => state.pointsByExerciseId[item.exerciseId]?.trim())
      .map((item) => ({
        exerciseId: item.exerciseId,
        points: parsePoints(state.pointsByExerciseId[item.exerciseId], "l'exercice"),
      }))
    if (entries.length === 0) {
      throw new Error(
        'Renseignez au moins un barème par exercice, ou choisissez « Aucun barème ».',
      )
    }
    return { mode: 'per_exercise', entries }
  }

  // mode === 'per_question'
  const entries: { exerciseId: string; partId: string; points: number }[] = []
  for (const item of exerciseItems) {
    const questionParts = questionPartsByExerciseId[item.exerciseId]
    if (!questionParts) {
      throw new Error(
        'Les questions des exercices sélectionnés sont encore en cours de chargement — patientez un instant avant d’enregistrer.',
      )
    }
    for (const part of questionParts) {
      const raw = state.pointsByPartKey[questionScoringKey(item.exerciseId, part.id)]
      if (!raw?.trim()) continue
      entries.push({
        exerciseId: item.exerciseId,
        partId: part.id,
        points: parsePoints(raw, 'cette question'),
      })
    }
  }
  if (entries.length === 0) {
    throw new Error('Renseignez au moins un barème par question, ou choisissez « Aucun barème ».')
  }
  return { mode: 'per_question', entries }
}

/** Reconstruit l'état d'édition à partir du barème enregistré d'une Évaluation (édition). */
export function buildEditableScoringStateFromEvaluation(
  evaluation: Pick<Evaluation, 'scoring'>,
): EditableEvaluationScoringState {
  const scoring = evaluation.scoring
  if (!scoring) return createEmptyScoringState()

  if (scoring.mode === 'per_exercise') {
    const pointsByExerciseId: Record<string, string> = {}
    for (const entry of scoring.entries) {
      pointsByExerciseId[entry.exerciseId] = String(entry.points)
    }
    return { mode: 'per_exercise', pointsByExerciseId, pointsByPartKey: {} }
  }

  const pointsByPartKey: Record<string, string> = {}
  for (const entry of scoring.entries) {
    if (!entry.partId) continue
    pointsByPartKey[questionScoringKey(entry.exerciseId, entry.partId)] = String(entry.points)
  }
  return { mode: 'per_question', pointsByExerciseId: {}, pointsByPartKey }
}

// ─── Lecture côté passage (affichage informatif à l'élève) ─────────────────────

/** Points configurés pour un Exercice entier (mode `per_exercise`), ou `null` si absent/mode différent. */
export function findExerciseScoringPoints(
  scoring: EvaluationScoring | null | undefined,
  exerciseId: string,
): number | null {
  if (!scoring || scoring.mode !== 'per_exercise') return null
  const entry = scoring.entries.find((candidate) => candidate.exerciseId === exerciseId)
  return entry ? entry.points : null
}

/** Points configurés pour un bloc question précis (mode `per_question`), ou `null` sinon. */
export function findQuestionScoringPoints(
  scoring: EvaluationScoring | null | undefined,
  exerciseId: string,
  partId: string,
): number | null {
  if (!scoring || scoring.mode !== 'per_question') return null
  const entry = scoring.entries.find(
    (candidate) => candidate.exerciseId === exerciseId && candidate.partId === partId,
  )
  return entry ? entry.points : null
}

/**
 * Total de points par exercice, tous modes confondus (un seul entry par exercice en mode
 * `per_exercise`, somme des entries de ses questions en mode `per_question`) — utilisé pour un
 * résumé avant démarrage sans avoir à recharger la structure complète de chaque Exercice
 * (`entries` porte déjà tout ce qu'il faut). `null` si aucun barème n'est défini.
 */
export function sumScoringPointsByExerciseId(
  scoring: EvaluationScoring | null | undefined,
): Record<string, number> | null {
  if (!scoring) return null
  const totals: Record<string, number> = {}
  for (const entry of scoring.entries) {
    totals[entry.exerciseId] = (totals[entry.exerciseId] ?? 0) + entry.points
  }
  return totals
}
