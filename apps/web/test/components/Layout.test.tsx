/**
 * Layout — bannière de statut de validation formateur (profile-service).
 *
 * Arbitrage du 2026-08-13 (`docs/architecture.md` > « Visibilité du statut de
 * validation, côté formateur ») : un formateur voit désormais son propre
 * statut de validation, distinct de `user.validationStatus` (statut du
 * COMPTE, déjà couvert par la bannière consentement existante).
 *
 * Contrat vérifié contre la pile réelle le 2026-08-13 : un formateur qui lit
 * `GET /profiles/:teacherId/validation` sur sa propre ligne reçoit `200`
 * (pas `403`) — même route et même forme de réponse que `TeacherValidationPanel`.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Layout from '../../src/components/Layout'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/profile')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchTeacherValidationStatus } from '../../src/api/profile'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchTeacherValidationStatus = vi.mocked(fetchTeacherValidationStatus)

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'prof@test.com',
  role: 'formateur' as const,
  loginIdentifier: 'jean.dupont',
  validationStatus: 'active' as const,
}

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  loginIdentifier: 'marie.durand',
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj: typeof TEACHER_USER | typeof STUDENT_USER | null) {
  return {
    user: userObj,
    isAuthenticated: userObj !== null,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => (userObj ? roles.includes(userObj.role) : false)),
    isInternalRole: vi.fn(() => false),
  }
}

function renderLayout() {
  return render(
    <MemoryRouter>
      <Layout>
        <div>contenu de page</div>
      </Layout>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Layout — statut de validation formateur', () => {
  it('affiche « En attente de validation » pour un formateur dont le dossier est pending', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchTeacherValidationStatus.mockResolvedValue({
      teacherId: 'teacher-1',
      status: 'pending',
    })

    renderLayout()

    await waitFor(() => {
      expect(
        screen.getByText(/dossier formateur est en attente de validation/i),
      ).toBeDefined()
    })
  })

  it('affiche le même message « en attente » pour un dossier in_review (pas de distinction pour le formateur)', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchTeacherValidationStatus.mockResolvedValue({
      teacherId: 'teacher-1',
      status: 'in_review',
      updatedAt: '2026-08-12T09:45:00.000Z',
    })

    renderLayout()

    await waitFor(() => {
      expect(
        screen.getByText(/dossier formateur est en attente de validation/i),
      ).toBeDefined()
    })
  })

  it('affiche « refusée — année 2026 » et l\'année de re-candidature pour un dossier rejected', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchTeacherValidationStatus.mockResolvedValue({
      teacherId: 'teacher-1',
      status: 'rejected',
      updatedAt: '2026-08-12T09:45:00.000Z',
      comment: 'Dossier incomplet',
    })

    renderLayout()

    await waitFor(() => {
      expect(screen.getByText(/année 2026/)).toBeDefined()
      expect(screen.getByText(/représenter en 2027/)).toBeDefined()
    })
  })

  it("n'affiche rien pour un formateur validé", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchTeacherValidationStatus.mockResolvedValue({
      teacherId: 'teacher-1',
      status: 'validated',
      updatedAt: '2026-08-12T09:45:00.000Z',
    })

    renderLayout()

    await waitFor(() => {
      expect(screen.getByText('contenu de page')).toBeDefined()
    })
    expect(screen.queryByText(/dossier formateur/i)).toBeNull()
  })

  it("n'appelle jamais la route de validation pour un rôle autre que formateur", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))

    renderLayout()

    await waitFor(() => {
      expect(screen.getByText('contenu de page')).toBeDefined()
    })
    expect(mockFetchTeacherValidationStatus).not.toHaveBeenCalled()
    expect(screen.queryByText(/dossier formateur/i)).toBeNull()
  })
})
