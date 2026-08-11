/**
 * Tests d'ArchiveItemDetail.
 *
 * Contrats vérifiés : libellés français issus du point unique, carnet personnel
 * inaccessible au parent financeur, action de téléchargement proposée seulement
 * quand le serveur a fourni un `downloadUrl`. Aucun `sourceUrl` n'existe côté
 * serveur : le bouton « Ouvrir la source » d'autrefois n'avait rien à ouvrir.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ArchiveItemDetail from '../../../src/components/archive/ArchiveItemDetail'
import {
  COURSE_SUMMARY_ITEM,
  NOTEBOOK_ENTRY_ITEM,
  PEDAGOGICAL_LOG_ITEM,
} from '../../fixtures/archives'

function renderDetail(
  archiveItem = COURSE_SUMMARY_ITEM,
  { canAccessNotebook = true, isDownloadingDocument = false } = {},
  onDownload = vi.fn(),
) {
  render(
    <ArchiveItemDetail
      archiveItem={archiveItem}
      canAccessNotebook={canAccessNotebook}
      isDownloadingDocument={isDownloadingDocument}
      onDownload={onDownload}
    />,
  )
  return onDownload
}

describe('ArchiveItemDetail', () => {
  it('affiche le titre, le libellé français du type et la description', () => {
    renderDetail()

    expect(screen.getByText('Résumé du cours du 3 mars')).toBeDefined()
    expect(screen.getByText('Résumé de cours')).toBeDefined()
    expect(screen.getByText('Introduction aux matrices carrées.')).toBeDefined()
  })

  it('signale la conservation permanente des résumés de cours', () => {
    renderDetail()

    expect(screen.getByText(/reste accessible même après expiration/)).toBeDefined()
  })

  it('affiche la note quand le serveur en renvoie une', () => {
    renderDetail(PEDAGOGICAL_LOG_ITEM)

    expect(screen.getByText('Note obtenue : 14')).toBeDefined()
  })

  it('propose le téléchargement quand un downloadUrl existe', async () => {
    const onDownload = renderDetail(PEDAGOGICAL_LOG_ITEM)

    await userEvent.click(screen.getByRole('button', { name: 'Télécharger' }))

    expect(onDownload).toHaveBeenCalledWith(PEDAGOGICAL_LOG_ITEM.id)
  })

  it('indique explicitement l’absence de fichier plutôt qu’un bouton inerte', () => {
    renderDetail(COURSE_SUMMARY_ITEM)

    expect(screen.getByText('Aucun fichier associé à cette archive.')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Télécharger' })).toBeNull()
  })

  it('désactive le bouton pendant le téléchargement', () => {
    renderDetail(PEDAGOGICAL_LOG_ITEM, { isDownloadingDocument: true })

    const downloadButton = screen.getByRole('button', { name: 'Téléchargement…' })
    expect(downloadButton.hasAttribute('disabled')).toBe(true)
  })

  it('refuse le carnet personnel au parent financeur, sans action possible', () => {
    renderDetail(NOTEBOOK_ENTRY_ITEM, { canAccessNotebook: false })

    expect(screen.getByText(/Ce document est réservé à l'élève/)).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Télécharger' })).toBeNull()
    expect(screen.queryByText('Idée de révision.')).toBeNull()
  })

  it('affiche le carnet personnel à qui y a droit', () => {
    renderDetail(NOTEBOOK_ENTRY_ITEM, { canAccessNotebook: true })

    expect(screen.getByText('Idée de révision.')).toBeDefined()
    expect(screen.queryByText(/Ce document est réservé à l'élève/)).toBeNull()
  })
})
