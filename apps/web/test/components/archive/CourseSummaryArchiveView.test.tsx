/**
 * Tests pour CourseSummaryArchiveView (Phase 11)
 *
 * Couvre :
 * - Affichage du badge "Conservation permanente" (VID-AC-002)
 * - Liste filtrée : seuls les items de type course_summary sont affichés
 * - Tri décroissant par date (le plus récent en premier)
 * - Lien vers la séance source si sourceUrl est fourni
 * - Message vide si aucun résumé de cours dans les archives
 * - Affichage du nombre de résumés
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CourseSummaryArchiveView from '../../../src/components/archive/CourseSummaryArchiveView'
import type { PedagogicalArchiveItem } from '../../../src/api/archiveDocument'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COURSE_SUMMARY_OLDER: PedagogicalArchiveItem = {
  id: 'summary-1',
  studentId: 'student-1',
  itemType: 'course_summary',
  title: 'Résumé — Séance du 1er mars',
  description: 'Introduction aux matrices.',
  sourceUrl: 'https://example.com/session/1',
  downloadUrl: undefined,
  occurredAt: '2026-03-01T10:00:00.000Z',
  createdAt: '2026-03-01T11:00:00.000Z',
  isAccessibleToFinanceOwner: true,
}

const COURSE_SUMMARY_NEWER: PedagogicalArchiveItem = {
  id: 'summary-2',
  studentId: 'student-1',
  itemType: 'course_summary',
  title: 'Résumé — Séance du 20 mars',
  description: 'Dérivées partielles.',
  sourceUrl: 'https://example.com/session/2',
  downloadUrl: undefined,
  occurredAt: '2026-03-20T10:00:00.000Z',
  createdAt: '2026-03-20T11:00:00.000Z',
  isAccessibleToFinanceOwner: true,
}

const PEDAGOGICAL_LOG_ITEM: PedagogicalArchiveItem = {
  id: 'log-1',
  studentId: 'student-1',
  itemType: 'pedagogical_log',
  title: 'Cahier — Exercice 5',
  description: 'Travail sur les fonctions.',
  sourceUrl: undefined,
  downloadUrl: 'https://example.com/download/1',
  occurredAt: '2026-03-15T14:00:00.000Z',
  createdAt: '2026-03-15T15:00:00.000Z',
  isAccessibleToFinanceOwner: true,
}

const NOTEBOOK_ENTRY_ITEM: PedagogicalArchiveItem = {
  id: 'notebook-1',
  studentId: 'student-1',
  itemType: 'notebook_entry',
  title: 'Note personnelle',
  description: 'Rappels personnels.',
  sourceUrl: undefined,
  downloadUrl: undefined,
  occurredAt: '2026-03-18T09:00:00.000Z',
  createdAt: '2026-03-18T09:05:00.000Z',
  isAccessibleToFinanceOwner: false,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CourseSummaryArchiveView', () => {
  it('affiche le message vide quand aucun résumé de cours n\'est présent', () => {
    render(<CourseSummaryArchiveView allArchiveItems={[]} />)

    expect(screen.getByText('Aucun résumé de cours archivé.')).toBeDefined()
  })

  it('affiche le message vide si les archives ne contiennent que des cahiers et carnets', () => {
    render(
      <CourseSummaryArchiveView
        allArchiveItems={[PEDAGOGICAL_LOG_ITEM, NOTEBOOK_ENTRY_ITEM]}
      />,
    )

    expect(screen.getByText('Aucun résumé de cours archivé.')).toBeDefined()
    expect(screen.queryByText('Conservation permanente')).toBeNull()
  })

  it('affiche le badge "Conservation permanente" (VID-AC-002) quand il y a des résumés', () => {
    render(
      <CourseSummaryArchiveView allArchiveItems={[COURSE_SUMMARY_NEWER]} />,
    )

    expect(screen.getByText('Conservation permanente')).toBeDefined()
  })

  it('affiche les titres des résumés de cours', () => {
    render(
      <CourseSummaryArchiveView
        allArchiveItems={[COURSE_SUMMARY_OLDER, COURSE_SUMMARY_NEWER]}
      />,
    )

    expect(screen.getByText('Résumé — Séance du 1er mars')).toBeDefined()
    expect(screen.getByText('Résumé — Séance du 20 mars')).toBeDefined()
  })

  it('affiche la description du résumé si elle est fournie', () => {
    render(<CourseSummaryArchiveView allArchiveItems={[COURSE_SUMMARY_OLDER]} />)

    expect(screen.getByText('Introduction aux matrices.')).toBeDefined()
  })

  it('filtre les items non-course_summary : le cahier de texte n\'apparaît pas', () => {
    render(
      <CourseSummaryArchiveView
        allArchiveItems={[COURSE_SUMMARY_NEWER, PEDAGOGICAL_LOG_ITEM]}
      />,
    )

    expect(screen.getByText('Résumé — Séance du 20 mars')).toBeDefined()
    expect(screen.queryByText('Cahier — Exercice 5')).toBeNull()
  })

  it('filtre les items non-course_summary : le carnet personnel n\'apparaît pas', () => {
    render(
      <CourseSummaryArchiveView
        allArchiveItems={[COURSE_SUMMARY_NEWER, NOTEBOOK_ENTRY_ITEM]}
      />,
    )

    expect(screen.getByText('Résumé — Séance du 20 mars')).toBeDefined()
    expect(screen.queryByText('Note personnelle')).toBeNull()
  })

  it('trie les résumés du plus récent au plus ancien', () => {
    render(
      <CourseSummaryArchiveView
        allArchiveItems={[COURSE_SUMMARY_OLDER, COURSE_SUMMARY_NEWER]}
      />,
    )

    const listItems = screen.getAllByRole('listitem')
    // Le plus récent (20 mars) doit apparaître en premier
    expect(listItems[0].textContent).toContain('Résumé — Séance du 20 mars')
    expect(listItems[1].textContent).toContain('Résumé — Séance du 1er mars')
  })

  it('affiche le lien "Voir le détail de la séance" si sourceUrl est fourni', () => {
    render(<CourseSummaryArchiveView allArchiveItems={[COURSE_SUMMARY_OLDER]} />)

    const sourceLink = screen.getByText('Voir le détail de la séance')
    expect(sourceLink).toBeDefined()
    expect(sourceLink.closest('a')?.getAttribute('href')).toBe('https://example.com/session/1')
  })

  it('n\'affiche pas de lien source si sourceUrl est absent', () => {
    const summaryWithoutSource: PedagogicalArchiveItem = {
      ...COURSE_SUMMARY_NEWER,
      sourceUrl: undefined,
    }

    render(<CourseSummaryArchiveView allArchiveItems={[summaryWithoutSource]} />)

    expect(screen.queryByText('Voir le détail de la séance')).toBeNull()
  })

  it('affiche le nombre de résumés dans le titre de section', () => {
    render(
      <CourseSummaryArchiveView
        allArchiveItems={[COURSE_SUMMARY_OLDER, COURSE_SUMMARY_NEWER]}
      />,
    )

    expect(screen.getByText(/Résumés de cours \(2\)/)).toBeDefined()
  })

  it('affiche la date de séance pour chaque résumé', () => {
    render(<CourseSummaryArchiveView allArchiveItems={[COURSE_SUMMARY_OLDER]} />)

    // La date doit être formatée en français sous forme "Séance du 1 mars 2026"
    // Le titre contient aussi "Séance du" donc on utilise getAllByText
    const dateElements = screen.getAllByText(/Séance du/)
    expect(dateElements.length).toBeGreaterThanOrEqual(1)
    // Au moins un élément doit contenir la date formatée (pas seulement le titre)
    const formattedDateEl = dateElements.find((el) => el.className.includes('text-gray-400'))
    expect(formattedDateEl).toBeDefined()
  })

  it('les résumés de cours ne disparaissent pas des archives même si l\'enregistrement expire (isPermanent garanti côté API)', () => {
    // VID-AC-002 : un résumé affiché signifie que le serveur le fournit
    // indépendamment de l'expiration vidéo. Le test vérifie que le composant
    // affiche systématiquement le badge "Conservation permanente" quand des
    // résumés sont présents.
    const expiredVideoSummary: PedagogicalArchiveItem = {
      ...COURSE_SUMMARY_OLDER,
      id: 'expired-summary',
      title: 'Résumé — Vidéo expirée',
      description: 'La vidéo a expiré mais le résumé reste.',
    }

    render(<CourseSummaryArchiveView allArchiveItems={[expiredVideoSummary]} />)

    expect(screen.getByText('Résumé — Vidéo expirée')).toBeDefined()
    expect(screen.getByText('La vidéo a expiré mais le résumé reste.')).toBeDefined()
    expect(screen.getByText('Conservation permanente')).toBeDefined()
  })
})
