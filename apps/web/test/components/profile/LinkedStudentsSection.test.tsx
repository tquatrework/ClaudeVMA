/**
 * Tests pour LinkedStudentsSection
 *
 * Couvre :
 * - Cas nominal : l'élève rattaché a un prénom + nom → affichage
 *   "Prénom Nom (ID : identifiant)", jamais un extrait d'UUID nu.
 * - États chargement, vide et erreur.
 * - Lien "Créer un compte élève" ouvrant /register/student dans un nouvel onglet.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LinkedStudentsSection from '../../../src/components/profile/LinkedStudentsSection'

vi.mock('../../../src/api/relations')
vi.mock('../../../src/api/parentLinkRequest')

import { fetchLinkedStudents, fetchStudentProfile } from '../../../src/api/relations'
import { fetchParentLinkRequests } from '../../../src/api/parentLinkRequest'

const mockFetchLinkedStudents = vi.mocked(fetchLinkedStudents)
const mockFetchStudentProfile = vi.mocked(fetchStudentProfile)
const mockFetchParentLinkRequests = vi.mocked(fetchParentLinkRequests)

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
  // Pas d'invitations en attente par défaut — non testé ici.
  mockFetchParentLinkRequests.mockResolvedValue([])
})

describe('LinkedStudentsSection', () => {
  it('affiche le prénom et le nom de l\'élève rattaché suivis de son identifiant (cas nominal)', async () => {
    mockFetchLinkedStudents.mockResolvedValue([
      { financeOwnerId: PARENT_ID, studentId: STUDENT_ID, createdAt: '2026-01-10T10:00:00.000Z' },
    ])
    mockFetchStudentProfile.mockResolvedValue({
      userId: STUDENT_ID,
      loginIdentifier: 'lucas.martin',
      administrativeProfile: { firstName: 'Lucas', lastName: 'Martin' },
    })

    renderSection()

    await waitFor(() => {
      expect(screen.getByText('Lucas Martin (ID : lucas.martin)')).toBeDefined()
    })
    // Jamais le libellé générique brut ni un extrait d'UUID tronqué
    expect(screen.queryByText(/Élève \(ee7c85dc/)).toBeNull()
  })

  it('affiche un message quand aucun élève n\'est rattaché', async () => {
    mockFetchLinkedStudents.mockResolvedValue([])

    renderSection()

    await waitFor(() => {
      expect(screen.getByText('Aucun élève rattaché pour l\'instant.')).toBeDefined()
    })
  })

  it('affiche un message d\'erreur si le chargement des élèves échoue', async () => {
    mockFetchLinkedStudents.mockRejectedValue(new Error('network error'))

    renderSection()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger vos élèves rattachés.')).toBeDefined()
    })
  })

  it('affiche un lien "Créer un compte élève" ouvrant /register/student dans un nouvel onglet', async () => {
    mockFetchLinkedStudents.mockResolvedValue([])

    renderSection()

    await waitFor(() => {
      expect(screen.getByText('Aucun élève rattaché pour l\'instant.')).toBeDefined()
    })

    const createStudentLink = screen.getByRole('link', { name: 'Créer un compte élève' })
    expect(createStudentLink.getAttribute('href')).toBe('/register/student')
    expect(createStudentLink.getAttribute('target')).toBe('_blank')
    expect(createStudentLink.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
