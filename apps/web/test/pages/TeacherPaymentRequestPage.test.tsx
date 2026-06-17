/**
 * Tests pour TeacherPaymentRequestPage (Phase 9)
 *
 * Couvre :
 * - Le formateur voit le bouton "Nouvelle demande" et peut soumettre
 * - L'AF voit le bouton "Valider" sur les demandes en attente
 * - Soumission d'une demande avec description et montant
 * - L'AF valide une demande via POST /teacher-payment-requests/:id/validate
 * - Affichage des statuts (pending, validated)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TeacherPaymentRequestPage from '../../src/pages/TeacherPaymentRequestPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'formateur@test.com',
  role: 'formateur' as const,
  validationStatus: 'active' as const,
}

const AF_USER = {
  id: 'af-1',
  email: 'af@test.com',
  role: 'administrateur_financier' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = TEACHER_USER) {
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
    <MemoryRouter initialEntries={['/teacher-payment-requests']}>
      <Routes>
        <Route path="/teacher-payment-requests" element={<TeacherPaymentRequestPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const PENDING_REQUEST = {
  id: 'req-1',
  teacherId: 'teacher-1',
  amountCents: 5000,
  description: 'Cours particulier 2h',
  invoiceReference: 'FACT-001',
  status: 'pending' as const,
  createdAt: '2026-06-01T10:00:00.000Z',
}

const VALIDATED_REQUEST = {
  ...PENDING_REQUEST,
  id: 'req-2',
  status: 'validated' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('TeacherPaymentRequestPage', () => {
  it('le formateur voit le bouton "Nouvelle demande"', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Nouvelle demande')).toBeDefined()
    })
  })

  it('affiche "Aucune demande de paiement" si la liste est vide', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Aucune demande de paiement.')).toBeDefined()
    })
  })

  it('affiche les demandes existantes avec leur statut', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({
      data: [PENDING_REQUEST, VALIDATED_REQUEST],
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getAllByText('Cours particulier 2h').length).toBeGreaterThan(0)
      expect(screen.getAllByText('En attente').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Validée').length).toBeGreaterThan(0)
    })
  })

  it('le formateur peut soumettre une nouvelle demande', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
    mockApiClient.post = vi.fn().mockResolvedValue({
      data: {
        ...PENDING_REQUEST,
        id: 'req-new',
        description: 'Cours de maths avancé',
        amountCents: 7500,
      },
    })

    renderPage()

    await waitFor(() => {
      screen.getByText('Nouvelle demande')
    })

    await userEvent.click(screen.getByText('Nouvelle demande'))

    await waitFor(() => {
      screen.getByPlaceholderText(/décrivez la prestation/i)
    })

    await userEvent.type(
      screen.getByPlaceholderText(/décrivez la prestation/i),
      'Cours de maths avancé',
    )

    // Modifier le montant
    const amountInput = screen.getByRole('spinbutton') as HTMLInputElement
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '7500')

    await userEvent.click(screen.getByRole('button', { name: /soumettre la demande/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/teacher-payment-requests',
        expect.objectContaining({ description: 'Cours de maths avancé' }),
      )
    })
  })

  it('l\'AF voit le bouton "Valider" sur les demandes en attente', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(AF_USER))
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [PENDING_REQUEST] })

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /valider/i })).toBeDefined()
    })
  })

  it('l\'AF valide une demande via POST /validate', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(AF_USER))
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [PENDING_REQUEST] })
    mockApiClient.post = vi.fn().mockResolvedValue({
      data: { ...PENDING_REQUEST, status: 'validated' },
    })

    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /valider/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /valider/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/teacher-payment-requests/${PENDING_REQUEST.id}/validate`,
      )
    })
  })

  it('l\'AF ne voit pas le bouton "Nouvelle demande"', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(AF_USER))
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderPage()

    await waitFor(() => {
      // L'AF peut voir la page mais pas le bouton de nouvelle demande formateur
      expect(screen.queryByText('Nouvelle demande')).toBeNull()
    })
  })
})
