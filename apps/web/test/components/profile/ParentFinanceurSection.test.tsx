/**
 * Tests pour ParentFinanceurSection
 *
 * Couvre :
 * - Cas nominal : le parent financeur rattaché a un prénom + nom → affichage
 *   "Prénom Nom (ID : identifiant)", jamais un extrait d'UUID nu.
 * - Cas limite : prénom/nom absents côté API → repli lisible avec identifiant
 *   de connexion ou identifiant technique, jamais "Financeur (uuid tronqué…)".
 * - États chargement et vide.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ParentFinanceurSection from '../../../src/components/profile/ParentFinanceurSection'

vi.mock('../../../src/api/relations')
vi.mock('../../../src/api/parentLinkRequest')

import { fetchLinkedParents, fetchStudentProfile } from '../../../src/api/relations'
import { fetchParentLinkRequests } from '../../../src/api/parentLinkRequest'

const mockFetchLinkedParents = vi.mocked(fetchLinkedParents)
const mockFetchStudentProfile = vi.mocked(fetchStudentProfile)
const mockFetchParentLinkRequests = vi.mocked(fetchParentLinkRequests)

const STUDENT_ID = 'student-1'
const FINANCE_OWNER_ID = 'ee7c85dc-1234-4abc-9def-000000000000'

beforeEach(() => {
  vi.clearAllMocks()
  // Pas d'invitations en attente par défaut — non testé ici.
  mockFetchParentLinkRequests.mockResolvedValue([])
})

describe('ParentFinanceurSection', () => {
  it('affiche le prénom et le nom du parent financeur suivis de son identifiant (cas nominal)', async () => {
    mockFetchLinkedParents.mockResolvedValue([
      { financeOwnerId: FINANCE_OWNER_ID, studentId: STUDENT_ID, createdAt: '2026-01-10T10:00:00.000Z' },
    ])
    mockFetchStudentProfile.mockResolvedValue({
      userId: FINANCE_OWNER_ID,
      loginIdentifier: 'marie.dupont',
      administrativeProfile: { firstName: 'Marie', lastName: 'Dupont' },
    })

    render(<ParentFinanceurSection studentId={STUDENT_ID} />)

    await waitFor(() => {
      expect(screen.getByText('Marie Dupont (ID : marie.dupont)')).toBeDefined()
    })
    // Jamais le libellé générique brut ni un extrait d'UUID tronqué
    expect(screen.queryByText(/Financeur \(ee7c85dc/)).toBeNull()
  })

  it(
    "affiche un repli lisible avec l'identifiant quand prénom/nom sont absents côté API " +
      "(pas de simple extrait d'UUID)",
    async () => {
      mockFetchLinkedParents.mockResolvedValue([
        { financeOwnerId: FINANCE_OWNER_ID, studentId: STUDENT_ID, createdAt: '2026-01-10T10:00:00.000Z' },
      ])
      mockFetchStudentProfile.mockResolvedValue({
        userId: FINANCE_OWNER_ID,
        loginIdentifier: null,
        administrativeProfile: {},
      })

      render(<ParentFinanceurSection studentId={STUDENT_ID} />)

      await waitFor(() => {
        expect(screen.getByText(`Financeur (ID : ${FINANCE_OWNER_ID})`)).toBeDefined()
      })
      // L'identifiant complet doit rester visible, jamais tronqué avec une ellipse
      expect(screen.queryByText(/…\)$/)).toBeNull()
    },
  )

  it("affiche un repli avec l'identifiant de connexion quand seul le nom est absent", async () => {
    mockFetchLinkedParents.mockResolvedValue([
      { financeOwnerId: FINANCE_OWNER_ID, studentId: STUDENT_ID, createdAt: '2026-01-10T10:00:00.000Z' },
    ])
    mockFetchStudentProfile.mockResolvedValue({
      userId: FINANCE_OWNER_ID,
      loginIdentifier: 'marie.dupont',
      administrativeProfile: {},
    })

    render(<ParentFinanceurSection studentId={STUDENT_ID} />)

    await waitFor(() => {
      expect(screen.getByText('Financeur (ID : marie.dupont)')).toBeDefined()
    })
  })

  it('affiche un message quand aucun parent financeur n\'est rattaché', async () => {
    mockFetchLinkedParents.mockResolvedValue([])

    render(<ParentFinanceurSection studentId={STUDENT_ID} />)

    await waitFor(() => {
      expect(screen.getByText('Aucun parent financeur rattaché pour l\'instant.')).toBeDefined()
    })
  })

  it('affiche un message d\'erreur si le chargement des parents échoue', async () => {
    mockFetchLinkedParents.mockRejectedValue(new Error('network error'))

    render(<ParentFinanceurSection studentId={STUDENT_ID} />)

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger vos parents financeurs.')).toBeDefined()
    })
  })
})
