/**
 * Tests pour LegalTemplateAdminPage (Phase 10)
 *
 * Couvre :
 * - Redirection vers /forbidden pour les non-AF (LDS-BR-001)
 * - L'AF peut créer un nouveau modèle
 * - L'AF peut modifier un modèle existant (la version est incrémentée côté backend)
 * - Affichage des modèles existants
 * - "Aucun modèle" si la liste est vide
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LegalTemplateAdminPage from '../../src/pages/LegalTemplateAdminPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/legal')

import { useAuth } from '../../src/hooks/useAuth'
import { createLegalTemplate, fetchLegalTemplates, updateLegalTemplate } from '../../src/api/legal'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchLegalTemplates = vi.mocked(fetchLegalTemplates)
const mockCreateLegalTemplate = vi.mocked(createLegalTemplate)
const mockUpdateLegalTemplate = vi.mocked(updateLegalTemplate)

const AF_USER = {
  id: 'af-1',
  email: 'af@test.com',
  role: 'administrateur_financier' as const,
  validationStatus: 'active' as const,
}

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = AF_USER) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() =>
      (['responsable_pedagogique', 'animateur_pedagogique', 'technicien_informatique', 'administrateur_financier'] as string[]).includes(userObj.role),
    ),
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/legal/templates']}>
      <Routes>
        <Route path="/legal/templates" element={<LegalTemplateAdminPage />} />
        <Route path="/forbidden" element={<div>Accès interdit</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const SAMPLE_TEMPLATE = {
  id: 'tmpl-1',
  title: 'Mandat client 2026',
  documentType: 'MANDAT_CLIENT' as const,
  version: 1,
  content: 'Contenu du mandat client…',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchLegalTemplates.mockResolvedValue([])
  mockCreateLegalTemplate.mockResolvedValue({ ...SAMPLE_TEMPLATE, id: 'tmpl-new' })
  mockUpdateLegalTemplate.mockResolvedValue({ ...SAMPLE_TEMPLATE, version: 2 })
})

describe('LegalTemplateAdminPage', () => {
  it('redirige vers /forbidden pour un non-AF', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Accès interdit')).toBeDefined()
    })
  })

  it('affiche l\'en-tête pour un AF', async () => {
    renderPage()

    await waitFor(() => {
      // Le titre "Modèles légaux" peut apparaître à la fois dans le rail de navigation
      // et dans le h1 de la page — on vérifie qu'au moins un élément existe.
      const headingElements = screen.getAllByText('Modèles légaux')
      expect(headingElements.length).toBeGreaterThan(0)
    })
  })

  it('affiche "Aucun modèle légal disponible" si la liste est vide', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Aucun modèle légal disponible.')).toBeDefined()
    })
  })

  it('affiche les modèles existants', async () => {
    mockFetchLegalTemplates.mockResolvedValue([SAMPLE_TEMPLATE])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Mandat client 2026')).toBeDefined()
      expect(screen.getByText(/Version 1/)).toBeDefined()
    })
  })

  it('l\'AF peut créer un nouveau modèle', async () => {
    mockCreateLegalTemplate.mockResolvedValue({
      ...SAMPLE_TEMPLATE,
      id: 'tmpl-new',
      title: 'Contrat formateur 2026',
      documentType: 'CONTRAT_FORMATEUR' as const,
    })

    renderPage()

    await waitFor(() => {
      screen.getByText('Nouveau modèle')
    })

    await userEvent.click(screen.getByText('Nouveau modèle'))

    await waitFor(() => {
      screen.getByText('Créer un nouveau modèle')
    })

    await userEvent.type(
      screen.getByPlaceholderText(/mandat client standard/i),
      'Contrat formateur 2026',
    )

    await userEvent.type(
      screen.getByPlaceholderText(/texte complet/i),
      'Le présent contrat de formateur…',
    )

    await userEvent.click(screen.getByRole('button', { name: /créer le modèle/i }))

    await waitFor(() => {
      expect(mockCreateLegalTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Contrat formateur 2026' }),
      )
    })
  })

  it('l\'AF peut modifier un modèle existant', async () => {
    mockFetchLegalTemplates.mockResolvedValue([SAMPLE_TEMPLATE])
    mockUpdateLegalTemplate.mockResolvedValue({ ...SAMPLE_TEMPLATE, version: 2 })

    renderPage()

    await waitFor(() => {
      screen.getByText('Mandat client 2026')
    })

    await userEvent.click(screen.getByText('Modifier'))

    await waitFor(() => {
      screen.getByText('Modifier le modèle')
    })

    await userEvent.click(screen.getByRole('button', { name: /enregistrer les modifications/i }))

    await waitFor(() => {
      expect(mockUpdateLegalTemplate).toHaveBeenCalledWith(
        SAMPLE_TEMPLATE.id,
        expect.any(Object),
      )
    })
  })

  it('affiche une erreur si le chargement des modèles échoue', async () => {
    mockFetchLegalTemplates.mockRejectedValue({ response: { status: 500 } })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Le serveur rencontre un problème. Veuillez réessayer plus tard.')).toBeDefined()
    })
  })

  it('affiche le succès après création d\'un modèle', async () => {
    mockCreateLegalTemplate.mockResolvedValue({ ...SAMPLE_TEMPLATE, id: 'tmpl-new', title: 'Nouveau modèle test' })

    renderPage()

    await waitFor(() => screen.getByText('Nouveau modèle'))
    await userEvent.click(screen.getByText('Nouveau modèle'))

    await waitFor(() => screen.getByPlaceholderText(/mandat client standard/i))
    await userEvent.type(screen.getByPlaceholderText(/mandat client standard/i), 'Nouveau modèle test')
    await userEvent.type(screen.getByPlaceholderText(/texte complet/i), 'Contenu du modèle test')
    await userEvent.click(screen.getByRole('button', { name: /créer le modèle/i }))

    await waitFor(() => {
      expect(screen.getByText('Modèle légal créé avec succès.')).toBeDefined()
    })
  })
})
