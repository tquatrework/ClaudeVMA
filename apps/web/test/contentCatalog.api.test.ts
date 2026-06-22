/**
 * Tests unitaires pour apps/web/src/api/contentCatalog.ts (Phase 12)
 *
 * Vérifie que chaque fonction appelle la bonne route HTTP avec les bons paramètres.
 *
 * Couverture :
 * - fetchExercises()              → GET /exercises (avec et sans params)
 * - createExercise()              → POST /exercises
 * - submitExerciseAnswer()        → POST /exercises/:id/answers
 * - requestExerciseCorrection()   → POST /exercise-answers/:id/correction-requests
 * - createExerciseSolution()      → POST /exercises/:id/solutions
 * - fetchEvaluations()            → GET /evaluations
 * - createEvaluation()            → POST /evaluations
 * - startEvaluationAttempt()      → POST /evaluations/:id/attempts
 * - fetchTutorials()              → GET /tutorials
 * - createTutorial()              → POST /tutorials
 * - createContentComment()        → POST /contents/:id/comments
 * - createContentRating()         → POST /contents/:id/ratings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock du client axios partagé
vi.mock('../src/api/client')

import apiClient from '../src/api/client'
import {
  fetchExercises,
  createExercise,
  submitExerciseAnswer,
  requestExerciseCorrection,
  createExerciseSolution,
  fetchEvaluations,
  createEvaluation,
  startEvaluationAttempt,
  fetchTutorials,
  createTutorial,
  createContentComment,
  createContentRating,
  type Exercise,
  type Evaluation,
  type Tutorial,
  type ExerciseAnswer,
  type CorrectionRequest,
  type ExerciseSolution,
  type EvaluationAttempt,
  type ContentComment,
  type ContentRating,
} from '../src/api/contentCatalog'

const mockApiClient = vi.mocked(apiClient)

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EXERCISE: Exercise = {
  id: 'ex-1',
  title: 'Dérivées et primitives',
  description: 'Calcul de dérivées',
  subject: 'Mathématiques',
  level: 'Terminale',
  difficultyLevel: 'moyen',
  status: 'published',
  authorId: 'teacher-1',
  hasSolution: true,
  createdAt: '2026-06-15T08:00:00Z',
}

const EVALUATION: Evaluation = {
  id: 'eval-1',
  title: 'DS Dérivées',
  description: 'Devoir surveillé',
  subject: 'Mathématiques',
  level: 'Terminale',
  difficultyLevel: 'difficile',
  status: 'published',
  authorId: 'teacher-1',
  hasSolution: true,
  durationMinutes: 60,
  createdAt: '2026-06-15T09:00:00Z',
}

const TUTORIAL: Tutorial = {
  id: 'tuto-1',
  title: 'Introduction aux intégrales',
  description: 'Les bases',
  subject: 'Mathématiques',
  level: 'Terminale',
  videoUrl: 'https://video.example.com/integrales',
  status: 'published',
  authorId: 'teacher-1',
  createdAt: '2026-06-15T10:00:00Z',
}

const EXERCISE_ANSWER: ExerciseAnswer = {
  id: 'answer-1',
  exerciseId: 'ex-1',
  studentId: 'student-1',
  content: 'Ma réponse',
  submittedAt: '2026-06-17T10:00:00Z',
}

const CORRECTION_REQUEST: CorrectionRequest = {
  id: 'correction-1',
  exerciseAnswerId: 'answer-1',
  studentId: 'student-1',
  requestedAt: '2026-06-17T10:05:00Z',
  correctionStatus: 'pending',
}

const EXERCISE_SOLUTION: ExerciseSolution = {
  id: 'solution-1',
  exerciseId: 'ex-1',
  content: 'La solution détaillée',
  createdAt: '2026-06-17T11:00:00Z',
}

const EVALUATION_ATTEMPT: EvaluationAttempt = {
  id: 'attempt-1',
  evaluationId: 'eval-1',
  studentId: 'student-1',
  answers: 'Mes réponses',
  startedAt: '2026-06-17T10:00:00Z',
  isSolutionUnlocked: false,
}

const CONTENT_COMMENT: ContentComment = {
  id: 'comment-1',
  contentId: 'ex-1',
  authorId: 'student-1',
  content: 'Bon exercice',
  createdAt: '2026-06-17T12:00:00Z',
}

const CONTENT_RATING: ContentRating = {
  id: 'rating-1',
  contentId: 'ex-1',
  authorId: 'student-1',
  score: 4,
  createdAt: '2026-06-17T12:05:00Z',
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Tests Exercices ──────────────────────────────────────────────────────────

describe('contentCatalog API — Exercices', () => {
  describe('fetchExercises', () => {
    it('GET /exercises sans paramètres et retourne un tableau direct', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: [EXERCISE] })

      const result = await fetchExercises()

      expect(mockApiClient.get).toHaveBeenCalledWith('/exercises', { params: undefined })
      expect(result).toEqual([EXERCISE])
    })

    it('passe les filtres en query params', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

      await fetchExercises({ subject: 'Mathématiques', level: 'Terminale', difficultyLevel: 'moyen' })

      expect(mockApiClient.get).toHaveBeenCalledWith('/exercises', {
        params: { subject: 'Mathématiques', level: 'Terminale', difficultyLevel: 'moyen' },
      })
    })

    it('supporte une réponse paginée { data: [], meta: {} }', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({
        data: { data: [EXERCISE], meta: { total: 1, page: 1, pageSize: 20 } },
      })

      const result = await fetchExercises()

      expect(result).toEqual([EXERCISE])
    })

    it('filtre par statut pending_validation pour RP/AP', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

      await fetchExercises({ status: 'pending_validation' })

      expect(mockApiClient.get).toHaveBeenCalledWith('/exercises', {
        params: { status: 'pending_validation' },
      })
    })
  })

  describe('createExercise', () => {
    it('POST /exercises avec le bon payload', async () => {
      mockApiClient.post = vi.fn().mockResolvedValue({ data: EXERCISE })

      const payload = {
        title: 'Dérivées et primitives',
        description: 'Calcul de dérivées',
        subject: 'Mathématiques',
        level: 'Terminale',
        difficultyLevel: 'moyen' as const,
        solutionContent: 'La solution',
      }

      const result = await createExercise(payload)

      expect(mockApiClient.post).toHaveBeenCalledWith('/exercises', payload)
      expect(result).toEqual(EXERCISE)
    })
  })

  describe('submitExerciseAnswer', () => {
    it('POST /exercises/:id/answers avec le bon id et contenu', async () => {
      mockApiClient.post = vi.fn().mockResolvedValue({ data: EXERCISE_ANSWER })

      const result = await submitExerciseAnswer('ex-1', { content: 'Ma réponse' })

      expect(mockApiClient.post).toHaveBeenCalledWith('/exercises/ex-1/answers', {
        content: 'Ma réponse',
      })
      expect(result).toEqual(EXERCISE_ANSWER)
    })
  })

  describe('requestExerciseCorrection', () => {
    it('POST /exercise-answers/:id/correction-requests', async () => {
      mockApiClient.post = vi.fn().mockResolvedValue({ data: CORRECTION_REQUEST })

      const result = await requestExerciseCorrection('answer-1', { message: 'Aide SVP' })

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/exercise-answers/answer-1/correction-requests',
        { message: 'Aide SVP' },
      )
      expect(result).toEqual(CORRECTION_REQUEST)
    })

    it('envoie un payload sans message si absent', async () => {
      mockApiClient.post = vi.fn().mockResolvedValue({ data: CORRECTION_REQUEST })

      await requestExerciseCorrection('answer-1', {})

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/exercise-answers/answer-1/correction-requests',
        {},
      )
    })
  })

  describe('createExerciseSolution', () => {
    it('POST /exercises/:id/solutions', async () => {
      mockApiClient.post = vi.fn().mockResolvedValue({ data: EXERCISE_SOLUTION })

      const result = await createExerciseSolution('ex-1', { content: 'La solution détaillée' })

      expect(mockApiClient.post).toHaveBeenCalledWith('/exercises/ex-1/solutions', {
        content: 'La solution détaillée',
      })
      expect(result).toEqual(EXERCISE_SOLUTION)
    })
  })
})

// ─── Tests Évaluations ────────────────────────────────────────────────────────

describe('contentCatalog API — Évaluations', () => {
  describe('fetchEvaluations', () => {
    it('GET /evaluations sans paramètres', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: [EVALUATION] })

      const result = await fetchEvaluations()

      expect(mockApiClient.get).toHaveBeenCalledWith('/evaluations', { params: undefined })
      expect(result).toEqual([EVALUATION])
    })

    it('supporte une réponse paginée', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({
        data: { data: [EVALUATION], meta: { total: 1, page: 1, pageSize: 20 } },
      })

      const result = await fetchEvaluations()

      expect(result).toEqual([EVALUATION])
    })
  })

  describe('createEvaluation', () => {
    it('POST /evaluations avec solution obligatoire', async () => {
      mockApiClient.post = vi.fn().mockResolvedValue({ data: EVALUATION })

      const payload = {
        title: 'DS Dérivées',
        description: 'Devoir surveillé',
        subject: 'Mathématiques',
        level: 'Terminale',
        difficultyLevel: 'difficile' as const,
        solutionContent: 'Corrigé complet',
        durationMinutes: 60,
      }

      const result = await createEvaluation(payload)

      expect(mockApiClient.post).toHaveBeenCalledWith('/evaluations', payload)
      expect(result).toEqual(EVALUATION)
    })

    it('POST /evaluations sans durée (champ optionnel)', async () => {
      mockApiClient.post = vi.fn().mockResolvedValue({ data: EVALUATION })

      const payload = {
        title: 'DS Dérivées',
        description: 'Devoir surveillé',
        subject: 'Mathématiques',
        level: 'Terminale',
        difficultyLevel: 'difficile' as const,
        solutionContent: 'Corrigé complet',
      }

      await createEvaluation(payload)

      expect(mockApiClient.post).toHaveBeenCalledWith('/evaluations', payload)
    })
  })

  describe('startEvaluationAttempt', () => {
    it('POST /evaluations/:id/attempts — la solution est bloquée tant que isSolutionUnlocked=false', async () => {
      mockApiClient.post = vi.fn().mockResolvedValue({ data: EVALUATION_ATTEMPT })

      const result = await startEvaluationAttempt('eval-1', { answers: 'Mes réponses' })

      expect(mockApiClient.post).toHaveBeenCalledWith('/evaluations/eval-1/attempts', {
        answers: 'Mes réponses',
      })
      expect(result.isSolutionUnlocked).toBe(false)
    })

    it('retourne isSolutionUnlocked=true quand la correction est faite', async () => {
      mockApiClient.post = vi.fn().mockResolvedValue({
        data: { ...EVALUATION_ATTEMPT, isSolutionUnlocked: true, score: 85 },
      })

      const result = await startEvaluationAttempt('eval-1', { answers: 'Mes réponses' })

      expect(result.isSolutionUnlocked).toBe(true)
      expect(result.score).toBe(85)
    })
  })
})

// ─── Tests Tutoriels ──────────────────────────────────────────────────────────

describe('contentCatalog API — Tutoriels', () => {
  describe('fetchTutorials', () => {
    it('GET /tutorials sans paramètres', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: [TUTORIAL] })

      const result = await fetchTutorials()

      expect(mockApiClient.get).toHaveBeenCalledWith('/tutorials', { params: undefined })
      expect(result).toEqual([TUTORIAL])
    })
  })

  describe('createTutorial', () => {
    it('POST /tutorials avec URL vidéo', async () => {
      mockApiClient.post = vi.fn().mockResolvedValue({ data: TUTORIAL })

      const payload = {
        title: 'Introduction aux intégrales',
        description: 'Les bases',
        subject: 'Mathématiques',
        level: 'Terminale',
        videoUrl: 'https://video.example.com/integrales',
      }

      const result = await createTutorial(payload)

      expect(mockApiClient.post).toHaveBeenCalledWith('/tutorials', payload)
      expect(result).toEqual(TUTORIAL)
    })

    it('POST /tutorials sans URL vidéo (optionnel)', async () => {
      mockApiClient.post = vi.fn().mockResolvedValue({ data: { ...TUTORIAL, videoUrl: undefined } })

      const payload = {
        title: 'Tutoriel texte',
        description: 'Description',
        subject: 'Mathématiques',
        level: 'Terminale',
      }

      await createTutorial(payload)

      expect(mockApiClient.post).toHaveBeenCalledWith('/tutorials', payload)
    })
  })
})

// ─── Tests Commentaires et Notations ─────────────────────────────────────────

describe('contentCatalog API — Commentaires et Notations', () => {
  describe('createContentComment', () => {
    it('POST /contents/:id/comments avec le bon contentId', async () => {
      mockApiClient.post = vi.fn().mockResolvedValue({ data: CONTENT_COMMENT })

      const result = await createContentComment('ex-1', { content: 'Bon exercice' })

      expect(mockApiClient.post).toHaveBeenCalledWith('/contents/ex-1/comments', {
        content: 'Bon exercice',
      })
      expect(result).toEqual(CONTENT_COMMENT)
    })

    it('fonctionne avec un contentId de tutoriel', async () => {
      mockApiClient.post = vi.fn().mockResolvedValue({
        data: { ...CONTENT_COMMENT, contentId: 'tuto-1' },
      })

      await createContentComment('tuto-1', { content: 'Très utile !' })

      expect(mockApiClient.post).toHaveBeenCalledWith('/contents/tuto-1/comments', {
        content: 'Très utile !',
      })
    })
  })

  describe('createContentRating', () => {
    it('POST /contents/:id/ratings — un seul rating par utilisateur (règle API)', async () => {
      mockApiClient.post = vi.fn().mockResolvedValue({ data: CONTENT_RATING })

      const result = await createContentRating('ex-1', { score: 4 })

      expect(mockApiClient.post).toHaveBeenCalledWith('/contents/ex-1/ratings', { score: 4 })
      expect(result).toEqual(CONTENT_RATING)
    })

    it('envoie le score correctement', async () => {
      mockApiClient.post = vi.fn().mockResolvedValue({ data: { ...CONTENT_RATING, score: 5 } })

      const result = await createContentRating('eval-1', { score: 5 })

      expect(result.score).toBe(5)
      expect(mockApiClient.post).toHaveBeenCalledWith('/contents/eval-1/ratings', { score: 5 })
    })
  })
})
