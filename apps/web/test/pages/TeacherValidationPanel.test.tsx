/**
 * Tests for TeacherValidationPanel
 *
 * Covers:
 * - RP can view validation status via GET /profiles/:teacherId/validation
 * - RP can approve a teacher via PATCH /profiles/:teacherId/validation
 * - RP can reject a teacher with a reason via PATCH /profiles/:teacherId/validation
 * - Non-RP users do not see the panel
 * - Shows rejection reason if already rejected
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TeacherValidationPanel from '../../src/pages/TeacherValidationPanel'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

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
      (['responsable_pedagogique', 'animateur_pedagogique', 'technicien_informatique', 'administrateur_financier'] as string[]).includes(userObj.role),
    ),
  }
}

const PENDING_VALIDATION = {
  teacherId: 'teacher-1',
  validationStatus: 'pending' as const,
}

const APPROVED_VALIDATION = {
  teacherId: 'teacher-1',
  validationStatus: 'approved' as const,
  validatedAt: new Date().toISOString(),
  validatedBy: 'rp-1',
}

const REJECTED_VALIDATION = {
  teacherId: 'teacher-1',
  validationStatus: 'rejected' as const,
  validatedAt: new Date().toISOString(),
  validatedBy: 'rp-1',
  rejectionReason: 'Dossier incomplet',
}

function renderPanel(teacherId = 'teacher-1') {
  return render(<TeacherValidationPanel teacherId={teacherId} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('TeacherValidationPanel', () => {
  it('does not render anything for non-RP roles', () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    const { container } = renderPanel()
    expect(container.firstChild).toBeNull()
  })

  it('shows loading state while fetching validation status', () => {
    mockApiClient.get = vi.fn().mockReturnValue(new Promise(() => {}))
    renderPanel()
    expect(screen.getByText('Chargement du statut…')).toBeDefined()
  })

  it('shows pending status and action buttons for RP', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: PENDING_VALIDATION })
    renderPanel()

    await waitFor(() => {
      expect(screen.getByText('En attente')).toBeDefined()
      expect(screen.getByRole('button', { name: /valider le formateur/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /rejeter/i })).toBeDefined()
    })
  })

  it('calls PATCH /profiles/:teacherId/validation with approved on approve click', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: PENDING_VALIDATION })
    mockApiClient.patch = vi.fn().mockResolvedValue({ data: APPROVED_VALIDATION })

    renderPanel()

    await waitFor(() => {
      screen.getByRole('button', { name: /valider le formateur/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /valider le formateur/i }))

    await waitFor(() => {
      expect(mockApiClient.patch).toHaveBeenCalledWith(
        '/profiles/teacher-1/validation',
        { validationStatus: 'approved' },
      )
    })
  })

  it('shows success message after approval', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: PENDING_VALIDATION })
    mockApiClient.patch = vi.fn().mockResolvedValue({ data: APPROVED_VALIDATION })

    renderPanel()

    await waitFor(() => {
      screen.getByRole('button', { name: /valider le formateur/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /valider le formateur/i }))

    await waitFor(() => {
      expect(screen.getByText('Formateur validé avec succès')).toBeDefined()
    })
  })

  it('shows rejection form when "Rejeter" is clicked', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: PENDING_VALIDATION })
    renderPanel()

    await waitFor(() => {
      screen.getByRole('button', { name: /rejeter/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /rejeter/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/expliquez la raison/i)).toBeDefined()
      expect(screen.getByRole('button', { name: /confirmer le rejet/i })).toBeDefined()
    })
  })

  it('calls PATCH with rejected status and reason on rejection form submit', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: PENDING_VALIDATION })
    mockApiClient.patch = vi.fn().mockResolvedValue({ data: REJECTED_VALIDATION })

    renderPanel()

    await waitFor(() => {
      screen.getByRole('button', { name: /rejeter/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /rejeter/i }))
    await userEvent.type(screen.getByPlaceholderText(/expliquez la raison/i), 'Dossier incomplet')
    await userEvent.click(screen.getByRole('button', { name: /confirmer le rejet/i }))

    await waitFor(() => {
      expect(mockApiClient.patch).toHaveBeenCalledWith(
        '/profiles/teacher-1/validation',
        { validationStatus: 'rejected', rejectionReason: 'Dossier incomplet' },
      )
    })
  })

  it('shows the rejection reason for an already-rejected teacher', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: REJECTED_VALIDATION })
    renderPanel()

    await waitFor(() => {
      expect(screen.getByText(/dossier incomplet/i)).toBeDefined()
    })
  })

  it('shows "Validé" badge for an approved teacher', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: APPROVED_VALIDATION })
    renderPanel()

    await waitFor(() => {
      expect(screen.getByText('Validé')).toBeDefined()
    })
  })

  it('hides action buttons for already-approved teacher', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: APPROVED_VALIDATION })
    renderPanel()

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /valider le formateur/i })).toBeNull()
      expect(screen.queryByRole('button', { name: /rejeter/i })).toBeNull()
    })
  })
})
