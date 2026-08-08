/**
 * Tests pour ParentFinanceurSection (onglet Profil > « Parents financeurs »)
 *
 * Régression de référence (2026-08-08, 4e occurrence) : l'onglet affichait l'UUID
 * du financeur au lieu de son nom. Trois causes cumulées, toutes verrouillées ici :
 *   1. `financeOwnerName` est renvoyé par la route mais n'était pas lu ;
 *   2. l'enrichissement via `GET /profiles/:financeOwnerId` renvoie 403 pour un élève
 *      (« An élève may only view their own profile ») → repli sur l'UUID ;
 *   3. `formatPersonDisplayName` recollait l'UUID dans le libellé.
 *
 * Couvre :
 * - Nom présent → prénom + nom affichés, AUCUN UUID dans le rendu
 * - `financeOwnerName: null` → repli lisible, AUCUN UUID dans le rendu
 * - Aucun appel à `GET /profiles/:id` (pas de N+1, pas de 403 possible)
 * - États chargement, vide, erreur réseau
 * - Lien « Créer un nouveau compte parent »
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ParentFinanceurSection from '../../../src/components/profile/ParentFinanceurSection'
import { expectNoTechnicalIdentifier } from '../../../src/test-helpers'

vi.mock('../../../src/api/relations')
vi.mock('../../../src/api/parentLinkRequest')
vi.mock('../../../src/hooks/useAuth')

import { fetchLinkedParents, fetchStudentProfile } from '../../../src/api/relations'
import { fetchParentLinkRequests } from '../../../src/api/parentLinkRequest'
import { useAuth } from '../../../src/hooks/useAuth'

const mockFetchLinkedParents = vi.mocked(fetchLinkedParents)
const mockFetchStudentProfile = vi.mocked(fetchStudentProfile)
const mockFetchParentLinkRequests = vi.mocked(fetchParentLinkRequests)
const mockUseAuth = vi.mocked(useAuth)

const STUDENT_ID = 'student-1'
/** UUID réaliste : c'est exactement ce qui fuyait à l'écran avant correction. */
const FINANCE_OWNER_ID = 'ee7c85dc-1234-4abc-9def-000000000000'

