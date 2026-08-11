/**
 * Tests de CourseSummaryArchiveView.
 *
 * Le type serveur est `resume_de_cours`. `course_summary`, filtré ici jusqu'au
 * 2026-08-11, n'a jamais existé côté serveur : l'onglet restait donc vide alors
 * que les résumés étaient bien renvoyés.
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CourseSummaryArchiveView from '../../../src/components/archive/CourseSummaryArchiveView'
import {
  COURSE_SUMMARY_ITEM,
  NOTEBOOK_ENTRY_ITEM,
  PEDAGOGICAL_LOG_ITEM,
} from '../../fixtures/archives'

describe('CourseSummaryArchiveView', () => {
  it('affiche un état vide quand aucune archive n’est fournie', () => {
    render(<CourseSummaryArchiveView allArchiveItems={[]} />)

    expect(screen.getByText('Aucun résumé de cours archivé.')).toBeDefined()
  })

  it('affiche un état vide quand aucune archive n’est un résumé de cours', () => {
    render(<CourseSummaryArchiveView allArchiveItems={[PEDAGOGICAL_LOG_ITEM]} />)

    expect(screen.getByText('Aucun résumé de cours archivé.')).toBeDefined()
  })

  it('retient les archives de type `resume_de_cours`', () => {
    render(
      <CourseSummaryArchiveView
        allArchiveItems={[COURSE_SUMMARY_ITEM, PEDAGOGICAL_LOG_ITEM, NOTEBOOK_ENTRY_ITEM]}
      />,
    )

    expect(screen.getByText('Résumé du cours du 3 mars')).toBeDefined()
    expect(screen.getByText('Résumés de cours (1)')).toBeDefined()
    expect(screen.queryByText('Cahier de texte — équations')).toBeNull()
  })

  it('annonce la conservation permanente', () => {
    render(<CourseSummaryArchiveView allArchiveItems={[COURSE_SUMMARY_ITEM]} />)

    expect(screen.getByText('Conservation permanente')).toBeDefined()
  })

  it('affiche la description et la date de séance', () => {
    render(<CourseSummaryArchiveView allArchiveItems={[COURSE_SUMMARY_ITEM]} />)

    expect(screen.getByText('Introduction aux matrices carrées.')).toBeDefined()
    expect(screen.getByText(/Séance du/)).toBeDefined()
  })

  it('trie les résumés du plus récent au plus ancien', () => {
    const olderSummary = {
      ...COURSE_SUMMARY_ITEM,
      id: 'older-summary',
      title: 'Résumé de janvier',
      occurredAt: '2026-01-10T10:00:00.000Z',
    }

    const { container } = render(
      <CourseSummaryArchiveView allArchiveItems={[olderSummary, COURSE_SUMMARY_ITEM]} />,
    )

    const renderedTitles = Array.from(container.querySelectorAll('li p:first-child')).map(
      (paragraph) => paragraph.textContent,
    )
    expect(renderedTitles).toEqual(['Résumé du cours du 3 mars', 'Résumé de janvier'])
  })
})
