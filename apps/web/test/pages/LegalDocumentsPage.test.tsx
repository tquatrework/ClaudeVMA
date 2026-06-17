/**
 * Tests pour LegalDocumentsPage (Phase 10)
 *
 * Couvre :
 * - Affichage des documents légaux d'un utilisateur
 * - Un financeur peut signer un mandat (A_SIGNER → SIGNE)
 * - Un formateur peut signer un contrat (A_SIGNER → SIGNE)
 * - Un document déjà signé ne peut pas être re-signé (409)
 * - Un utilisateur non autorisé voit "Accès refusé" (403)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LegalDocumentsPage from '../../src/pages/LegalDocumentsPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/legal')

import { useAuth } from '../../src/hooks/useAuth'
import {
  fetchLegalDocuments,
  signLegalDocument,
} from '../../src/api/legal'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchLegalDocuments = vi.mocked(fetchLegalDocuments)
const mockSignLegalDocument = vi.mocked(signLegalDocument)

const FINANCEUR_USER = {
  id: 'owner-1',
  email: 'financeur@test.com',
  role: 'parent_financeur' as const,
  validationStatus: 'active' as const,
}

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'formateur@test.com',
  role: 'formateur' as const,
  validationStatus: 'active' as const,
}

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = FINANCEUR_USER) {
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

function renderLegalPage(ownerId = 'owner-1') {
  return render(
    <MemoryRouter initialEntries={[`/legal/${ownerId}`]}>
      <Routes>
        <Route path="/legal/:ownerId" element={<LegalDocumentsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const UNSIGNED_MANDATE = {
  id: 'doc-1',
  ownerId: 'owner-1',
  documentType: 'MANDAT_CLIENT' as const,
  status: 'A_SIGNER' as const,
  templateId: 'tmpl-1',
  templateVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const SIGNED_MANDATE = {
  ...UNSIGNED_MANDATE,
  status: 'SIGNE' as const,
  signatureRecord: {
    id: 'sig-1',
    signerName: 'Marie Dupont',
    signerEmail: 'marie@test.com',
    signedAt: '2026-01-10T10:00:00.000Z',
  },
}

const UNSIGNED_CONTRACT = {
  id: 'doc-2',
  ownerId: 'teacher-1',
  documentType: 'CONTRAT_FORMATEUR' as const,
  status: 'A_SIGNER' as const,
  templateId: 'tmpl-2',
  templateVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  // Valeur par défaut pour tous les tests
  mockFetchLegalDocuments.mockResolvedValue([])
  mockSignLegalDocument.mockResolvedValue({
    legalDocument: { ...UNSIGNED_MANDATE, status: 'SIGNE' as const },
    signatureRecord: { id: 'sig-default', signerName: 'Default', signedAt: new Date().toISOString() },
  })
})

describe('LegalDocumentsPage', () => {
  it('affiche un état de chargement initialement', () => {
    mockFetchLegalDocuments.mockReturnValue(new Promise(() => {}))

    renderLegalPage()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('affiche "Aucun document légal disponible" si la liste est vide', async () => {
    mockFetchLegalDocuments.mockResolvedValue([])

    renderLegalPage()

    await waitFor(() => {
      expect(screen.getByText('Aucun document légal disponible.')).toBeDefined()
    })
  })

  it('affiche un mandat avec le statut "À signer"', async () => {
    mockFetchLegalDocuments.mockResolvedValue([UNSIGNED_MANDATE])

    renderLegalPage()

    await waitFor(() => {
      expect(screen.getByText('Mandat client')).toBeDefined()
      expect(screen.getByText('À signer')).toBeDefined()
    })
  })

  it('le financeur peut signer son mandat', async () => {
    mockFetchLegalDocuments.mockResolvedValue([UNSIGNED_MANDATE])
    mockSignLegalDocument.mockResolvedValue({
      legalDocument: SIGNED_MANDATE,
      signatureRecord: SIGNED_MANDATE.signatureRecord,
    })

    renderLegalPage('owner-1')

    await waitFor(() => {
      screen.getByText('Signer ce document')
    })

    await userEvent.click(screen.getByText('Signer ce document'))

    await waitFor(() => {
      screen.getByPlaceholderText('Prénom Nom')
    })

    const signerNameInput = screen.getByPlaceholderText('Prénom Nom')
    await userEvent.clear(signerNameInput)
    await userEvent.type(signerNameInput, 'Marie Dupont')
    await userEvent.click(screen.getByRole('button', { name: /confirmer la signature/i }))

    await waitFor(() => {
      expect(mockSignLegalDocument).toHaveBeenCalledWith(
        UNSIGNED_MANDATE.id,
        expect.objectContaining({ signerName: 'Marie Dupont' }),
      )
    })
  })

  it('un document déjà signé affiche les données de signature', async () => {
    mockFetchLegalDocuments.mockResolvedValue([SIGNED_MANDATE])

    renderLegalPage()

    await waitFor(() => {
      expect(screen.getByText('Signé')).toBeDefined()
      expect(screen.getByText(/Marie Dupont/)).toBeDefined()
    })
  })

  it('un document déjà signé n\'affiche pas le bouton "Signer ce document"', async () => {
    mockFetchLegalDocuments.mockResolvedValue([SIGNED_MANDATE])

    renderLegalPage('owner-1')

    await waitFor(() => {
      expect(screen.queryByText('Signer ce document')).toBeNull()
    })
  })

  it('affiche une erreur 409 si le document a déjà été signé', async () => {
    mockFetchLegalDocuments.mockResolvedValue([UNSIGNED_MANDATE])
    mockSignLegalDocument.mockRejectedValue({ response: { status: 409 } })

    renderLegalPage('owner-1')

    await waitFor(() => {
      screen.getByText('Signer ce document')
    })

    await userEvent.click(screen.getByText('Signer ce document'))
    await waitFor(() => screen.getByPlaceholderText('Prénom Nom'))
    const signerInput409 = screen.getByPlaceholderText('Prénom Nom')
    await userEvent.clear(signerInput409)
    await userEvent.type(signerInput409, 'Marie Dupont')
    await userEvent.click(screen.getByRole('button', { name: /confirmer la signature/i }))

    await waitFor(() => {
      expect(screen.getByText('Ce document a déjà été signé.')).toBeDefined()
    })
  })

  it('affiche "Accès refusé" pour un 403', async () => {
    mockFetchLegalDocuments.mockRejectedValue({ response: { status: 403 } })

    renderLegalPage()

    await waitFor(() => {
      expect(screen.getByText('Accès refusé.')).toBeDefined()
    })
  })

  it('le formateur peut signer son contrat', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchLegalDocuments.mockResolvedValue([UNSIGNED_CONTRACT])
    mockSignLegalDocument.mockResolvedValue({
      legalDocument: {
        ...UNSIGNED_CONTRACT,
        status: 'SIGNE',
        signatureRecord: {
          id: 'sig-2',
          signerName: 'Jean Martin',
          signedAt: new Date().toISOString(),
        },
      },
      signatureRecord: {
        id: 'sig-2',
        signerName: 'Jean Martin',
        signedAt: new Date().toISOString(),
      },
    })

    renderLegalPage('teacher-1')

    await waitFor(() => {
      expect(screen.getByText('Contrat formateur')).toBeDefined()
      screen.getByText('Signer ce document')
    })

    await userEvent.click(screen.getByText('Signer ce document'))
    await waitFor(() => screen.getByPlaceholderText('Prénom Nom'))
    const contractSignerInput = screen.getByPlaceholderText('Prénom Nom')
    await userEvent.clear(contractSignerInput)
    await userEvent.type(contractSignerInput, 'Jean Martin')
    await userEvent.click(screen.getByRole('button', { name: /confirmer la signature/i }))

    await waitFor(() => {
      expect(mockSignLegalDocument).toHaveBeenCalledWith(
        UNSIGNED_CONTRACT.id,
        expect.objectContaining({ signerName: 'Jean Martin' }),
      )
    })
  })

  it('un utilisateur non propriétaire ne voit pas le bouton de signature', async () => {
    // L'élève tente de voir les docs d'un autre utilisateur
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchLegalDocuments.mockResolvedValue([UNSIGNED_MANDATE])

    renderLegalPage('owner-1') // owner-1 != student-1

    await waitFor(() => {
      expect(screen.queryByText('Signer ce document')).toBeNull()
    })
  })
})
