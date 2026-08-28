/**
 * Tests pour SiteMetadataEditor (Phase 15)
 *
 * Couvre :
 * - L'éditeur de métadonnées sauvegarde les champs autorisés
 * - Un utilisateur sans rôle TI voit un message d'accès refusé
 * - Erreur de sauvegarde (403)
 * - Le mode maintenance affiche le champ message supplémentaire
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/adminObservability')
// Sections « Photo de profil », « Pièces jointes » (2026-08-26) et « Accès au
// carnet personnel » (2026-08-28) : appellent leurs propres services
// (profile-service, pedagogical-log-service). Mockées ici pour que ce
// fichier, qui ne teste que le formulaire de métadonnées préexistant, ne
// dépende jamais d'un appel réseau réel.
vi.mock('../../../src/api/profile')
vi.mock('../../../src/api/pedagogicalLogAttachments')
vi.mock('../../../src/api/pedagogicalLogNotebookAccess')

import { useAuth } from '../../../src/hooks/useAuth'
import { updateSiteMetadata } from '../../../src/api/adminObservability'
import { fetchProfileAvatarConstraints } from '../../../src/api/profile'
import { fetchAttachmentSettings } from '../../../src/api/pedagogicalLogAttachments'
import { fetchNotebookAccessSettings } from '../../../src/api/pedagogicalLogNotebookAccess'
import SiteMetadataEditor from '../../../src/pages/SiteMetadataEditor'
import type { SiteMetadata } from '../../../src/api/adminObservability'

const mockUseAuth = vi.mocked(useAuth)
const mockUpdateSiteMetadata = vi.mocked(updateSiteMetadata)
const mockFetchProfileAvatarConstraints = vi.mocked(fetchProfileAvatarConstraints)
const mockFetchAttachmentSettings = vi.mocked(fetchAttachmentSettings)
const mockFetchNotebookAccessSettings = vi.mocked(fetchNotebookAccessSettings)

/**
 * Le bouton « Sauvegarder » du formulaire de métadonnées n'est plus le seul
 * de l'écran depuis le 2026-08-26 (sections « Photo de profil » et « Pièces
 * jointes », chacune son propre formulaire). On le retrouve en le scopant au
 * `<form>` qui porte le champ « Nom du site », propre à ce formulaire-ci.
 */
function getSiteMetadataSaveButton(): HTMLElement {
  const form = screen.getByLabelText(/Nom du site/i).closest('form') as HTMLElement
  return within(form).getByRole('button', { name: /Sauvegarder/i })
}

// ─── Fixtures utilisateurs ────────────────────────────────────────────────────

const TI_USER = {
  id: 'ti-1',
  email: 'ti@test.com',
  role: 'technicien_informatique' as const,
  validationStatus: 'active' as const,
}

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = TI_USER) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() =>
      (
        [
          'responsable_pedagogique',
          'animateur_pedagogique',
          'technicien_informatique',
          'administrateur_financier',
        ] as string[]
      ).includes(userObj.role),
    ),
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const UPDATED_METADATA: SiteMetadata = {
  id: 'site-config',
  siteName: 'VisioMath Pro',
  contactEmail: 'support@visiomaths.fr',
  isMaintenanceMode: false,
  updatedAt: '2026-06-18T10:00:00Z',
  updatedBy: 'ti-1',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SiteMetadataEditor />
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockUpdateSiteMetadata.mockResolvedValue(UPDATED_METADATA)
  mockFetchProfileAvatarConstraints.mockResolvedValue({
    maxUploadBytes: 1_000_000,
    acceptedContentTypes: ['image/jpeg'],
    outputContentType: 'image/webp',
    maxDimensionPixels: 512,
  })
  mockFetchAttachmentSettings.mockResolvedValue({
    id: 'settings-1',
    attachmentsEnabled: true,
    maxFileBytes: 100_000,
    maxTotalBytesPerEntry: 5_000_000,
    updatedAt: '2026-08-26T00:00:00.000Z',
  })
  mockFetchNotebookAccessSettings.mockResolvedValue({
    id: 'notebook-access-1',
    adminAccess: 'none',
    parentAccessToOwnChild: false,
    updatedAt: '2026-08-28T00:00:00.000Z',
  })
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SiteMetadataEditor', () => {
  it('affiche le formulaire de métadonnées pour le TI', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Métadonnées du site')).toBeDefined()
      expect(screen.getByLabelText(/Nom du site/i)).toBeDefined()
      expect(screen.getByLabelText(/Email de contact/i)).toBeDefined()
    })
  })

  it('l\'éditeur sauvegarde les champs autorisés', async () => {
    renderPage()

    await userEvent.type(screen.getByLabelText(/Nom du site/i), 'VisioMath Pro')
    await userEvent.type(screen.getByLabelText(/Email de contact/i), 'support@visiomaths.fr')

    await userEvent.click(getSiteMetadataSaveButton())

    await waitFor(() => {
      expect(mockUpdateSiteMetadata).toHaveBeenCalledWith(
        'site-config',
        expect.objectContaining({
          siteName: 'VisioMath Pro',
          contactEmail: 'support@visiomaths.fr',
        }),
      )
    })
  })

  it('affiche une confirmation de succès après sauvegarde', async () => {
    renderPage()

    await userEvent.click(getSiteMetadataSaveButton())

    await waitFor(() => {
      expect(screen.getByText(/Métadonnées sauvegardées avec succès/i)).toBeDefined()
    })
  })

  it('affiche le champ message de maintenance quand le mode maintenance est activé', async () => {
    renderPage()

    const maintenanceCheckbox = screen.getByLabelText(/Activer le mode maintenance/i)
    await userEvent.click(maintenanceCheckbox)

    await waitFor(() => {
      expect(screen.getByLabelText(/Message de maintenance/i)).toBeDefined()
    })
  })

  it('affiche un message d\'erreur 403 si non autorisé', async () => {
    mockUpdateSiteMetadata.mockRejectedValue({ response: { status: 403 } })
    renderPage()

    await userEvent.click(getSiteMetadataSaveButton())

    await waitFor(() => {
      expect(screen.getByText(/Vous n'êtes pas autorisé à modifier les métadonnées/i)).toBeDefined()
    })
  })

  it('affiche un message d\'accès refusé pour un élève', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Accès réservé aux techniciens informatiques/i)).toBeDefined()
    })
  })
})
