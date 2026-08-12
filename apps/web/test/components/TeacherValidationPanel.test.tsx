/**
 * Tests de TeacherValidationPanel — validation d'un formateur depuis sa fiche.
 *
 * Contrat vérifié contre la pile réelle le 2026-08-12 (compte `trsflow.rp.0811`) :
 * corps `{status, comment?}`, réponse `{id, teacherId, status, validatedBy,
 * validatorRole, comment, createdAt, updatedAt}`. Le corps précédemment envoyé
 * (`{validationStatus, rejectionReason}`) était refusé en `400`.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TeacherValidationPanel from '../../src/components/profile/TeacherValidationPanel'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/profile')

import { useAuth } from '../../src/hooks/useAuth'
import {
  fetchProfile,
  fetchTeacherValidationStatus,
  updateTeacherValidationStatus,
} from '../../src/api/profile'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchTeacherValidationStatus = vi.mocked(fetchTeacherValidationStatus)
const mockUpdateTeacherValidationStatus = vi.mocked(updateTeacherValidationStatus)
const mockFetchProfile = vi.mocked(fetchProfile)

const RP_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
  validationStatus: 'active' as const,
}

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = RP_USER) {
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

const PENDING_VALIDATION = {
  teacherId: 'teacher-1',
  status: 'pending' as const,
}

const IN_REVIEW_VALIDATION = {
  teacherId: 'teacher-1',
  status: 'in_review' as const,
  updatedAt: '2026-08-12T09:45:00.000Z',
  validatedBy: 'rp-1',
}

const APPROVED_VALIDATION = {
  teacherId: 'teacher-1',
  status: 'validated' as const,
  updatedAt: '2026-08-12T09:45:00.000Z',
  validatedBy: 'rp-1',
}

const REJECTED_VALIDATION = {
  teacherId: 'teacher-1',
  status: 'rejected' as const,
  updatedAt: '2026-08-12T09:45:00.000Z',
  validatedBy: 'rp-1',
  comment: 'Dossier incomplet',
}

function renderPanel(teacherId = 'teacher-1') {
  return render(<TeacherValidationPanel teacherId={teacherId} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchProfile.mockResolvedValue({
    userId: 'rp-1',
    administrative: { firstName: 'Camille', lastName: 'Durand' },
  } as never)
})

describe('TeacherValidationPanel', () => {
  it("ne s'affiche pas pour un rôle qui n'a pas le droit de valider", () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    const { container } = renderPanel()
    expect(container.firstChild).toBeNull()
  })

  it('affiche le chargement pendant la lecture du statut', () => {
    mockFetchTeacherValidationStatus.mockReturnValue(new Promise(() => {}))
    renderPanel()
    expect(screen.getByText('Chargement du statut…')).toBeDefined()
  })

  it("depuis « en attente », n'offre que la prise en charge — pas de décision directe", async () => {
    mockFetchTeacherValidationStatus.mockResolvedValue(PENDING_VALIDATION)
    renderPanel()

    await waitFor(() => {
      expect(screen.getByText('En attente de prise en charge')).toBeDefined()
      expect(screen.getByRole('button', { name: /prendre en charge/i })).toBeDefined()
    })

    // Transition réservée au TI : la proposer au RP produirait un 403.
    expect(screen.queryByRole('button', { name: /valider le formateur/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /refuser/i })).toBeNull()
  })

  it('envoie {status: in_review} à la prise en charge', async () => {
    mockFetchTeacherValidationStatus.mockResolvedValue(PENDING_VALIDATION)
    mockUpdateTeacherValidationStatus.mockResolvedValue(IN_REVIEW_VALIDATION)

    renderPanel()
    await screen.findByRole('button', { name: /prendre en charge/i })
    await userEvent.click(screen.getByRole('button', { name: /prendre en charge/i }))

    await waitFor(() => {
      expect(mockUpdateTeacherValidationStatus).toHaveBeenCalledWith('teacher-1', {
        status: 'in_review',
      })
    })
  })

  it('envoie {status: validated} à la validation', async () => {
    mockFetchTeacherValidationStatus.mockResolvedValue(IN_REVIEW_VALIDATION)
    mockUpdateTeacherValidationStatus.mockResolvedValue(APPROVED_VALIDATION)

    renderPanel()
    await screen.findByRole('button', { name: /valider le formateur/i })
    await userEvent.click(screen.getByRole('button', { name: /valider le formateur/i }))

    await waitFor(() => {
      expect(mockUpdateTeacherValidationStatus).toHaveBeenCalledWith('teacher-1', {
        status: 'validated',
      })
    })
  })

  it('confirme la validation à l’écran', async () => {
    mockFetchTeacherValidationStatus.mockResolvedValue(IN_REVIEW_VALIDATION)
    mockUpdateTeacherValidationStatus.mockResolvedValue(APPROVED_VALIDATION)

    renderPanel()
    await screen.findByRole('button', { name: /valider le formateur/i })
    await userEvent.click(screen.getByRole('button', { name: /valider le formateur/i }))

    await waitFor(() => {
      expect(screen.getByText('Formateur validé')).toBeDefined()
    })
  })

  it('ouvre le formulaire de refus', async () => {
    mockFetchTeacherValidationStatus.mockResolvedValue(IN_REVIEW_VALIDATION)
    renderPanel()

    await screen.findByRole('button', { name: /^refuser$/i })
    await userEvent.click(screen.getByRole('button', { name: /^refuser$/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/expliquez la raison/i)).toBeDefined()
      expect(screen.getByRole('button', { name: /confirmer le refus/i })).toBeDefined()
    })
  })

  it('envoie {status: rejected, comment} au refus', async () => {
    mockFetchTeacherValidationStatus.mockResolvedValue(IN_REVIEW_VALIDATION)
    mockUpdateTeacherValidationStatus.mockResolvedValue(REJECTED_VALIDATION)

    renderPanel()
    await screen.findByRole('button', { name: /^refuser$/i })

    await userEvent.click(screen.getByRole('button', { name: /^refuser$/i }))
    await userEvent.type(screen.getByPlaceholderText(/expliquez la raison/i), 'Dossier incomplet')
    await userEvent.click(screen.getByRole('button', { name: /confirmer le refus/i }))

    await waitFor(() => {
      expect(mockUpdateTeacherValidationStatus).toHaveBeenCalledWith('teacher-1', {
        status: 'rejected',
        comment: 'Dossier incomplet',
      })
    })
  })

  it('affiche le commentaire d’un dossier déjà refusé', async () => {
    mockFetchTeacherValidationStatus.mockResolvedValue(REJECTED_VALIDATION)
    renderPanel()

    await waitFor(() => {
      expect(screen.getByText(/dossier incomplet/i)).toBeDefined()
    })
  })

  it('affiche le badge « Validé » pour un formateur validé', async () => {
    mockFetchTeacherValidationStatus.mockResolvedValue(APPROVED_VALIDATION)
    renderPanel()

    await waitFor(() => {
      expect(screen.getByText('Validé')).toBeDefined()
    })
  })

  it("n'offre plus d'action sur un dossier déjà tranché", async () => {
    mockFetchTeacherValidationStatus.mockResolvedValue(APPROVED_VALIDATION)
    renderPanel()

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /valider le formateur/i })).toBeNull()
      expect(screen.queryByRole('button', { name: /^refuser$/i })).toBeNull()
      expect(screen.queryByRole('button', { name: /prendre en charge/i })).toBeNull()
    })
  })

  it('nomme le validateur, sans jamais montrer son identifiant technique', async () => {
    mockFetchTeacherValidationStatus.mockResolvedValue(APPROVED_VALIDATION)
    renderPanel()

    await waitFor(() => {
      expect(screen.getByText(/Camille Durand/)).toBeDefined()
    })
    // Le fragment d'UUID affiché auparavant (`validatedBy.slice(0, 8)`).
    expect(screen.queryByText(/rp-1/)).toBeNull()
  })

  it("affiche le message du serveur quand la transition est refusée", async () => {
    mockFetchTeacherValidationStatus.mockResolvedValue(IN_REVIEW_VALIDATION)
    mockUpdateTeacherValidationStatus.mockRejectedValue({
      response: {
        status: 403,
        data: {
          message:
            'Seul le technicien informatique peut sauter l’étape « en cours d’examen ».',
        },
      },
    })

    renderPanel()
    await screen.findByRole('button', { name: /valider le formateur/i })
    await userEvent.click(screen.getByRole('button', { name: /valider le formateur/i }))

    await waitFor(() => {
      expect(screen.getByText(/Seul le technicien informatique/)).toBeDefined()
    })
  })
})
