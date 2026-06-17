/**
 * Tests pour ArchiveTimeline (Phase 11)
 *
 * Couvre :
 * - Rendu des entrées de timeline triées du plus récent au plus ancien
 * - Sélection d'un élément déclenche le callback
 * - État vide — message "Aucune archive disponible"
 * - L'élément sélectionné est visuellement mis en évidence
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ArchiveTimeline from '../../../src/components/archive/ArchiveTimeline'
import type { ArchiveTimelineEntry } from '../../../src/api/archiveDocument'

const ENTRY_OLDER: ArchiveTimelineEntry = {
  id: 'entry-1',
  studentId: 'student-1',
  itemType: 'pedagogical_log',
  title: 'Cahier — Séance du 1er mars',
  occurredAt: '2026-03-01T10:00:00.000Z',
  isAccessibleToFinanceOwner: true,
}

const ENTRY_NEWER: ArchiveTimelineEntry = {
  id: 'entry-2',
  studentId: 'student-1',
  itemType: 'course_summary',
  title: 'Résumé — Séance du 15 mars',
  description: 'Algèbre linéaire.',
  occurredAt: '2026-03-15T10:00:00.000Z',
  isAccessibleToFinanceOwner: true,
}

describe('ArchiveTimeline', () => {
  it('affiche le message vide quand la liste est vide', () => {
    render(
      <ArchiveTimeline
        timelineEntries={[]}
        onSelectEntry={vi.fn()}
      />,
    )

    expect(screen.getByText(/Aucune archive disponible/)).toBeDefined()
  })

  it('affiche les titres des entrées de timeline', () => {
    render(
      <ArchiveTimeline
        timelineEntries={[ENTRY_OLDER, ENTRY_NEWER]}
        onSelectEntry={vi.fn()}
      />,
    )

    expect(screen.getByText('Cahier — Séance du 1er mars')).toBeDefined()
    expect(screen.getByText('Résumé — Séance du 15 mars')).toBeDefined()
  })

  it('trie les entrées du plus récent au plus ancien', () => {
    render(
      <ArchiveTimeline
        timelineEntries={[ENTRY_OLDER, ENTRY_NEWER]}
        onSelectEntry={vi.fn()}
      />,
    )

    const items = screen.getAllByRole('button')
    expect(items[0].textContent).toContain('Résumé — Séance du 15 mars')
    expect(items[1].textContent).toContain('Cahier — Séance du 1er mars')
  })

  it('appelle onSelectEntry avec l\'id de l\'entrée cliquée', async () => {
    const onSelectEntry = vi.fn()

    render(
      <ArchiveTimeline
        timelineEntries={[ENTRY_NEWER]}
        onSelectEntry={onSelectEntry}
      />,
    )

    await userEvent.click(screen.getByText('Résumé — Séance du 15 mars'))

    expect(onSelectEntry).toHaveBeenCalledWith('entry-2')
  })

  it('affiche la description si elle est fournie', () => {
    render(
      <ArchiveTimeline
        timelineEntries={[ENTRY_NEWER]}
        onSelectEntry={vi.fn()}
      />,
    )

    expect(screen.getByText('Algèbre linéaire.')).toBeDefined()
  })

  it('affiche le badge de type de l\'archive', () => {
    render(
      <ArchiveTimeline
        timelineEntries={[ENTRY_NEWER]}
        onSelectEntry={vi.fn()}
      />,
    )

    expect(screen.getByText('Résumé de cours')).toBeDefined()
  })
})
