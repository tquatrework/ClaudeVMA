/**
 * Tests de MemoReadOnlyModal — assemblage DraggableModal + MemoReadOnlyContent,
 * alimenté par useStudentMemo (mocké : son propre comportement est couvert
 * par test/hooks/useStudentMemo.test.tsx).
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../src/hooks/pedagogical-log/useStudentMemo')

import { useStudentMemo } from '../../../src/hooks/pedagogical-log/useStudentMemo'
import { MemoReadOnlyModal } from '../../../src/components/pedagogical-log/MemoReadOnlyModal'

const mockUseStudentMemo = vi.mocked(useStudentMemo)

describe('MemoReadOnlyModal', () => {
  it('affiche un titre par défaut et le contenu chargé', () => {
    mockUseStudentMemo.mockReturnValue({ chapters: [], isLoading: false, error: null })

    render(<MemoReadOnlyModal studentId="student-1" onClose={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'Mémo' })).toBeDefined()
    expect(mockUseStudentMemo).toHaveBeenCalledWith('student-1')
  })

  it('accepte un titre personnalisé (ex. nom de l\'élève)', () => {
    mockUseStudentMemo.mockReturnValue({ chapters: [], isLoading: false, error: null })

    render(
      <MemoReadOnlyModal
        studentId="student-1"
        title="Mémo de Camille Durand"
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Mémo de Camille Durand' })).toBeDefined()
  })

  it('appelle onClose depuis la modale', async () => {
    mockUseStudentMemo.mockReturnValue({ chapters: [], isLoading: false, error: null })
    const handleClose = vi.fn()

    render(<MemoReadOnlyModal studentId="student-1" onClose={handleClose} />)

    await userEvent.click(screen.getByLabelText('Fermer'))

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('transmet initialChapterId à MemoReadOnlyContent (lien « Détacher » sur un chapitre)', () => {
    mockUseStudentMemo.mockReturnValue({
      chapters: [
        {
          id: 'chapter-1',
          studentId: 'student-1',
          title: 'Trigonométrie',
          order: 0,
          createdAt: '2026-08-27T00:00:00.000Z',
          updatedAt: '2026-08-27T00:00:00.000Z',
          items: [],
        },
        {
          id: 'chapter-2',
          studentId: 'student-1',
          title: 'Probabilités',
          order: 1,
          createdAt: '2026-08-27T00:00:00.000Z',
          updatedAt: '2026-08-27T00:00:00.000Z',
          items: [],
        },
      ],
      isLoading: false,
      error: null,
    })

    render(
      <MemoReadOnlyModal studentId="student-1" onClose={vi.fn()} initialChapterId="chapter-2" />,
    )

    expect(screen.getByRole('combobox', { name: /filtrer par chapitre/i })).toHaveValue(
      'chapter-2',
    )
    expect(screen.queryByRole('heading', { name: 'Trigonométrie' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Probabilités' })).toBeDefined()
  })
})
