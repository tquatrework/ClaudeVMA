/**
 * Tests pour LinkedStudentsSection (onglet Profil > « Mes élèves / enfants »)
 *
 * Symétrique de ParentFinanceurSection : la route
 * `GET /relations/finance-owner-student/:financeOwnerId` renvoie déjà `studentName`.
 * Même règle UX : jamais d'UUID à l'écran, jamais de ré-enrichissement N+1.
 *
 * Couvre :
 * - `studentName` présent → prénom + nom affichés, AUCUN UUID dans le rendu
 * - `studentName` null / absent → repli lisible, AUCUN UUID dans le rendu
 * - Aucun appel à `GET /profiles/:id`
 * - États chargement, vide, erreur réseau
 * - Lien « Créer un compte élève »
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LinkedStudentsSection from '../../../src/components/profile/LinkedStudentsSection'
import { expectNoTechnicalIdentifier } from '../../../src/test-helpers'

vi.mock('../../../src/api/relations')
vi.mock('../../../src/api/parentLinkRequest')
vi.mock('../../../src/hooks/useAuth')

import { fetchLinkedStudents, fetchStudentProfile } from '../../../src/api/relations'
import { fetchParentLinkRequests } from '../../../src/api/parentLinkRequest'
import { useAuth } from '../../../src/hooks/useAuth'

const mockFetchLinkedStudents = vi.mocked(fetchLinkedStudents)
const mockFetchStudentProfile = vi.mocked(fetchStudentProfile)
const mockFetchParentLinkRequests = vi.mocked(fetchParentLinkRequests)
const mockUseAuth = vi.mocked(useAuth)

const PARENT_ID = 'parent-1'
const STUDENT_ID = 'ee7c85dc-1234-4abc-9def-000000000000'

function renderSection(parentId: string = PARENT_ID) {
  return render(
    <MemoryRouter>
      <LinkedStudentsSection parentId={parentId} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchParentLinkRequests.mockResolvedValue([])
  mockUseAuth.mockReturnValue({
    user: {
      id: PARENT_ID,
      loginIdentifier: 'marie.dupont',
      email: 'marie@test.com',
      role: 'parent_financeur',
      validationStatus: 'active',
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    hasRole: vi.fn(() => false),
    isInternalRole: vi.fn(() => false),
  })
})

describe("LinkedStudentsSection — nom de l'élève", () => {
  it('affiche le prénom et le nom fournis par studentName, sans aucun UUID', async () => {
    mockFetchLinkedStudents.mockResolvedValue([
      {
        financeOwnerId: PARENT_ID,
        studentId: STUDENT_ID,
        createdAt: '2026-01-10T10:00:00.000Z',
        studentName: { firstName: 'Lucas', lastName: 'Martin' },
      },
    ])

    const { container } = renderSection()

    await waitFor(() => {
      expect(screen.getByText('Lucas Martin')).toBeDefined()
    })
    expectNoTechnicalIdentifier(container)
  })

  it('affiche un repli lisible sans UUID quand studentName est null', async () => {
    mockFetchLinkedStudents.mockResolvedValue([
      {
        financeOwnerId: PARENT_ID,
        studentId: STUDENT_ID,
        createdAt: '2026-01-10T10:00:00.000Z',
        studentName: null,
      },
    ])

    const { container } = renderSection()

    await waitFor(() => {
      expect(screen.getByText('Élève (nom non renseigné)')).toBeDefined()
    })
    expectNoTechnicalIdentifier(container)
  })

  it('affiche un repli lisible sans UUID quand studentName est absent de la réponse', async () => {
    mockFetchLinkedStudents.mockResolvedValue([
      {
        financeOwnerId: PARENT_ID,
        studentId: STUDENT_ID,
        createdAt: '2026-01-10T10:00:00.000Z',
      },
    ])

    const { container } = renderSection()

    await waitFor(() => {
      expect(screen.getByText('Élève (nom non renseigné)')).toBeDefined()
    })
    expectNoTechnicalIdentifier(container)
  })

  it("n'appelle jamais GET /profiles/:id pour enrichir le nom (pas de N+1)", async () => {
    mockFetchLinkedStudents.mockResolvedValue([
      {
        financeOwnerId: PARENT_ID,
        studentId: STUDENT_ID,
        createdAt: '2026-01-10T10:00:00.000Z',
        studentName: { firstName: 'Lucas', lastName: 'Martin' },
      },
    ])

    renderSection()

    await waitFor(() => {
      expect(screen.getByText('Lucas Martin')).toBeDefined()
    })
    expect(mockFetchStudentProfile).not.toHaveBeenCalled()
  })
})

describe('LinkedStudentsSection — états de chargement', () => {
  it('affiche un état de chargement avant la réponse', () => {
    mockFetchLinkedStudents.mockReturnValue(new Promise(() => {}))

    renderSection()

    expect(screen.getAllByText('Chargement…').length).toBeGreaterThan(0)
  })

  it("affiche un message quand aucun élève n'est rattaché", async () => {
    mockFetchLinkedStudents.mockResolvedValue([])

    renderSection()

    await waitFor(() => {
      expect(screen.getByText("Aucun élève rattaché pour l'instant.")).toBeDefined()
    })
  })

  it("affiche un message d'erreur lisible si le chargement échoue (erreur réseau)", async () => {
    mockFetchLinkedStudents.mockRejectedValue(new Error('network error'))

    const { container } = renderSection()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger vos élèves rattachés.')).toBeDefined()
    })
    expectNoTechnicalIdentifier(container)
  })
})

describe("LinkedStudentsSection — création de compte élève", () => {
  it('affiche un lien "Créer un compte élève" pré-lié au parent, dans un nouvel onglet', async () => {
    mockFetchLinkedStudents.mockResolvedValue([])

    renderSection()

    await waitFor(() => {
      expect(screen.getByText("Aucun élève rattaché pour l'instant.")).toBeDefined()
    })

    const createStudentLink = screen.getByRole('link', { name: 'Créer un compte élève' })
    expect(createStudentLink.getAttribute('href')).toBe(
      '/register/student?parentLoginIdentifier=marie.dupont',
    )
    expect(createStudentLink.getAttribute('target')).toBe('_blank')
    expect(createStudentLink.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
