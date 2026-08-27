/**
 * Tests — SiteMetadataEditor, sections « Photo de profil » et « Pièces
 * jointes du cahier de texte » ajoutées le 2026-08-26.
 *
 * Deux services distincts derrière un seul écran d'agrégation (arbitrage du
 * 2026-08-26, point 8) : `profile-service` pour la photo,
 * `pedagogical-log-service` pour les pièces jointes — chacun mocké
 * séparément, jamais un service de configuration transverse inventé.
 *
 * Le formulaire préexistant (métadonnées du site) n'est pas retesté ici :
 * seules les deux nouvelles sections le sont.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SiteMetadataEditor from '../../src/pages/SiteMetadataEditor'
import { makeUseAuthReturn } from '../../src/test-helpers'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/profile')
vi.mock('../../src/api/pedagogicalLogAttachments')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchProfileAvatarConstraints, updateProfileAvatarSettings } from '../../src/api/profile'
import {
  fetchAttachmentSettings,
  updateAttachmentSettings,
} from '../../src/api/pedagogicalLogAttachments'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchProfileAvatarConstraints = vi.mocked(fetchProfileAvatarConstraints)
const mockUpdateProfileAvatarSettings = vi.mocked(updateProfileAvatarSettings)
const mockFetchAttachmentSettings = vi.mocked(fetchAttachmentSettings)
const mockUpdateAttachmentSettings = vi.mocked(updateAttachmentSettings)

const DEFAULT_AVATAR_CONSTRAINTS = {
  maxUploadBytes: 1_000_000,
  acceptedContentTypes: ['image/jpeg'],
  outputContentType: 'image/webp',
  maxDimensionPixels: 512,
}

const DEFAULT_ATTACHMENT_SETTINGS = {
  id: 'settings-1',
  attachmentsEnabled: true,
  maxFileBytes: 100_000,
  maxTotalBytesPerEntry: 5_000_000,
  updatedAt: '2026-08-26T00:00:00.000Z',
}

function asTi() {
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: 'ti-1', role: 'technicien_informatique' }))
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SiteMetadataEditor />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  asTi()
  mockFetchProfileAvatarConstraints.mockResolvedValue(DEFAULT_AVATAR_CONSTRAINTS)
  mockFetchAttachmentSettings.mockResolvedValue(DEFAULT_ATTACHMENT_SETTINGS)
})

describe('SiteMetadataEditor — accès réservé au TI', () => {
  it('un rôle autre que TI ne voit ni les métadonnées ni les nouvelles sections', () => {
    mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: 'rp-1', role: 'responsable_pedagogique' }))

    renderPage()

    expect(screen.getByText(/réservé aux techniciens informatiques/i)).toBeDefined()
    expect(screen.queryByText('Photo de profil')).toBeNull()
  })
})

describe('SiteMetadataEditor — section Photo de profil', () => {
  it('affiche la valeur actuelle lue au serveur', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/1 Mo/)).toBeDefined()
    })
    expect(mockFetchProfileAvatarConstraints).toHaveBeenCalledTimes(1)
  })

  it('sauvegarde et réaffiche la valeur RELUE en base, pas le corps envoyé', async () => {
    mockUpdateProfileAvatarSettings.mockResolvedValue({
      maxAvatarUploadBytes: 2_000_000,
      updatedAt: '2026-08-26T10:00:00.000Z',
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByLabelText(/nouvelle taille maximale/i)).toBeDefined()
    })

    const input = screen.getByLabelText(/nouvelle taille maximale/i) as HTMLInputElement
    await userEvent.clear(input)
    await userEvent.type(input, '2000')

    // Trois boutons « Sauvegarder » sur l'écran (métadonnées, photo, pièces jointes) :
    // celui de la section photo est le deuxième dans l'ordre du DOM.
    const submitButtons = screen.getAllByRole('button', { name: /sauvegarder/i })
    await userEvent.click(submitButtons[1])

    await waitFor(() => {
      expect(mockUpdateProfileAvatarSettings).toHaveBeenCalledWith({ maxAvatarUploadBytes: 2_000_000 })
    })
    await waitFor(() => {
      expect(screen.getByText(/2 Mo/)).toBeDefined()
    })
  })

  it('refuse localement une valeur hors bornes, sans appeler le serveur', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByLabelText(/nouvelle taille maximale/i)).toBeDefined()
    })

    const input = screen.getByLabelText(/nouvelle taille maximale/i) as HTMLInputElement
    await userEvent.clear(input)
    await userEvent.type(input, '99999')

    // Trois boutons « Sauvegarder » sur l'écran (métadonnées, photo, pièces jointes) :
    // celui de la section photo est le deuxième dans l'ordre du DOM.
    const submitButtons = screen.getAllByRole('button', { name: /sauvegarder/i })
    await userEvent.click(submitButtons[1])

    await waitFor(() => {
      expect(screen.getByText(/comprise entre/i)).toBeDefined()
    })
    expect(mockUpdateProfileAvatarSettings).not.toHaveBeenCalled()
  })

  it('erreur de chargement affichée', async () => {
    // Statut hors de la table de traduction générique (`apiError.ts`) pour
    // vérifier que le message de repli propre à ce hook est bien utilisé.
    mockFetchProfileAvatarConstraints.mockRejectedValue({ response: { status: 418 } })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/impossible de lire le plafond actuel/i)).toBeDefined()
    })
  })
})

describe('SiteMetadataEditor — section Pièces jointes du cahier de texte', () => {
  it('affiche les réglages actuels', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/100 Ko par fichier/)).toBeDefined()
    })
    expect(screen.getByText(/5 Mo par entrée/)).toBeDefined()
  })

  it('mise à jour partielle — seul le champ modifié est envoyé', async () => {
    mockUpdateAttachmentSettings.mockResolvedValue({
      ...DEFAULT_ATTACHMENT_SETTINGS,
      attachmentsEnabled: false,
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByLabelText(/autoriser les pièces jointes/i)).toBeDefined()
    })

    await userEvent.click(screen.getByLabelText(/autoriser les pièces jointes/i))

    const submitButtons = screen.getAllByRole('button', { name: /sauvegarder/i })
    await userEvent.click(submitButtons[submitButtons.length - 1])

    await waitFor(() => {
      expect(mockUpdateAttachmentSettings).toHaveBeenCalledWith({ attachmentsEnabled: false })
    })
  })

  it("affiche le message d'erreur serveur pour un plafond par fichier supérieur au plafond total", async () => {
    mockUpdateAttachmentSettings.mockRejectedValue({
      response: { status: 400, data: { message: 'Le plafond par fichier ne peut pas dépasser le plafond total.' } },
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByLabelText(/plafond par fichier/i)).toBeDefined()
    })

    const maxFileInput = screen.getByLabelText(/plafond par fichier/i) as HTMLInputElement
    await userEvent.clear(maxFileInput)
    await userEvent.type(maxFileInput, '999999')

    const submitButtons = screen.getAllByRole('button', { name: /sauvegarder/i })
    await userEvent.click(submitButtons[submitButtons.length - 1])

    await waitFor(() => {
      expect(screen.getByText(/ne peut pas dépasser le plafond total/i)).toBeDefined()
    })
  })
})
