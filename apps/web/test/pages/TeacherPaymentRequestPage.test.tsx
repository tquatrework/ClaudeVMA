/**
 * Tests pour TeacherPaymentRequestPage (Phase 9)
 *
 * Couvre :
 * - Le formateur voit le bouton "Nouvelle demande" et peut soumettre
 * - Le formateur charge ses propres demandes via by-teacher/:teacherId (son propre id)
 * - Soumission d'une demande avec description et montant
 * - Affichage des statuts (pending, validated)
 * - Chargement, erreur de chargement, erreur de soumission
 * - L'AF ne déclenche aucun appel réseau de liste et voit un état "indisponible" explicite
 *   (il n'existe aucun endpoint de liste globale côté backend — cf. src/api/finance.ts)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TeacherPaymentRequestPage from '../../src/pages/TeacherPaymentRequestPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/finance')

import { useAuth } from '../../src/hooks/useAuth'
import {
  fetchTeacherPaymentRequests,
  createTeacherPaymentRequest,
  validateTeacherPaymentRequest,
} from '../../src/api/finance'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchTeacherPaymentRequests = vi.mocked(fetchTeacherPaymentRequests)
const mockCreateTeacherPaymentRequest = vi.mocked(createTeacherPaymentRequest)
const mockValidateTeacherPaymentRequest = vi.mocked(validateTeacherPaymentRequest)

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
    mockFetchTeacherPaymentRequests.mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Nouvelle demande')).toBeDefined()
    })
  })

  it('le formateur charge ses propres demandes via by-teacher/:teacherId (son propre id)', async () => {
    mockFetchTeacherPaymentRequests.mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(mockFetchTeacherPaymentRequests).toHaveBeenCalledWith(TEACHER_USER.id)
    })
  })

  it('affiche le chargement puis "Aucune demande de paiement" si la liste est vide', async () => {
    mockFetchTeacherPaymentRequests.mockResolvedValue([])

    renderPage()

    expect(screen.getByText('Chargement…')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('Aucune demande de paiement.')).toBeDefined()
    })
  })

  it('affiche une erreur si le chargement des demandes échoue', async () => {
    mockFetchTeacherPaymentRequests.mockRejectedValue({ response: { status: 500 } })

    renderPage()

    await waitFor(() => {
      expect(
        screen.getByText('Le serveur rencontre un problème. Veuillez réessayer plus tard.'),
      ).toBeDefined()
    })
  })

  it('affiche les demandes existantes avec leur statut', async () => {
    mockFetchTeacherPaymentRequests.mockResolvedValue([PENDING_REQUEST, VALIDATED_REQUEST])

    renderPage()

    await waitFor(() => {
      expect(screen.getAllByText('Cours particulier 2h').length).toBeGreaterThan(0)
      expect(screen.getAllByText('En attente').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Validée').length).toBeGreaterThan(0)
    })
  })

  it('le formateur peut soumettre une nouvelle demande', async () => {
    mockFetchTeacherPaymentRequests.mockResolvedValue([])
    mockCreateTeacherPaymentRequest.mockResolvedValue({
      ...PENDING_REQUEST,
      id: 'req-new',
      description: 'Cours de maths avancé',
      amountCents: 7500,
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
      expect(mockCreateTeacherPaymentRequest).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Cours de maths avancé' }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Demande soumise avec succès.')).toBeDefined()
    })
  })

  it('affiche une erreur si la soumission de la demande échoue', async () => {
    mockFetchTeacherPaymentRequests.mockResolvedValue([])
    mockCreateTeacherPaymentRequest.mockRejectedValue({ response: { status: 400 } })

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

    const amountInput = screen.getByRole('spinbutton') as HTMLInputElement
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '7500')

    await userEvent.click(screen.getByRole('button', { name: /soumettre la demande/i }))

    await waitFor(() => {
      expect(
        screen.getByText("La demande n'a pas pu être traitée. Vérifiez les informations saisies."),
      ).toBeDefined()
    })

    // Le formulaire reste ouvert en cas d'échec
    expect(screen.getByText('Nouvelle demande de paiement')).toBeDefined()
  })

  it('l\'AF ne déclenche aucun appel réseau et voit un état "indisponible" au lieu d\'une liste vide', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(AF_USER))

    renderPage()

    await waitFor(() => {
      expect(
        screen.getByText(/nécessite un endpoint backend de liste globale/i),
      ).toBeDefined()
    })

    // Aucun appel réseau : il n'existe aucun endpoint de liste globale côté backend, on ne
    // simule pas une liste vide qui masquerait le vrai problème.
    expect(mockFetchTeacherPaymentRequests).not.toHaveBeenCalled()

    // Sans liste, aucun bouton "Valider" ne peut être affiché
    expect(screen.queryByRole('button', { name: /valider/i })).toBeNull()
  })

  it('l\'AF ne voit pas le bouton "Nouvelle demande"', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(AF_USER))

    renderPage()

    await waitFor(() => {
      // L'AF peut voir la page mais pas le bouton de nouvelle demande formateur
      expect(screen.queryByText('Nouvelle demande')).toBeNull()
    })
  })
})
