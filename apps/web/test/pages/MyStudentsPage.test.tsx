/**
 * Tests for MyStudentsPage (vue parent_financeur — élèves rattachés).
 *
 * La page n'avait aucun test : c'est ainsi qu'un nom de champ français
 * (`niveauScolaire`) a pu y survivre alors que profile-service expose `level`.
 * Le niveau est donc asserté explicitement à partir d'une fixture portant les
 * noms réels de `GET /profiles/:userId`.
 *
 * Couvre : chargement, erreur, état vide, succès, et affichage humain
 * (prénom + nom, jamais l'UUID de l'élève).
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MyStudentsPage from '../../src/pages/MyStudentsPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/relations')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchLinkedStudents, fetchStudentProfile } from '../../src/api/relations'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchLinkedStudents = vi.mocked(fetchLinkedStudents)
const mockFetchStudentProfile = vi.mocked(fetchStudentProfile)

const PARENT_USER = {
  id: 'parent-1',
  email: 'parent@test.com',
  role: 'parent_financeur' as const,
  validationStatus: 'active' as const,
}

const LINK = {
  financeOwnerId: 'parent-1',
  studentId: 'student-1',
  createdAt: '2026-01-10T10:00:00.000Z',
}

const STUDENT_PROFILE = {
  userId: 'student-1',
  loginIdentifier: 'alice.martin',
  administrative: { firstName: 'Alice', lastName: 'Martin' },
  // `level`, pas `niveauScolaire` : noms de champs anglais côté profile-service.
  pedagogical: { level: 'Terminale' },
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MyStudentsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({
    user: PARENT_USER,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(PARENT_USER.role)),
    isInternalRole: vi.fn(() => false),
  })
})

describe('MyStudentsPage', () => {
  it('shows a loading state while fetching linked students', () => {
    mockFetchLinkedStudents.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('shows an error message when the relations call fails', async () => {
    mockFetchLinkedStudents.mockRejectedValue(new Error('network'))

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/impossible de charger vos élèves/i)).toBeDefined()
    })
  })

  it('offers to link a student when none is attached', async () => {
    mockFetchLinkedStudents.mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Aucun élève rattaché.')).toBeDefined()
    })
    expect(screen.getByRole('link', { name: 'Rattacher un élève' })).toBeDefined()
  })

  it('displays the student by name and school level, never by UUID', async () => {
    mockFetchLinkedStudents.mockResolvedValue([LINK])
    mockFetchStudentProfile.mockResolvedValue(STUDENT_PROFILE)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Alice Martin')).toBeDefined()
    })
    expect(screen.getByText('Niveau : Terminale')).toBeDefined()
    expect(screen.queryByText('student-1')).toBeNull()
  })

  it('falls back to a readable label when the profile cannot be loaded', async () => {
    mockFetchLinkedStudents.mockResolvedValue([LINK])
    mockFetchStudentProfile.mockRejectedValue(new Error('403'))

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Profil indisponible')).toBeDefined()
    })
  })

  it('omits the level line when the pedagogical profile is empty — a normal state', async () => {
    mockFetchLinkedStudents.mockResolvedValue([LINK])
    mockFetchStudentProfile.mockResolvedValue({ ...STUDENT_PROFILE, pedagogical: null })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Alice Martin')).toBeDefined()
    })
    expect(screen.queryByText(/^Niveau :/)).toBeNull()
  })
})
