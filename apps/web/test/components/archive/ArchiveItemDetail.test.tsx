/**
 * Tests pour ArchiveItemDetail (Phase 11)
 *
 * Couvre :
 * - Affichage du titre, type et date de l'archive
 * - Bouton "Ouvrir la source" si sourceUrl présent
 * - Bouton "Télécharger" si downloadUrl présent
 * - Message de restriction si notebook_entry et canAccessNotebook = false (parent financeur)
 * - Note de conservation permanente pour course_summary
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ArchiveItemDetail from '../../../src/components/archive/ArchiveItemDetail'
import type { PedagogicalArchiveItem } from '../../../src/api/archiveDocument'

const COURSE_SUMMARY: PedagogicalArchiveItem = {
  id: 'archive-1',
  studentId: 'student-1',
  itemType: 'course_summary',
  title: 'Résumé — Introduction aux intégrales',
  description: 'Séance du 10 mars 2026.',
  sourceUrl: 'https://example.com/session/42',
  downloadUrl: undefined,
  occurredAt: '2026-03-10T14:00:00.000Z',
  createdAt: '2026-03-10T15:00:00.000Z',
  isAccessibleToFinanceOwner: true,
}

const NOTEBOOK_ENTRY: PedagogicalArchiveItem = {
  id: 'archive-3',
  studentId: 'student-1',
  itemType: 'notebook_entry',
  title: 'Note personnelle — idées de révision',
  description: 'Rappels de formules.',
  sourceUrl: undefined,
  downloadUrl: undefined,
  occurredAt: '2026-03-12T09:00:00.000Z',
  createdAt: '2026-03-12T09:05:00.000Z',
  isAccessibleToFinanceOwner: false,
}

const LOG_WITH_DOWNLOAD: PedagogicalArchiveItem = {
  id: 'archive-2',
  studentId: 'student-1',
  itemType: 'pedagogical_log',
  title: 'Cahier — Exercice 5',
  description: undefined,
  sourceUrl: undefined,
  downloadUrl: 'https://example.com/download/42',
  occurredAt: '2026-03-11T10:00:00.000Z',
  createdAt: '2026-03-11T11:00:00.000Z',
  isAccessibleToFinanceOwner: true,
}

describe('ArchiveItemDetail', () => {
  it('affiche le titre et le type de l\'archive', () => {
    render(
      <ArchiveItemDetail
        archiveItem={COURSE_SUMMARY}
        canAccessNotebook
        isDownloadingDocument={false}
        onDownload={vi.fn()}
      />,
    )

    expect(screen.getByText('Résumé — Introduction aux intégrales')).toBeDefined()
    expect(screen.getByText('Résumé de cours')).toBeDefined()
  })

  it('affiche le bouton "Ouvrir la source" si sourceUrl est présent', () => {
    render(
      <ArchiveItemDetail
        archiveItem={COURSE_SUMMARY}
        canAccessNotebook
        isDownloadingDocument={false}
        onDownload={vi.fn()}
      />,
    )

    const sourceLink = screen.getByText('Ouvrir la source')
    expect(sourceLink).toBeDefined()
    expect(sourceLink.closest('a')?.getAttribute('href')).toBe('https://example.com/session/42')
  })

  it('affiche la note de conservation permanente pour un résumé de cours', () => {
    render(
      <ArchiveItemDetail
        archiveItem={COURSE_SUMMARY}
        canAccessNotebook
        isDownloadingDocument={false}
        onDownload={vi.fn()}
      />,
    )

    expect(screen.getByText(/Conservation permanente|permanent/i)).toBeDefined()
  })

  it('affiche le bouton "Télécharger" si downloadUrl est présent', () => {
    render(
      <ArchiveItemDetail
        archiveItem={LOG_WITH_DOWNLOAD}
        canAccessNotebook
        isDownloadingDocument={false}
        onDownload={vi.fn()}
      />,
    )

    expect(screen.getByText('Télécharger')).toBeDefined()
  })

  it('appelle onDownload avec l\'id du document au clic', async () => {
    const onDownload = vi.fn()

    render(
      <ArchiveItemDetail
        archiveItem={LOG_WITH_DOWNLOAD}
        canAccessNotebook
        isDownloadingDocument={false}
        onDownload={onDownload}
      />,
    )

    await userEvent.click(screen.getByText('Télécharger'))
    expect(onDownload).toHaveBeenCalledWith('archive-2')
  })

  it('désactive le bouton Télécharger pendant le téléchargement', () => {
    render(
      <ArchiveItemDetail
        archiveItem={LOG_WITH_DOWNLOAD}
        canAccessNotebook
        isDownloadingDocument
        onDownload={vi.fn()}
      />,
    )

    expect(screen.getByText('Téléchargement…')).toBeDefined()
    expect(screen.getByRole('button', { name: /Téléchargement/i }).hasAttribute('disabled')).toBe(true)
  })

  it('affiche le message de restriction pour le carnet personnel (parent financeur)', () => {
    render(
      <ArchiveItemDetail
        archiveItem={NOTEBOOK_ENTRY}
        canAccessNotebook={false}
        isDownloadingDocument={false}
        onDownload={vi.fn()}
      />,
    )

    expect(screen.getByText(/Ce document est réservé à l'élève/)).toBeDefined()
    // Pas de boutons d'action
    expect(screen.queryByText('Ouvrir la source')).toBeNull()
    expect(screen.queryByText('Télécharger')).toBeNull()
  })

  it('l\'élève peut accéder à son propre carnet personnel', () => {
    render(
      <ArchiveItemDetail
        archiveItem={NOTEBOOK_ENTRY}
        canAccessNotebook
        isDownloadingDocument={false}
        onDownload={vi.fn()}
      />,
    )

    // Pas de message de restriction
    expect(screen.queryByText(/Ce document est réservé à l'élève/)).toBeNull()
  })

  it('affiche "Aucun lien ou fichier associé" si ni sourceUrl ni downloadUrl', () => {
    const itemWithoutLinks: PedagogicalArchiveItem = {
      ...NOTEBOOK_ENTRY,
      itemType: 'pedagogical_log',
    }

    render(
      <ArchiveItemDetail
        archiveItem={itemWithoutLinks}
        canAccessNotebook
        isDownloadingDocument={false}
        onDownload={vi.fn()}
      />,
    )

    expect(screen.getByText(/Aucun lien ou fichier associé/)).toBeDefined()
  })
})
