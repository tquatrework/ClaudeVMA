/**
 * Tests de MemoReadOnlyContent — rendu pur (chargement/erreur/vide/succès),
 * un item par type. La récupération des octets d'une image passe par
 * `useMemoItemImageUrl` (fetch authentifié) — mockée ici, son propre
 * comportement est couvert ailleurs par les tests du hook/de l'API.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MemoReadOnlyContent } from '../../../src/components/pedagogical-log/MemoReadOnlyContent'
import type { MemoChapter, MemoTextItem } from '../../../src/types/memo'

vi.mock('../../../src/hooks/pedagogical-log/useMemoItemImageUrl', () => ({
  useMemoItemImageUrl: () => ({ imageUrl: 'blob:test/image', isLoading: false, error: null }),
}))

function makeChapter(overrides: Partial<MemoChapter> = {}): MemoChapter {
  return {
    id: 'chapter-1',
    studentId: 'student-1',
    title: 'Trigonométrie',
    order: 0,
    createdAt: '2026-08-27T00:00:00.000Z',
    updatedAt: '2026-08-27T00:00:00.000Z',
    items: [],
    ...overrides,
  }
}

describe('MemoReadOnlyContent — chargement / erreur / vide', () => {
  it('affiche un état de chargement', () => {
    render(<MemoReadOnlyContent chapters={null} isLoading error={null} />)
    expect(screen.getByText(/chargement du mémo/i)).toBeDefined()
  })

  it('affiche un message d\'erreur', () => {
    render(<MemoReadOnlyContent chapters={null} isLoading={false} error="Accès refusé" />)
    expect(screen.getByText('Accès refusé')).toBeDefined()
  })

  it('affiche un état vide quand aucun chapitre n\'existe', () => {
    render(<MemoReadOnlyContent chapters={[]} isLoading={false} error={null} />)
    expect(screen.getByText(/aucune note dans le mémo/i)).toBeDefined()
  })
})

describe('MemoReadOnlyContent — rendu par type d\'item', () => {
  it('rend un item texte, avec la syntaxe légère interprétée', () => {
    const chapters = [
      makeChapter({
        items: [
          {
            id: 'item-1',
            chapterId: 'chapter-1',
            type: 'text',
            content: 'cos²θ + sin²θ = 1',
            title: null,
            order: 0,
            createdAt: '2026-08-27T00:00:00.000Z',
            updatedAt: '2026-08-27T00:00:00.000Z',
          },
        ],
      }),
    ]

    render(<MemoReadOnlyContent chapters={chapters} isLoading={false} error={null} />)

    expect(screen.getByRole('heading', { name: 'Trigonométrie' })).toBeDefined()
    expect(screen.getByText('cos²θ + sin²θ = 1')).toBeDefined()
  })

  it('rend un item formule via KaTeX', () => {
    const chapters = [
      makeChapter({
        items: [
          {
            id: 'item-2',
            chapterId: 'chapter-1',
            type: 'formula',
            content: 'x^2',
            title: 'Carré',
            order: 0,
            createdAt: '2026-08-27T00:00:00.000Z',
            updatedAt: '2026-08-27T00:00:00.000Z',
          },
        ],
      }),
    ]

    const { container } = render(<MemoReadOnlyContent chapters={chapters} isLoading={false} error={null} />)

    expect(container.querySelector('.katex')).not.toBeNull()
    expect(screen.getByText('Carré')).toBeDefined()
  })

  it('rend un item image avec sa légende', async () => {
    const chapters = [
      makeChapter({
        items: [
          {
            id: 'item-3',
            chapterId: 'chapter-1',
            type: 'image',
            content: 'Schéma du triangle',
            title: null,
            imageOriginalFilename: 'triangle.png',
            imageStoredFilename: 'uuid.png',
            imageMimeType: 'image/png',
            imageSizeBytes: 1234,
            order: 0,
            createdAt: '2026-08-27T00:00:00.000Z',
            updatedAt: '2026-08-27T00:00:00.000Z',
          },
        ],
      }),
    ]

    render(<MemoReadOnlyContent chapters={chapters} isLoading={false} error={null} />)

    await waitFor(() => {
      expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:test/image')
    })
    expect(screen.getByText('Schéma du triangle')).toBeDefined()
  })

  it('affiche un message pour un chapitre sans note', () => {
    render(<MemoReadOnlyContent chapters={[makeChapter()]} isLoading={false} error={null} />)
    expect(screen.getByText(/aucune note dans ce chapitre/i)).toBeDefined()
  })
})

function makeTextItem(id: string, chapterId: string, content: string): MemoTextItem {
  return {
    id,
    chapterId,
    type: 'text',
    content,
    title: null,
    order: 0,
    createdAt: '2026-08-27T00:00:00.000Z',
    updatedAt: '2026-08-27T00:00:00.000Z',
  }
}

describe('MemoReadOnlyContent — filtre par chapitre', () => {
  function makeTwoChapters(): MemoChapter[] {
    return [
      makeChapter({
        id: 'chapter-1',
        title: 'Trigonométrie',
        items: [makeTextItem('item-1', 'chapter-1', 'cos²θ + sin²θ = 1')],
      }),
      makeChapter({
        id: 'chapter-2',
        title: 'Probabilités',
        items: [makeTextItem('item-2', 'chapter-2', 'P(A) + P(non A) = 1')],
      }),
    ]
  }

  it('affiche "Tous les chapitres" par défaut et tous les chapitres', () => {
    render(<MemoReadOnlyContent chapters={makeTwoChapters()} isLoading={false} error={null} />)

    expect(
      screen.getByRole('combobox', { name: /filtrer par chapitre/i }),
    ).toHaveValue('all')
    expect(screen.getByRole('heading', { name: 'Trigonométrie' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Probabilités' })).toBeDefined()
  })

  it('filtre l\'affichage au seul chapitre sélectionné', async () => {
    render(<MemoReadOnlyContent chapters={makeTwoChapters()} isLoading={false} error={null} />)

    const select = screen.getByRole('combobox', { name: /filtrer par chapitre/i })
    await userEvent.selectOptions(select, 'chapter-2')

    expect(screen.queryByRole('heading', { name: 'Trigonométrie' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Probabilités' })).toBeDefined()
    expect(screen.getByText('P(A) + P(non A) = 1')).toBeDefined()
  })

  it('revient à tous les chapitres via l\'option "Tous les chapitres"', async () => {
    render(<MemoReadOnlyContent chapters={makeTwoChapters()} isLoading={false} error={null} />)

    const select = screen.getByRole('combobox', { name: /filtrer par chapitre/i })
    await userEvent.selectOptions(select, 'chapter-2')
    expect(screen.queryByRole('heading', { name: 'Trigonométrie' })).toBeNull()

    await userEvent.selectOptions(select, 'all')

    expect(screen.getByRole('heading', { name: 'Trigonométrie' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Probabilités' })).toBeDefined()
  })

  it('préselectionne un chapitre via initialChapterId', () => {
    render(
      <MemoReadOnlyContent
        chapters={makeTwoChapters()}
        isLoading={false}
        error={null}
        initialChapterId="chapter-2"
      />,
    )

    expect(
      screen.getByRole('combobox', { name: /filtrer par chapitre/i }),
    ).toHaveValue('chapter-2')
    expect(screen.queryByRole('heading', { name: 'Trigonométrie' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Probabilités' })).toBeDefined()
  })
})
