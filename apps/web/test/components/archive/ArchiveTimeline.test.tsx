/**
 * Tests d'ArchiveTimeline.
 *
 * Le serveur renvoie la timeline **groupée par date** : le composant affiche ces
 * groupes du plus récent au plus ancien, avec les libellés français du point unique
 * `utils/archiveLabels.ts` — jamais la valeur technique `resume_de_cours`.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ArchiveTimeline from '../../../src/components/archive/ArchiveTimeline'
import { TIMELINE_GROUPS } from '../../fixtures/archives'

describe('ArchiveTimeline', () => {
  it('affiche le message vide quand aucun groupe n’est fourni', () => {
    render(<ArchiveTimeline timelineGroups={[]} onSelectItem={vi.fn()} />)

    expect(screen.getByText('Aucune archive disponible pour cette personne.')).toBeDefined()
  })

  it('affiche un message vide personnalisé quand l’appelant en fournit un', () => {
    render(
      <ArchiveTimeline
        timelineGroups={[]}
        onSelectItem={vi.fn()}
        emptyMessage="Rien à afficher ici."
      />,
    )

    expect(screen.getByText('Rien à afficher ici.')).toBeDefined()
  })

  it('affiche les titres de tous les groupes', () => {
    render(<ArchiveTimeline timelineGroups={TIMELINE_GROUPS} onSelectItem={vi.fn()} />)

    expect(screen.getByText('Résumé du cours du 3 mars')).toBeDefined()
    expect(screen.getByText('Cahier de texte — équations')).toBeDefined()
    expect(screen.getByText('Note personnelle')).toBeDefined()
  })

  it('range les dates du plus récent au plus ancien, au format français', () => {
    const { container } = render(
      <ArchiveTimeline timelineGroups={TIMELINE_GROUPS} onSelectItem={vi.fn()} />,
    )

    const renderedDates = Array.from(container.querySelectorAll('h3')).map(
      (heading) => heading.textContent,
    )
    expect(renderedDates).toEqual(['05/03/2026', '04/03/2026', '03/03/2026'])
  })

  it('affiche les libellés français des types, jamais la valeur technique', () => {
    render(<ArchiveTimeline timelineGroups={TIMELINE_GROUPS} onSelectItem={vi.fn()} />)

    expect(screen.getByText('Résumé de cours')).toBeDefined()
    expect(screen.getByText('Cahier de texte')).toBeDefined()
    expect(screen.getByText('Carnet personnel')).toBeDefined()
    expect(screen.queryByText('resume_de_cours')).toBeNull()
  })

  it('remonte l’identifiant de l’élément cliqué', async () => {
    const onSelectItem = vi.fn()
    render(<ArchiveTimeline timelineGroups={TIMELINE_GROUPS} onSelectItem={onSelectItem} />)

    await userEvent.click(screen.getByText('Note personnelle'))

    expect(onSelectItem).toHaveBeenCalledWith(TIMELINE_GROUPS[2].items[0].id)
  })

  it('affiche les points pédagogiques quand il y en a, et rien sinon', () => {
    render(<ArchiveTimeline timelineGroups={TIMELINE_GROUPS} onSelectItem={vi.fn()} />)

    expect(screen.getByText('3 points pédagogiques')).toBeDefined()
    expect(screen.queryByText('0 point pédagogique')).toBeNull()
  })
})
