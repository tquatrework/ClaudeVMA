/**
 * Tests pour WorkflowRetryPanel (Phase 16)
 *
 * Couvre :
 * - Affichage du formulaire pour un admin
 * - Accès refusé pour un élève
 * - Dispatch réussi d'une commande idempotente
 * - Erreur 409 (clé d'idempotence déjà utilisée)
 * - Erreur si le payload JSON est invalide
 * - Le bouton "Dispatcher" est désactivé si les champs obligatoires sont vides
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/orchestration')

import { useAuth } from '../../../src/hooks/useAuth'
import { dispatchCommand } from '../../../src/api/orchestration'
import WorkflowRetryPanel from '../../../src/pages/WorkflowRetryPanel'

const mockUseAuth = vi.mocked(useAuth)
const mockDispatchCommand = vi.mocked(dispatchCommand)

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

function renderPage() {
  return render(
    <MemoryRouter>
      <WorkflowRetryPanel />
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockDispatchCommand.mockResolvedValue({ message: 'Commande dispatchée.' })
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorkflowRetryPanel', () => {
  it('affiche le formulaire pour un TI', () => {
    renderPage()
    expect(screen.getByText('Commandes manuelles')).toBeDefined()
    expect(screen.getByLabelText(/service cible/i)).toBeDefined()
    expect(screen.getByLabelText(/action/i)).toBeDefined()
    expect(screen.getByLabelText(/payload/i)).toBeDefined()
    expect(screen.getByLabelText(/clé d'idempotence/i)).toBeDefined()
  })

  it('un élève voit un message d\'accès refusé', () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()
    expect(screen.getByText(/Accès réservé aux techniciens informatiques/)).toBeDefined()
  })

  it('le bouton "Dispatcher" est désactivé si les champs obligatoires sont vides', () => {
    renderPage()
    const submitButton = screen.getByRole('button', { name: /dispatcher la commande/i })
    expect(submitButton).toBeDefined()
    // Le bouton doit être disabled car targetService et action sont vides
    expect((submitButton as HTMLButtonElement).disabled).toBe(true)
  })

  it('dispatch une commande avec succès', async () => {
    renderPage()

    await userEvent.selectOptions(
      screen.getByLabelText(/service cible/i),
      'identity-access-service',
    )
    await userEvent.clear(screen.getByLabelText(/action/i))
    await userEvent.type(screen.getByLabelText(/action/i), 'create-account')

    await userEvent.click(screen.getByRole('button', { name: /dispatcher la commande/i }))

    await waitFor(() => {
      expect(mockDispatchCommand).toHaveBeenCalledOnce()
      expect(screen.getByText(/Commande "create-account" dispatchée vers identity-access-service/)).toBeDefined()
    })
  })

  it('affiche une erreur 409 si la clé d\'idempotence est déjà utilisée', async () => {
    const conflictError = { response: { status: 409 } }
    mockDispatchCommand.mockRejectedValue(conflictError)

    renderPage()

    await userEvent.selectOptions(
      screen.getByLabelText(/service cible/i),
      'profile-service',
    )
    await userEvent.clear(screen.getByLabelText(/action/i))
    await userEvent.type(screen.getByLabelText(/action/i), 'create-student-profiles')

    await userEvent.click(screen.getByRole('button', { name: /dispatcher la commande/i }))

    await waitFor(() => {
      expect(screen.getByText(/clé d'idempotence a déjà été utilisée/)).toBeDefined()
    })
  })

  it('affiche une erreur si le payload JSON est invalide', async () => {
    renderPage()

    await userEvent.selectOptions(
      screen.getByLabelText(/service cible/i),
      'profile-service',
    )
    await userEvent.clear(screen.getByLabelText(/action/i))
    await userEvent.type(screen.getByLabelText(/action/i), 'some-action')

    const payloadInput = screen.getByLabelText(/payload/i)
    // fireEvent.change permet de saisir du texte contenant des accolades sans déclencher le parsing des touches spéciales de userEvent
    fireEvent.change(payloadInput, { target: { value: 'not valid json {{' } })

    await userEvent.click(screen.getByRole('button', { name: /dispatcher la commande/i }))

    await waitFor(() => {
      expect(screen.getByText(/Le payload doit être un JSON valide/)).toBeDefined()
    })
  })

  it('le bouton "Regénérer" génère une nouvelle clé d\'idempotence', async () => {
    renderPage()

    const initialKey = (screen.getByLabelText(/clé d'idempotence/i) as HTMLInputElement).value
    await userEvent.click(screen.getByRole('button', { name: /regénérer/i }))

    const newKey = (screen.getByLabelText(/clé d'idempotence/i) as HTMLInputElement).value
    expect(newKey).not.toBe(initialKey)
  })
})