function renderSection(studentId: string = STUDENT_ID) {
  return render(
    <MemoryRouter>
      <ParentFinanceurSection studentId={studentId} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // Pas d'invitations en attente par défaut — couvertes ailleurs.
  mockFetchParentLinkRequests.mockResolvedValue([])
  mockUseAuth.mockReturnValue({
    user: {
      id: STUDENT_ID,
      loginIdentifier: 'lucas.martin',
      email: 'lucas@test.com',
      role: 'eleve',
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

describe('ParentFinanceurSection — nom du financeur', () => {
  it('affiche le prénom et le nom fournis par financeOwnerName, sans aucun UUID', async () => {
    mockFetchLinkedParents.mockResolvedValue([
      {
        financeOwnerId: FINANCE_OWNER_ID,
        studentId: STUDENT_ID,
        createdAt: '2026-01-10T10:00:00.000Z',
        financeOwnerName: { firstName: 'Jean', lastName: 'Martin' },
      },
    ])

    const { container } = renderSection()

    await waitFor(() => {
      expect(screen.getByText('Jean Martin')).toBeDefined()
    })
    expectNoTechnicalIdentifier(container)
  })

  it('affiche un repli lisible sans UUID quand financeOwnerName est null', async () => {
    mockFetchLinkedParents.mockResolvedValue([
      {
        financeOwnerId: FINANCE_OWNER_ID,
        studentId: STUDENT_ID,
        createdAt: '2026-01-10T10:00:00.000Z',
        financeOwnerName: null,
      },
    ])

    const { container } = renderSection()

    await waitFor(() => {
      expect(screen.getByText('Financeur (nom non renseigné)')).toBeDefined()
    })
    expectNoTechnicalIdentifier(container)
  })

  it('affiche un repli lisible sans UUID quand financeOwnerName est absent de la réponse', async () => {
    // Cas d'un serveur plus ancien qui n'enrichirait pas encore la réponse.
    mockFetchLinkedParents.mockResolvedValue([
      {
        financeOwnerId: FINANCE_OWNER_ID,
        studentId: STUDENT_ID,
        createdAt: '2026-01-10T10:00:00.000Z',
      },
    ])

    const { container } = renderSection()

    await waitFor(() => {
      expect(screen.getByText('Financeur (nom non renseigné)')).toBeDefined()
    })
    expectNoTechnicalIdentifier(container)
  })

  it('gère un nom partiel (firstName seul, lastName null) sans exposer d\'UUID', async () => {
    mockFetchLinkedParents.mockResolvedValue([
      {
        financeOwnerId: FINANCE_OWNER_ID,
        studentId: STUDENT_ID,
        createdAt: '2026-01-10T10:00:00.000Z',
        financeOwnerName: { firstName: 'Jean', lastName: null },
      },
    ])

    const { container } = renderSection()

    await waitFor(() => {
      expect(screen.getByText('Jean')).toBeDefined()
    })
    expectNoTechnicalIdentifier(container)
  })

  it("n'appelle jamais GET /profiles/:id pour enrichir le nom (pas de N+1, pas de 403)", async () => {
    mockFetchLinkedParents.mockResolvedValue([
      {
        financeOwnerId: FINANCE_OWNER_ID,
        studentId: STUDENT_ID,
        createdAt: '2026-01-10T10:00:00.000Z',
        financeOwnerName: { firstName: 'Jean', lastName: 'Martin' },
      },
    ])

    renderSection()

    await waitFor(() => {
      expect(screen.getByText('Jean Martin')).toBeDefined()
    })
    expect(mockFetchStudentProfile).not.toHaveBeenCalled()
  })

  it('affiche la date de rattachement au format français', async () => {
    mockFetchLinkedParents.mockResolvedValue([
      {
        financeOwnerId: FINANCE_OWNER_ID,
        studentId: STUDENT_ID,
        createdAt: '2026-01-10T10:00:00.000Z',
        financeOwnerName: { firstName: 'Jean', lastName: 'Martin' },
      },
    ])

    renderSection()

    await waitFor(() => {
      expect(screen.getByText(/Depuis le\s+10 janvier 2026/)).toBeDefined()
    })
  })
})

describe('ParentFinanceurSection — états de chargement', () => {
  it('affiche un état de chargement avant la réponse', () => {
    mockFetchLinkedParents.mockReturnValue(new Promise(() => {}))

    renderSection()

    expect(screen.getAllByText('Chargement…').length).toBeGreaterThan(0)
  })

  it("affiche un message quand aucun parent financeur n'est rattaché", async () => {
    mockFetchLinkedParents.mockResolvedValue([])

    renderSection()

    await waitFor(() => {
      expect(screen.getByText("Aucun parent financeur rattaché pour l'instant.")).toBeDefined()
    })
  })

  it('affiche un message d\'erreur lisible si le chargement échoue (erreur réseau)', async () => {
    mockFetchLinkedParents.mockRejectedValue(new Error('network error'))

    const { container } = renderSection()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger vos parents financeurs.')).toBeDefined()
    })
    expectNoTechnicalIdentifier(container)
  })
})

describe('ParentFinanceurSection — création de compte parent', () => {
  it('affiche un lien "Créer un nouveau compte parent" pré-lié à l\'élève, dans un nouvel onglet', async () => {
    mockFetchLinkedParents.mockResolvedValue([])

    renderSection()

    await waitFor(() => {
      expect(screen.getByText("Aucun parent financeur rattaché pour l'instant.")).toBeDefined()
    })

    const createParentLink = screen.getByRole('link', { name: 'Créer un nouveau compte parent' })
    expect(createParentLink.getAttribute('href')).toBe(
      '/register/parent?studentLoginIdentifier=lucas.martin',
    )
    expect(createParentLink.getAttribute('target')).toBe('_blank')
    expect(createParentLink.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
