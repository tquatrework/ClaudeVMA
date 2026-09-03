/**
 * Tests pour TutorialQuizLinkPicker — sélection optionnelle d'un Quizz lié en fin de tutoriel.
 * Couvre la recherche, la sélection, l'affichage du titre déjà lié (jamais l'UUID), et le retrait
 * du lien.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/api/quizzes')

import { fetchQuiz, searchQuizzes } from '../../../src/api/quizzes'
import { TutorialQuizLinkPicker } from '../../../src/components/content-catalog/TutorialQuizLinkPicker'
import type { QuizSummary, PublicQuizDetail } from '../../../src/types/quiz'

const mockFetchQuiz = vi.mocked(fetchQuiz)
const mockSearchQuizzes = vi.mocked(searchQuizzes)

const QUIZ_SUMMARY: QuizSummary = {
  id: 'quiz-1',
  title: 'Quiz fractions',
  tags: ['fractions'],
  status: 'validated',
  authorId: 'teacher-1',
  authorRole: 'formateur',
  defaultPoints: 1,
  penaltyEnabled: false,
  penaltyPoints: 0,
  createdAt: '2026-06-15T08:00:00Z',
  updatedAt: '2026-06-15T08:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

function renderPicker(value: string | null = null, onChange = vi.fn()) {
  render(<TutorialQuizLinkPicker value={value} onChange={onChange} isSubmitting={false} />)
  return { onChange }
}

describe('TutorialQuizLinkPicker', () => {
  it("n'affiche aucun quizz lié par défaut", () => {
    renderPicker()
    expect(screen.getByText('Aucun quizz lié.')).toBeDefined()
  })

  it('recherche et sélectionne un quizz, jamais son identifiant technique affiché', async () => {
    mockSearchQuizzes.mockResolvedValue({ items: [QUIZ_SUMMARY], total: 1 })
    const { onChange } = renderPicker()

    await userEvent.click(screen.getByRole('button', { name: /lier un quizz/i }))
    await userEvent.type(screen.getByPlaceholderText(/rechercher un quizz par titre/i), 'fractions')
    await userEvent.click(screen.getByRole('button', { name: /^rechercher$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Quiz fractions' })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Quiz fractions' }))

    expect(onChange).toHaveBeenCalledWith('quiz-1')
    expect(screen.queryByText('quiz-1')).toBeNull()
  })

  it('résout et affiche le titre d’un quizz déjà lié (édition)', async () => {
    mockFetchQuiz.mockResolvedValue({ ...QUIZ_SUMMARY, questions: [] } as PublicQuizDetail)
    renderPicker('quiz-1')

    await waitFor(() => {
      expect(screen.getByText('Quiz fractions')).toBeDefined()
    })
    expect(mockFetchQuiz).toHaveBeenCalledWith('quiz-1')
  })

  it('retire le lien existant', async () => {
    mockFetchQuiz.mockResolvedValue({ ...QUIZ_SUMMARY, questions: [] } as PublicQuizDetail)
    const { onChange } = renderPicker('quiz-1')

    await waitFor(() => {
      expect(screen.getByText('Quiz fractions')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /retirer le lien/i }))

    expect(onChange).toHaveBeenCalledWith(null)
  })
})
