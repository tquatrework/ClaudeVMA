/**
 * Tests de MemoReadOnlyContent — rendu pur (chargement/erreur/vide/succès),
 * un item par type. La récupération des octets d'une image passe par
 * `useMemoItemImageUrl` (fetch authentifié) — mockée ici, son propre
 * comportement est couvert ailleurs par les tests du hook/de l'API.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoReadOnlyContent } from '../../../src/components/pedagogical-log/MemoReadOnlyContent'
import type { MemoChapter } from '../../../src/types/memo'

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
            order: 0,
            createdAt: '2026-08-27T00:00:00.000Z',
            updatedAt: '2026-08-27T00:00:00.000Z',
          },
        ],
      }),
    ]

    render(<MemoReadOnlyContent chapters={chapters} isLoading={false} error={null} />)

    expect(screen.getByText('Trigonométrie')).toBeDefined()
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
            order: 0,
            createdAt: '2026-08-27T00:00:00.000Z',
            updatedAt: '2026-08-27T00:00:00.000Z',
          },
        ],
      }),
    ]

    const { container } = render(<MemoReadOnlyContent chapters={chapters} isLoading={false} error={null} />)

    expect(container.querySelector('.katex')).not.toBeNull()
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
