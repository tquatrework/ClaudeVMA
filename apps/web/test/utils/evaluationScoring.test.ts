/**
 * Tests pour `utils/evaluationScoring.ts` — barème informatif d'une Évaluation (arbitrage du
 * 2026-09-02, `docs/architecture.md` > « Barème informatif pour l'Évaluation »).
 */

import { describe, it, expect } from 'vitest'
import {
  buildEvaluationScoringPayload,
  buildEditableScoringStateFromEvaluation,
  createEmptyScoringState,
  findExerciseScoringPoints,
  findQuestionScoringPoints,
  questionScoringKey,
  sumScoringPointsByExerciseId,
} from '../../src/utils/evaluationScoring'
import type { PublicExercisePart } from '../../src/types/exercise'

const exerciseItems = [{ exerciseId: 'ex-1' }, { exerciseId: 'ex-2' }]

const questionPart = (id: string): PublicExercisePart => ({
  id,
  partNumber: 1,
  category: 'question',
  items: [],
  hasSolution: true,
})

describe('buildEvaluationScoringPayload', () => {
  it('renvoie undefined en mode "none"', () => {
    const result = buildEvaluationScoringPayload(
      createEmptyScoringState(),
      exerciseItems,
      {},
    )
    expect(result).toBeUndefined()
  })

  it('construit les entries per_exercise à partir des points saisis, ignore les cases vides', () => {
    const result = buildEvaluationScoringPayload(
      { mode: 'per_exercise', pointsByExerciseId: { 'ex-1': '5', 'ex-2': '' }, pointsByPartKey: {} },
      exerciseItems,
      {},
    )
    expect(result).toEqual({ mode: 'per_exercise', entries: [{ exerciseId: 'ex-1', points: 5 }] })
  })

  it('rejette per_exercise si aucun point n’est saisi', () => {
    expect(() =>
      buildEvaluationScoringPayload(
        { mode: 'per_exercise', pointsByExerciseId: {}, pointsByPartKey: {} },
        exerciseItems,
        {},
      ),
    ).toThrow('Renseignez au moins un barème par exercice')
  })

  it('rejette un point non strictement positif', () => {
    expect(() =>
      buildEvaluationScoringPayload(
        { mode: 'per_exercise', pointsByExerciseId: { 'ex-1': '0' }, pointsByPartKey: {} },
        exerciseItems,
        {},
      ),
    ).toThrow('strictement positif')
  })

  it('construit les entries per_question à partir des blocs question chargés', () => {
    const key = questionScoringKey('ex-1', 'part-a')
    const result = buildEvaluationScoringPayload(
      { mode: 'per_question', pointsByExerciseId: {}, pointsByPartKey: { [key]: '2' } },
      exerciseItems,
      { 'ex-1': [questionPart('part-a')], 'ex-2': [] },
    )
    expect(result).toEqual({
      mode: 'per_question',
      entries: [{ exerciseId: 'ex-1', partId: 'part-a', points: 2 }],
    })
  })

  it('lève une erreur explicite si les questions ne sont pas encore chargées (mode per_question)', () => {
    expect(() =>
      buildEvaluationScoringPayload(
        { mode: 'per_question', pointsByExerciseId: {}, pointsByPartKey: {} },
        exerciseItems,
        { 'ex-1': [] }, // 'ex-2' absent : encore en cours de chargement
      ),
    ).toThrow('en cours de chargement')
  })

  it('rejette per_question si aucun point n’est saisi', () => {
    expect(() =>
      buildEvaluationScoringPayload(
        { mode: 'per_question', pointsByExerciseId: {}, pointsByPartKey: {} },
        exerciseItems,
        { 'ex-1': [questionPart('part-a')], 'ex-2': [] },
      ),
    ).toThrow('Renseignez au moins un barème par question')
  })
})

describe('buildEditableScoringStateFromEvaluation', () => {
  it('reconstruit un état vide si aucun scoring', () => {
    expect(buildEditableScoringStateFromEvaluation({ scoring: null })).toEqual(
      createEmptyScoringState(),
    )
  })

  it('reconstruit l’état per_exercise', () => {
    const state = buildEditableScoringStateFromEvaluation({
      scoring: { mode: 'per_exercise', entries: [{ exerciseId: 'ex-1', points: 4 }] },
    })
    expect(state).toEqual({
      mode: 'per_exercise',
      pointsByExerciseId: { 'ex-1': '4' },
      pointsByPartKey: {},
    })
  })

  it('reconstruit l’état per_question', () => {
    const state = buildEditableScoringStateFromEvaluation({
      scoring: {
        mode: 'per_question',
        entries: [{ exerciseId: 'ex-1', partId: 'part-a', points: 2 }],
      },
    })
    expect(state).toEqual({
      mode: 'per_question',
      pointsByExerciseId: {},
      pointsByPartKey: { 'ex-1:part-a': '2' },
    })
  })
})

describe('lecture côté passage', () => {
  const perExercise = { mode: 'per_exercise' as const, entries: [{ exerciseId: 'ex-1', points: 5 }] }
  const perQuestion = {
    mode: 'per_question' as const,
    entries: [{ exerciseId: 'ex-1', partId: 'part-a', points: 2 }],
  }

  it('findExerciseScoringPoints ne répond qu’en mode per_exercise', () => {
    expect(findExerciseScoringPoints(perExercise, 'ex-1')).toBe(5)
    expect(findExerciseScoringPoints(perExercise, 'ex-2')).toBeNull()
    expect(findExerciseScoringPoints(perQuestion, 'ex-1')).toBeNull()
    expect(findExerciseScoringPoints(null, 'ex-1')).toBeNull()
  })

  it('findQuestionScoringPoints ne répond qu’en mode per_question', () => {
    expect(findQuestionScoringPoints(perQuestion, 'ex-1', 'part-a')).toBe(2)
    expect(findQuestionScoringPoints(perQuestion, 'ex-1', 'part-b')).toBeNull()
    expect(findQuestionScoringPoints(perExercise, 'ex-1', 'part-a')).toBeNull()
  })

  it('sumScoringPointsByExerciseId agrège les points par exercice, y compris per_question', () => {
    const multiQuestion = {
      mode: 'per_question' as const,
      entries: [
        { exerciseId: 'ex-1', partId: 'part-a', points: 2 },
        { exerciseId: 'ex-1', partId: 'part-b', points: 3 },
      ],
    }
    expect(sumScoringPointsByExerciseId(multiQuestion)).toEqual({ 'ex-1': 5 })
    expect(sumScoringPointsByExerciseId(null)).toBeNull()
  })
})
